/**
 * perfil-elevacion.js
 * Lógica geoespacial para trazar líneas, remuestrear segmentos y consultar elevación al WMS.
 * Actualizado a Estrategia A: Descarga de GeoTIFF local.
 */
import { InterfazPerfilElevacion } from '../interfaz-perfil-elevacion.js';

export class PerfilElevacion {
    constructor(mapa, orquestador) {
        this.mapa = mapa;
        this.orquestador = orquestador;
        this.config =
            this.orquestador.configuracionGlobal?.['perfil-elevacion'];
        this.maxMuestras = parseInt(this.config?.muestras) || 200;
        this.RESOLUCION_NATIVA_M = 0.32;
        this.LIMITE_PRECISION_KM = 0.64;

        this.proveedorMDT = {
            url: 'https://mapas.ide.uy/geoserver-raster/relieve/ows',
            layerName: 'mdt_nacional',
        };

        this.ui = new InterfazPerfilElevacion(orquestador);
        this.ui.onCerrar = () => this.desactivar();
        this.activo = false;

        this.nodos = [];
        this.marcadores = [];
        this.polilinea = null;
        this.polilineaPrevia = null;
        this.capaWMS = null;
        this.tooltip = null;
        this.lastUpdate = 0;

        this.onMapClick = this.manejarClickMapa.bind(this);
        this.onMouseMove = this.actualizarPrevisualizacion.bind(this);
    }

    activar() {
        this.limpiarTodo();
        this.activo = true;
        this.capaWMS = L.tileLayer
            .wms(this.proveedorMDT.url, {
                layers: this.proveedorMDT.layerName,
                format: 'image/png',
                transparent: true,
                version: '1.3.0',
                opacity: 0,
                zIndex: 10,
            })
            .addTo(this.mapa);

        this.mapa.getContainer().style.cursor = 'crosshair';
        this.mapa.on('click', this.onMapClick);
        this.mapa.on('mousemove', this.onMouseMove);

        this.orquestador.info(
            'Perfil Elevacion',
            'Herramienta Perfil de Elevación ACTIVADA.'
        );
    }

    desactivar() {
        this.activo = false;
        this.mapa.getContainer().style.cursor = '';
        this.mapa.off('click', this.onMapClick);
        this.mapa.off('mousemove', this.onMouseMove);
        this.limpiarTodo();
        this.ui.destruir();
    }

    agregarMarcador(coord, color = '#1a6a9a') {
        const marcador = L.circleMarker(coord, {
            radius: 6,
            fillColor: color,
            color: color,
            weight: 2,
            fillOpacity: 0.8,
        }).addTo(this.mapa);
        this.marcadores.push(marcador);
    }

    manejarClickMapa(e) {
        if (this.nodos.length === 0) {
            this.nodos.push(e.latlng);
            this.agregarMarcador(e.latlng, '#1a6a9a');
        } else if (this.nodos.length === 1) {
            const dist = this.mapa.distance(this.nodos[0], e.latlng);
            if (dist > 640) {
                this.orquestador.warn(
                    'Perfil Elevación',
                    'La distancia es mayor a 640 metros. No se puede marcar el segundo punto.'
                );
                return;
            }
            this.nodos.push(e.latlng);
            this.agregarMarcador(e.latlng, '#1a6a9a');
            this.dibujarLineaFinal('#55B5E5');
            this.finalizarCaptura();
        }
    }

    actualizarPrevisualizacion(e) {
        const ahora = Date.now();
        if (ahora - this.lastUpdate < 16) return;
        this.lastUpdate = ahora;

        if (this.nodos.length !== 1) return;

        const dist = this.mapa.distance(this.nodos[0], e.latlng);
        const superaLimite = dist > 640;
        const color = superaLimite ? '#e74c3c' : '#1a6a9a';

        if (!this.polilineaPrevia) {
            this.polilineaPrevia = L.polyline([this.nodos[0], e.latlng], {
                color: color,
                weight: 3,
                dashArray: '5, 5',
            }).addTo(this.mapa);
        } else {
            this.polilineaPrevia.setLatLngs([this.nodos[0], e.latlng]);
            this.polilineaPrevia.setStyle({ color: color });
        }

        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'tooltip-medicion';
            document.body.appendChild(this.tooltip);
        }

        this.tooltip.style.left = e.originalEvent.pageX + 15 + 'px';
        this.tooltip.style.top = e.originalEvent.pageY + 15 + 'px';

        if (superaLimite) {
            this.tooltip.className = 'tooltip-medicion alerta';
            this.tooltip.innerHTML = `⚠️ Máx 640m (${dist.toFixed(0)}m)`;
            this.mapa.getContainer().style.cursor = 'not-allowed';
        } else {
            this.tooltip.className = 'tooltip-medicion';
            this.tooltip.innerHTML = `Distancia: ${dist.toFixed(0)}m`;
            this.mapa.getContainer().style.cursor = 'crosshair';
        }
    }

    dibujarLineaFinal(color = '#55B5E5') {
        this.polilinea = L.polyline(this.nodos, {
            color: color,
            weight: 3,
        }).addTo(this.mapa);
        if (this.polilineaPrevia) {
            this.mapa.removeLayer(this.polilineaPrevia);
            this.polilineaPrevia = null;
        }
    }

    finalizarCaptura() {
        this.mapa.off('mousemove', this.onMouseMove); // Dejar de rastrear
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        this.ui.mostrarCargando(true);
        this.calcularPerfil();
    }

    async calcularPerfil() {
        this.orquestador.info(
            'Perfil Elevación',
            'Iniciando cálculo de perfil MDTHC...'
        );

        const latlngs = this.polilinea.getLatLngs();
        const bounds = L.latLngBounds(latlngs);
        const puntosMuestreo = this.generarPuntosAdaptativos();
        const resultados = [];

        try {
            this.orquestador.debug(
                'Perfil Elevación',
                '1. Descargando recorte GeoTIFF del área...'
            );

            // Un solo request HTTP a GeoServer
            await this.descargarMDTLocal(bounds);

            this.orquestador.debug(
                'Perfil Elevación',
                '2. Calculando elevaciones en memoria...'
            );

            // Loop instantáneo sin espera de red
            for (const punto of puntosMuestreo) {
                const elevacion = this.obtenerElevacionEnCoordenada(
                    punto.latlng.lng,
                    punto.latlng.lat
                );
                resultados.push({
                    distancia: punto.distanciaAcumulada,
                    elevacion: elevacion,
                });
            }

            this.orquestador.debug(
                'Perfil Elevación',
                '3. Renderizando gráfico.'
            );
            this.ui.renderizarGrafico(resultados);
        } catch (error) {
            this.orquestador.error(
                'Perfil Elevación',
                'Error: ', error
            );
        }
    }

    /**
     * Realiza un GetMap solicitando un image/geotiff con validación de seguridad.
     */
    async descargarMDTLocal(bounds) {
        const delta = 0.0001;
        const minX = bounds.getWest() - delta,
            minY = bounds.getSouth() - delta;
        const maxX = bounds.getEast() + delta,
            maxY = bounds.getNorth() + delta;
        this.rasterBbox = [minX, minY, maxX, maxY];

        const metrosY = (maxY - minY) * 111111;
        const metrosX =
            (maxX - minX) *
            111111 *
            Math.cos(((minY + maxY) / 2) * (Math.PI / 180));

        const finalWidth = Math.min(
            Math.ceil(metrosX / this.RESOLUCION_NATIVA_M),
            2000
        );
        const finalHeight = Math.min(
            Math.ceil(metrosY / this.RESOLUCION_NATIVA_M),
            2000
        );

        const url = new URL(this.proveedorMDT.url);
        url.searchParams.set('SERVICE', 'WMS');
        url.searchParams.set('VERSION', '1.3.0');
        url.searchParams.set('REQUEST', 'GetMap');
        url.searchParams.set('LAYERS', this.proveedorMDT.layerName);
        url.searchParams.set('CRS', 'EPSG:4326');
        url.searchParams.set('BBOX', `${minY},${minX},${maxY},${maxX}`);
        url.searchParams.set('WIDTH', finalWidth);
        url.searchParams.set('HEIGHT', finalHeight);
        url.searchParams.set('TRANSPARENT', 'TRUE');
        url.searchParams.set('FORMAT', 'image/geotiff');

        try {
            const res = await fetch(url.toString());

            if (!res.ok)
                this.orquestador.throwError(
                    'Perfil Elevación',
                    `Error de servidor: ${res.status} ${res.statusText}`
                );

            const contentType = res.headers.get('content-type');
            const esErrorXML =
                contentType &&
                (contentType.includes('text/xml') ||
                    contentType.includes('application/vnd.ogc.se_xml'));

            if (esErrorXML) {
                const textoError = await res.text();
                this.orquestador.error('Error del GeoServer:', `${textoError}`);
                this.orquestador.throwError(
                    'Perfil Elevación',
                    'El servicio WMS retornó un error XML (revisar parámetros o límites).'
                );
            }

            const buffer = await res.arrayBuffer();

            if (typeof GeoTIFF === 'undefined') {
               this.orquestador.throwError(
                   'Perfil Elevación',
                   'La librería GeoTIFF no está cargada en /src/Librerias.'
               );                
            }

            const tiff = await GeoTIFF.fromArrayBuffer(buffer);
            const image = await tiff.getImage();
            const rasters = await image.readRasters();

            this.rasterData = rasters[0];
            this.rasterWidth = image.getWidth();
            this.rasterHeight = image.getHeight();

            this.orquestador.debug(
                'Perfil Elevación',
                `1.1. Raster cargado correctamente: ${this.rasterWidth}x${this.rasterHeight} px.`
            );
        } catch (error) {
            this.orquestador.error(
                'Perfil Elevación',
                'Error fatal al procesar MDT: ', error
            );
        }
    }

    /**
     * Traduce una coordenada geográfica al píxel correspondiente en la matriz descargada.
     */
    obtenerElevacionEnCoordenada(lng, lat) {
        if (!this.rasterData) return 0;

        const [minX, minY, maxX, maxY] = this.rasterBbox;

        if (lng < minX || lng > maxX || lat < minY || lat > maxY) {
            return 0;
        }

        const pctX = (lng - minX) / (maxX - minX);
        const pctY = (maxY - lat) / (maxY - minY);

        const pixelX = Math.floor(pctX * this.rasterWidth);
        const pixelY = Math.floor(pctY * this.rasterHeight);

        const xClamped = Math.max(0, Math.min(this.rasterWidth - 1, pixelX));
        const yClamped = Math.max(0, Math.min(this.rasterHeight - 1, pixelY));

        const indice = yClamped * this.rasterWidth + xClamped;
        const elevacion = this.rasterData[indice];

        if (elevacion < -100 || isNaN(elevacion)) {
            return null;
        }

        return elevacion;
    }

    generarPuntosAdaptativos() {
        let distanciaTotal = 0;
        const segmentos = [];

        for (let i = 0; i < this.nodos.length - 1; i++) {
            const dist = this.mapa.distance(this.nodos[i], this.nodos[i + 1]);
            distanciaTotal += dist;
            segmentos.push({
                p1: this.nodos[i],
                p2: this.nodos[i + 1],
                length: dist,
            });
        }

        // Número de muestras adaptativo
        const numPuntos = Math.min(
            this.maxMuestras,
            Math.max(10, Math.floor(distanciaTotal / 10))
        );
        const pasoMetros = distanciaTotal / (numPuntos - 1);

        const puntosInterpolados = [];
        let distanciaRecorrida = 0;
        let distAcumuladaSegmentoAnterior = 0;

        for (const seg of segmentos) {
            while (
                distanciaRecorrida <=
                distAcumuladaSegmentoAnterior + seg.length
            ) {
                const ratio =
                    (distanciaRecorrida - distAcumuladaSegmentoAnterior) /
                    seg.length;
                const lat = seg.p1.lat + (seg.p2.lat - seg.p1.lat) * ratio;
                const lng = seg.p1.lng + (seg.p2.lng - seg.p1.lng) * ratio;

                puntosInterpolados.push({
                    latlng: L.latLng(lat, lng),
                    distanciaAcumulada: distanciaRecorrida,
                });

                distanciaRecorrida += pasoMetros;
            }
            distAcumuladaSegmentoAnterior += seg.length;
        }

        puntosInterpolados.push({
            latlng: this.nodos[this.nodos.length - 1],
            distanciaAcumulada: distanciaTotal,
        });

        return puntosInterpolados;
    }

    limpiarTodo() {
        if (this.polilinea) {
            this.mapa.removeLayer(this.polilinea);
            this.polilinea = null;
        }
        if (this.polilineaPrevia) {
            this.mapa.removeLayer(this.polilineaPrevia);
            this.polilineaPrevia = null;
        }
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }
        if (this.marcadores) {
            this.marcadores.forEach((m) => this.mapa.removeLayer(m));
            this.marcadores = [];
        }
        if (this.capaWMS) {
            this.mapa.removeLayer(this.capaWMS);
            this.capaWMS = null;
        }
        this.nodos = [];
    }
}
