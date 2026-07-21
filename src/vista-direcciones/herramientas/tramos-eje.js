/**
 * tramos-eje.js
 * Herramienta para localizar, dibujar y analizar topológicamente los tramos de una calle.
 */
export class TramosEje {
    constructor(mapa, servicioConfig, orquestador, parent) {
        this.mapa = mapa;
        this.servicioConfig = servicioConfig;
        this.orquestador = orquestador;
        this.parent = parent;

        this.layerGroup = L.layerGroup();
        if (this.mapa) {
            this.layerGroup.addTo(this.mapa);
        }

        this.activo = false;
        this.datosBuscadorOrig = null;

        this.orquestador.info('Tramos Eje', 'Herramienta creada con éxito.');
    }

    activar() {
        this.orquestador.debug('Tramos Eje', 'Activando herramienta.');

        this.activo = true;
        this.layerGroup.clearLayers();

        const inputBuscador = document.getElementById(
            'input-busqueda-direcciones'
        );

        if (inputBuscador) {
            this.datosBuscadorOrig = {
                placeholder: inputBuscador.placeholder,
                fondoInput: inputBuscador.style.backgroundColor,
            };

            const colorResaltado = '#d4e6f1';

            inputBuscador.style.backgroundColor = colorResaltado;
            inputBuscador.placeholder =
                'Ej: liniers, mont │ Ej: 18 de julio, rocha';
            inputBuscador.value = '';

            inputBuscador.focus();
        }
    }

    limpiarTodo() {
        if (this.layerGroup) {
            this.layerGroup.clearLayers();
        }

        const inputBuscador = document.getElementById(
            'input-busqueda-direcciones'
        );

        if (this.datosBuscadorOrig && inputBuscador) {
            inputBuscador.style.backgroundColor = this.datosBuscadorOrig.fondoInput;
            inputBuscador.placeholder = this.datosBuscadorOrig.placeholder;
        }

        this.activo = false;
        this.orquestador.debug(
            'Tramos Eje', 'Limpieza completa de mapa y estilos completa.'
        );
    }

    desactivar() {
        this.limpiarTodo();
    }

    async procesarSeleccion(itemCandidato) {
        this.orquestador.debug(
            'Tramos Eje', 'Procesando candidato seleccionado.'
        );

        const idCalle = itemCandidato.idCalle;

        if (!idCalle) {
            this.orquestador.warn(
                'Tramos Eje',
                'El candidato seleccionado no posee un idCalle válido: ',
                itemCandidato.idCalle
            );
            return;
        }

        if (!this.servicioConfig) {
            this.orquestador.warn(
                'Tramos Eje',
                'Servicio tramosCalle no configurado en direcciones.json'
            ); 
            return;
        }

        document.body.style.cursor = 'wait';
        this.layerGroup.clearLayers();

        try {
            const urlBase = this.parent.configApi['url-base'] || '';
            const endpoint = this.servicioConfig['url-servicio'] || '';
            const baseClean = urlBase.endsWith('/')
                ? urlBase.slice(0, -1)
                : urlBase;
            const servicioClean = endpoint.startsWith('/')
                ? endpoint
                : '/' + endpoint;

            const params = new URLSearchParams();
            if (this.servicioConfig.parametros) {
                Object.keys(this.servicioConfig.parametros).forEach((clave) => {
                    if (clave === 'idcalle' || clave === 'idCalle') {
                        params.append(clave, idCalle);
                    } else {
                        params.append(
                            clave,
                            this.servicioConfig.parametros[clave]
                        );
                    }
                });
            }

            const urlCompleta = `${baseClean}${servicioClean}?${params.toString()}`;
            const respuesta = await fetch(urlCompleta);

            if (!respuesta.ok)
                this.orquestador.throw(
                    'Tramos Ejes',
                    `HTTP status ${respuesta.status}`
                );

            const geojson = await respuesta.json();

            if (!geojson.features || geojson.features.length === 0) {
                this.orquestador.warn(
                    'Tramos Ejes',
                    'No se encontraron tramos topológicos para esta calle.'
                );
                return;
            }
            this.renderizarTramos(geojson, itemCandidato);
        } catch (error) {
            this.orquestador.error(
                'Tramos Ejes',
                'Error al consultar los tramos: ', error
            );
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    renderizarTramos(geojson, infoCandidato) {
        const redTopologica = this.extraerExtremosRed(geojson);

        let iteradorColor = 0;
        const colores = ['#ff573d', '#0070d1']; 

        const capaGeoJSON = L.geoJSON(geojson, {
            style: (feature) => {
                const color = colores[iteradorColor % 2];
                iteradorColor++;
                return {
                    color: color,
                    weight: 5,
                    opacity: 0.8,
                    lineCap: 'round',
                };
            },
            onEachFeature: (feature, layer) => {
                const analisis = this.analizarGeometria(feature, redTopologica);

                const contenidoPopup = this.construirPopupHTML(
                    feature,
                    infoCandidato,
                    analisis
                );
                layer.bindPopup(contenidoPopup);

                layer.on('mouseover', function () {
                    this.setStyle({ weight: 8, opacity: 1 });
                });
                layer.on('mouseout', function () {
                    this.setStyle({ weight: 5, opacity: 0.8 });
                });
            },
        });

        capaGeoJSON.addTo(this.layerGroup);

        if (capaGeoJSON.getBounds().isValid()) {
            this.mapa.fitBounds(capaGeoJSON.getBounds(), { padding: [50, 50] });
        }
    }

    extraerExtremosRed(geojson) {
        const nodosUnicos = new Set();

        geojson.features.forEach((feature) => {
            const coords = feature.geometry.coordinates;
            let start, end;

            if (feature.geometry.type === 'MultiLineString') {
                const firstLine = coords[0];
                const lastLine = coords[coords.length - 1];
                start = firstLine[0];
                end = lastLine[lastLine.length - 1];
            } else if (feature.geometry.type === 'LineString') {
                start = coords[0];
                end = coords[coords.length - 1];
            }

            if (start)
                nodosUnicos.add(
                    `${start[0].toFixed(5)},${start[1].toFixed(5)}`
                );
            if (end)
                nodosUnicos.add(`${end[0].toFixed(5)},${end[1].toFixed(5)}`);
        });

        return nodosUnicos;
    }

    analizarGeometria(feature, redTopologica) {
        let longitudMetros = 0;
        let cantidadNodos = 0;
        let coordsPlanos = [];

        const geom = feature.geometry;

        if (geom.type === 'MultiLineString') {
            geom.coordinates.forEach((linea) => {
                linea.forEach((pt) => coordsPlanos.push([pt[1], pt[0]]));
            });
        } else if (geom.type === 'LineString') {
            geom.coordinates.forEach((pt) => coordsPlanos.push([pt[1], pt[0]]));
        }

        cantidadNodos = coordsPlanos.length;

        if (cantidadNodos < 2)
            return {
                longitud: 0,
                nodos: cantidadNodos,
                sinuosidad: 'Desconocida',
                orientacion: 'Punto',
                conectividad: 'Desconectado',
            };

        for (let i = 0; i < coordsPlanos.length - 1; i++) {
            const p1 = L.latLng(coordsPlanos[i][0], coordsPlanos[i][1]);
            const p2 = L.latLng(coordsPlanos[i + 1][0], coordsPlanos[i + 1][1]);
            longitudMetros += this.mapa.distance(p1, p2);
        }

        const pInicio = L.latLng(coordsPlanos[0][0], coordsPlanos[0][1]);
        const pFin = L.latLng(
            coordsPlanos[coordsPlanos.length - 1][0],
            coordsPlanos[coordsPlanos.length - 1][1]
        );
        const distanciaRecta = this.mapa.distance(pInicio, pFin);

        let indiceSinuosidad = 1;
        if (distanciaRecta > 0)
            indiceSinuosidad = longitudMetros / distanciaRecta;

        let etiquetaSinuosidad = 'Tramo recto';
        if (indiceSinuosidad > 1.15 && indiceSinuosidad <= 1.4)
            etiquetaSinuosidad = 'Tramo sinuoso';
        else if (indiceSinuosidad > 1.4)
            etiquetaSinuosidad = 'Tramo muy sinuoso';

        const dLng = ((pFin.lng - pInicio.lng) * Math.PI) / 180;
        const lat1 = (pInicio.lat * Math.PI) / 180;
        const lat2 = (pFin.lat * Math.PI) / 180;

        const y = Math.sin(dLng) * Math.cos(lat2);
        const x =
            Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        let orientacionGrados = (Math.atan2(y, x) * 180) / Math.PI;
        orientacionGrados = (orientacionGrados + 360) % 360;

        const etiquetaOrientacion = this.obtenerRosaVientos(
            orientacionGrados,
            indiceSinuosidad
        );

        let conexiones = 0;

        const lngIni =
            geom.type === 'MultiLineString'
                ? geom.coordinates[0][0][0]
                : geom.coordinates[0][0];
        const latIni =
            geom.type === 'MultiLineString'
                ? geom.coordinates[0][0][1]
                : geom.coordinates[0][1];

        const ultLinea =
            geom.type === 'MultiLineString'
                ? geom.coordinates[geom.coordinates.length - 1]
                : geom.coordinates;
        const lngFin = ultLinea[ultLinea.length - 1][0];
        const latFin = ultLinea[ultLinea.length - 1][1];

        const hashIni = `${lngIni.toFixed(5)},${latIni.toFixed(5)}`;
        const hashFin = `${lngFin.toFixed(5)},${latFin.toFixed(5)}`;

        let etiquetaConectividad = 'Conectado';

        if (redTopologica.size <= 2)
            etiquetaConectividad = 'Ambos vértices desconectados (Fin de vía)';

        return {
            longitud: longitudMetros.toFixed(1),
            nodos: cantidadNodos,
            sinuosidad: etiquetaSinuosidad,
            orientacion: etiquetaOrientacion,
            conectividad: etiquetaConectividad,
        };
    }

    obtenerRosaVientos(grados, sinuosidad) {
        if (sinuosidad > 1.4) return 'Describe una curva';

        const rumbos = [
            'Norte',
            'Norte-Noreste',
            'Noreste',
            'Este-Noreste',
            'Este',
            'Este-Sureste',
            'Sureste',
            'Sur-Sureste',
            'Sur',
            'Sur-Suroeste',
            'Suroeste',
            'Oeste-Suroeste',
            'Oeste',
            'Oeste-Noroeste',
            'Noroeste',
            'Norte-Noroeste',
        ];
        const indice = Math.round((grados % 360) / 22.5);
        return rumbos[indice % 16];
    }

    construirPopupHTML(feature, candidato, analisis) {
        const props = feature.properties;
        return `
            <div class="direcciones-popup-contenedor">
                <h4 class="direcciones-popup-titulo">Detalle del Tramo</h4>
                <div class="direcciones-popup-cuerpo">
                    <p><strong>Departamento:</strong> ${candidato.departamento || 'N/A'}</p>
                    <p><strong>Localidad:</strong> ${candidato.localidad || 'N/A'}</p>
                    <p><strong>Calle:</strong> ${candidato.nomVia || candidato.address || 'N/A'}</p>
                    <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                    <p><strong>ID Calle:</strong> ${props.idcalle || 'N/A'}</p>
                    <p><strong>ID Tramo:</strong> ${props.gid || 'N/A'}</p>
                    <p><strong>ID Tipo Vialidad:</strong> ${props.tipo_vialidad_id || 'N/A'}</p>
                    <p><strong>ID Propietario (Fuente):</strong> ${props.fuente_id || 'N/A'}</p>
                    <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                    <p><strong>Longitud:</strong> ${analisis.longitud} metros</p>
                    <p><strong>Cantidad de Nodos:</strong> ${analisis.nodos}</p>
                    <p><strong>Orientación:</strong> ${analisis.orientacion}</p>
                    <p><strong>Sinuosidad:</strong> ${analisis.sinuosidad}</p>
                    <p><strong>Conectividad:</strong> ${analisis.conectividad}</p>
                </div>
            </div>
        `;
    }
}
