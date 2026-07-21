/**
 * herramienta-atributos.js
 * Módulo de Análisis Espacial: Consulta de Atributos (Identify / GetFeatureInfo).
 */
export class HerramientaAtributos {
    /**
     * @param {L.Map} instanciaMapa Instancia activa de Leaflet.
     * @param {Object} capasOperativas Diccionario de capas cargadas en memoria.
     * @param {Orquestador} orquestador Instancia del mediador central.
     */
    constructor(instanciaMapa, capasOperativas, orquestador) {
        this.mapa = instanciaMapa;
        this.capasOperativas = capasOperativas;
        this.orquestador = orquestador;
        this.activo = false;
        this.popupActivo = null;
        this.circuloBuffer = null;
        this.radioBufferPixeles = 10;
        this.manejadorClickMapa = this.alHacerClickMapa.bind(this);
        this.manejadorMoverMouse = this.alMoverMouse.bind(this);
    }

    /**
     * Activa la herramienta y habilita el cursor de interrogación junto con el rastreo dinámico.
     */
    activar() {
        if (this.activo) return;
        this.activo = true;
        this.orquestador.info(
            'Herramienta Atributos',
            'Herramienta de consulta de atributos ACTIVADA.'
        );

        this.mapa.getContainer().style.cursor = 'help';
        this.mapa.on('click', this.manejadorClickMapa);
        this.mapa.on('mousemove', this.manejadorMoverMouse);
    }

    /**
     * Dibuja o actualiza un círculo indicador basado ESTRICTAMENTE en píxeles de pantalla,
     * garantizando simetría perfecta con la zona de tolerancia (buffer) de GeoServer.
     */
    alMoverMouse(evento) {
        const capasActivasIds = Object.keys(this.capasOperativas);

        if (capasActivasIds.length === 0) {
            this.removerCirculoBuffer();
            return;
        }

        const idCapaActiva = capasActivasIds[capasActivasIds.length - 1];
        const capaWmsLeaflet = this.capasOperativas[idCapaActiva];
        const tipoGeometria = capaWmsLeaflet.options.tipoGeometria;

        if (tipoGeometria === 'poligono' || tipoGeometria === 'imagen') {
            this.removerCirculoBuffer();
            return;
        }

        const radio = parseFloat(this.radioBufferPixeles);
        const centroLatLng = evento.latlng;

        if (!this.circuloBuffer) {
            this.circuloBuffer = L.circleMarker(centroLatLng, {
                radius: radio,
                color: '#3498db',
                weight: 1.5,
                dashArray: '4, 4',
                fillColor: '#3498db',
                fillOpacity: 0.15,
                interactive: false,
            }).addTo(this.mapa);
        } else {
            this.circuloBuffer.setLatLng(centroLatLng);

            if (this.circuloBuffer.getRadius() !== radio) {
                this.circuloBuffer.setRadius(radio);
            }
        }
    }

    /**
     * Quita el indicador circular del mapa de manera segura.
     */
    removerCirculoBuffer() {
        if (this.circuloBuffer) {
            this.mapa.removeLayer(this.circuloBuffer);
            this.circuloBuffer = null;
        }
    }

    /**
     * Procesa el clic e interroga a los servidores activos evaluando el formato de respuesta.
     */
    async alHacerClickMapa(evento) {
        const coordenada = evento.latlng;
        const capasActivasIds = Object.keys(this.capasOperativas);

        if (capasActivasIds.length === 0) {
            this.popupActivo = L.popup({ closeButton: true, autoClose: false })
                .setLatLng(coordenada)
                .setContent(
                    `<span class="alerta__titulo">Consulta de Atributos</span><br>
                    <span class="alerta__texto">Activa una capa operativa en la barra lateral para ver sus atributos.</span>`
                )
                .openOn(this.mapa);
            return;
        }

        this.orquestador.debug(
            'Herramienta Atributos',
            `Interrogando posición espacial: ${coordenada.toString()}`
        );

        this.popupActivo = L.popup()
            .setLatLng(coordenada)
            .setContent(
                "<b>Consultando datos...</b><br><div class='spinner-mini'></div>"
            )
            .openOn(this.mapa);

        try {
            const idCapaActiva = capasActivasIds[0];
            const capaWmsLeaflet = this.capasOperativas[idCapaActiva];
            const nombreCapaActiva =
                capaWmsLeaflet.options.nombreCapa || 'Capa Operativa';

            const urlGetFeatureInfo = this.construirUrlGetFeatureInfo(
                coordenada,
                capaWmsLeaflet
            );

            const respuesta = await fetch(urlGetFeatureInfo);
            if (!respuesta.ok)
                throw new Error(
                    'Error en la respuesta del geoservicio remoto.'
                );

            const contentType = respuesta.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textoExcepcionXml = await respuesta.text();
                this.orquestador.throwError('Herramienta Atributos', `Formato inválido.`);
            }

            const datosGeoJSON = await respuesta.json();

            if (datosGeoJSON.features && datosGeoJSON.features.length > 0) {
                const propiedades = datosGeoJSON.features[0].properties;

                let htmlContenido = `<span class="tabla-atributos__titulo">${nombreCapaActiva}</span><br><table class='tabla-atributos'>`;

                Object.entries(propiedades).forEach(([clave, valor]) => {
                    if (valor !== null && valor !== undefined) {
                        htmlContenido += `<tr><td><b>${clave}:</b></td><td>${valor}</td></tr>`;
                    }
                });
                htmlContenido += '</table>';

                this.popupActivo.setContent(htmlContenido);
            } else {
                this.popupActivo.setContent(
                    `<span class="alerta__titulo">${nombreCapaActiva}</span><br>
                    <span class="alerta__texto">No se encontraron elementos geoespaciales en este punto.</span>`
                );
            }
        } catch (error) {
            this.orquestador.error(
                'Herramienta Atributos', 
                'Consulta GetFeatureInfo fallida de forma controlada:', error
            );
            this.popupActivo.setContent(
                `<span class="alerta__titulo">Consulta de Atributos</span><br>
                <span class="alerta__texto">El servidor de la capa seleccionada no permite consultas directas en esta posición o tiene restricciones de formato.</span>`
            );
        }
    }

    /**
     * Construye dinámicamente los parámetros de la petición WMS simulando un mini mapa (BBOX acotado)
     * centrado en el cursor para garantizar tolerancia del 100% en todos los servidores (IDE, MTOP, etc).
     */
    construirUrlGetFeatureInfo(latlng, capaWms) {
        const urlBase = capaWms._url;
        const paramWms = capaWms.wmsParams;
        const versionWms = paramWms.version || '1.3.0';
        const tipoGeometria = capaWms.options.tipoGeometria || 'poligono';
        const esVectorialLineal =
            tipoGeometria !== 'poligono' && tipoGeometria !== 'imagen';
        const radioPixeles = esVectorialLineal ? this.radioBufferPixeles : 2;
        const puntoPixelCentro = this.mapa.latLngToLayerPoint(latlng);
        const pixelSuroeste = L.point(
            puntoPixelCentro.x - radioPixeles,
            puntoPixelCentro.y + radioPixeles
        );
        const pixelNordeste = L.point(
            puntoPixelCentro.x + radioPixeles,
            puntoPixelCentro.y - radioPixeles
        );
        const latLngSW = this.mapa.layerPointToLatLng(pixelSuroeste);
        const latLngNE = this.mapa.layerPointToLatLng(pixelNordeste);
        const dimensionMatriz = radioPixeles * 2;
        const clickCentro = radioPixeles;

        const parametros = {
            request: 'GetFeatureInfo',
            service: 'WMS',
            version: versionWms,
            layers: paramWms.layers,
            query_layers: paramWms.layers,
            info_format: 'application/json',
            format: paramWms.format || 'image/png',
            transparent: paramWms.transparent ? 'TRUE' : 'FALSE',
            styles: paramWms.styles || '',
            feature_count: 1,
            width: dimensionMatriz,
            height: dimensionMatriz,
            exceptions: 'application/json',
            ...(versionWms === '1.1.1'
                ? {
                      bbox: `${latLngSW.lng},${latLngSW.lat},${latLngNE.lng},${latLngNE.lat}`,
                      x: clickCentro,
                      y: clickCentro,
                  }
                : {
                      bbox: `${latLngSW.lat},${latLngSW.lng},${latLngNE.lat},${latLngNE.lng}`,
                      i: clickCentro,
                      j: clickCentro,
                      crs: 'EPSG:4326',
                  }),
        };

        if (!urlBase.includes('mtop.gub.uy') && esVectorialLineal) {
            parametros.buffer = radioPixeles;
        }

        const queryString = Object.entries(parametros)
            .map(
                ([clave, valor]) =>
                    `${encodeURIComponent(clave)}=${encodeURIComponent(valor)}`
            )
            .join('&');

        return `${urlBase}?${queryString}`;
    }

    /**
     * Desactiva la herramienta limpiando eventos, indicadores flotantes y popups del mapa.
     */
    desactivar() {
        if (!this.activo) return;
        this.activo = false;
        this.orquestador.debug(
            'Herramienta Atributos',
            'Herramienta de atributos DESACTIVADA. Limpiando elementos residuales de la escena.'
        );

        this.mapa.getContainer().style.cursor = '';
        this.mapa.off('click', this.manejadorClickMapa);
        this.mapa.off('mousemove', this.manejadorMoverMouse);
        this.removerCirculoBuffer();

        if (this.popupActivo) {
            this.mapa.closePopup(this.popupActivo);
            this.popupActivo = null;
        }
    }
}