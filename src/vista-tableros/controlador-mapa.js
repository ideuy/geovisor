/**
 * Controlador del Mapa (60% de la Vista)
 * Abstrae toda la manipulación directa de Leaflet y sus capas espaciales.
 */
export class ControladorMapa {
    constructor(idContenedor) {
        this.idContenedor = idContenedor;
        this.mapa = null;
        this.instanciaCapas = {
            puntos: null,
            puntosAgrupados: null,
            mapaCalor: null,
        };
        this.capaBaseActual = null;
        this.configMapasBase = null;
    }

    inicializar(centroCoords = { lat: -32.8, lng: -56.0 }, zoomInicial = 7) {
        if (this.mapa) return;

        this.mapa = L.map(this.idContenedor).setView(
            [centroCoords.lat, centroCoords.lng],
            zoomInicial
        );

        this.instanciaCapas.puntos = L.featureGroup();
        this.instanciaCapas.puntosAgrupados = L.markerClusterGroup();
        this.instanciaCapas.mapaCalor = L.heatLayer([], {
            radius: 30,
            blur: 6,
            maxZoom: 14,
        });

        // Patch defensivo para leaflet-heat
        if (this.instanciaCapas.mapaCalor) {
            const redrawOriginal = this.instanciaCapas.mapaCalor._redraw;
            this.instanciaCapas.mapaCalor._redraw = function (...args) {
                if (
                    !this._map ||
                    !this._map.getSize() ||
                    this._map.getSize().y === 0 ||
                    this._map.getSize().x === 0
                ) {
                    return;
                }
                return redrawOriginal.apply(this, args);
            };
        }
    }

    cambiarMapaBase(idMapaBase, mapasBaseJson) {
        if (!this.mapa) return;

        if (mapasBaseJson && mapasBaseJson.mapasBase) {
            this.configMapasBase = mapasBaseJson.mapasBase;
        }

        if (!this.configMapasBase) return;

        const proveedores = this.configMapasBase.proveedores || {};
        let mapaElegido = proveedores[idMapaBase];

        if (!mapaElegido) {
            const configDefecto = this.configMapasBase.configMapa || {};
            mapaElegido = {
                url:
                    configDefecto.urlDefault ||
                    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                opciones: configDefecto.opcionesDefault || {
                    attribution: '© OpenStreetMap contributors',
                },
            };
        }

        if (this.capaBaseActual) {
            this.mapa.removeLayer(this.capaBaseActual);
        }

        this.capaBaseActual = L.tileLayer(
            mapaElegido.url,
            mapaElegido.opciones || {}
        );
        this.capaBaseActual.addTo(this.mapa);
        this.capaBaseActual.bringToBack();
    }

    /**
     * Actualiza las capas con una transición suave.
     * @param {boolean} animar - Si es true, usa flyToBounds en lugar de fitBounds
     */
    actualizarCapas(registros, config, campoTooltip = '', animar = true) {
        this.removerTodasLasCapasDeDatos();

        const crsOrigen = config?.crs || 'EPSG:4326';
        const modoVisualizacion = config?.visualizacion || 'puntos';

        const UTM21S =
            '+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs';
        const WGS84 = 'EPSG:4326';

        const campoLng = (config.longitud || 'longitud').toUpperCase();
        const campoLat = (config.latitud || 'latitud').toUpperCase();

        const campoTooltipMayuscula = campoTooltip
            ? campoTooltip.toUpperCase()
            : '';

        const registrosValidos = [];

        registros.forEach((r) => {
            const rUpper = Object.keys(r).reduce((acc, key) => {
                acc[key.toUpperCase()] = r[key];
                return acc;
            }, {});

            const rawLng = parseFloat(rUpper[campoLng]);
            const rawLat = parseFloat(rUpper[campoLat]);

            if (isNaN(rawLng) || isNaN(rawLat)) return;

            let valLat = rawLat;
            let valLng = rawLng;

            if (crsOrigen === 'EPSG:32721') {
                const reprojected = proj4(UTM21S, WGS84, [rawLng, rawLat]);
                valLng = reprojected[0];
                valLat = reprojected[1];
            }

            if (valLat < -90 || valLat > 90 || valLng < -180 || valLng > 180) {
                console.warn(
                    `Coordenada fuera de rango ignorada: Lat ${valLat}, Lng ${valLng}`
                );
                return;
            }

            registrosValidos.push({
                datosRaw: rUpper,
                lat: valLat,
                lng: valLng,
            });
        });

        if (registrosValidos.length === 0) return;

        const marcadoresSimples = [];
        const datosCalor = [];

        registrosValidos.forEach((item) => {
            const { lat, lng, datosRaw } = item;
            const contenidoPopup =
                campoTooltipMayuscula && datosRaw[campoTooltipMayuscula]
                    ? `<strong>${campoTooltip}:</strong> ${datosRaw[campoTooltipMayuscula]}`
                    : `<strong>Coordenadas:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

            const marcador = L.marker([lat, lng]).bindPopup(contenidoPopup);
            marcadoresSimples.push(marcador);
            datosCalor.push([lat, lng, 1.0]);
        });

        if (modoVisualizacion === 'puntos') {
            marcadoresSimples.forEach((m) =>
                this.instanciaCapas.puntos.addLayer(m)
            );
            this.mapa.addLayer(this.instanciaCapas.puntos);
        } else if (modoVisualizacion === 'puntosAgrupados') {
            this.instanciaCapas.puntosAgrupados.addLayers(marcadoresSimples);
            this.mapa.addLayer(this.instanciaCapas.puntosAgrupados);
        } else if (modoVisualizacion === 'mapaCalor') {
            this.mapa.addLayer(this.instanciaCapas.mapaCalor);
            this.instanciaCapas.mapaCalor.setLatLngs(datosCalor);
        }

        if (marcadoresSimples.length > 0) {
            const grupoTemporal = L.featureGroup(marcadoresSimples);
            const bounds = grupoTemporal.getBounds();

            if (animar) {
                this.mapa.flyToBounds(bounds, {
                    padding: [20, 20],
                    duration: 0.8, // Animación suave de 800ms
                });
            } else {
                this.mapa.fitBounds(bounds, { padding: [20, 20] });
            }
        }
    }

    removerTodasLasCapasDeDatos() {
        if (this.mapa.hasLayer(this.instanciaCapas.puntos)) {
            this.instanciaCapas.puntos.clearLayers();
            this.mapa.removeLayer(this.instanciaCapas.puntos);
        }

        if (this.mapa.hasLayer(this.instanciaCapas.puntosAgrupados)) {
            this.instanciaCapas.puntosAgrupados.clearLayers();
            this.mapa.removeLayer(this.instanciaCapas.puntosAgrupados);
        }

        if (this.mapa.hasLayer(this.instanciaCapas.mapaCalor)) {
            this.mapa.removeLayer(this.instanciaCapas.mapaCalor);
        }
    }

    redimensionar() {
        if (this.mapa) this.mapa.invalidateSize();
    }
}
