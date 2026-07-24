/**
 * Controlador del Mapa (60% de la Vista)
 * Abstrae toda la manipulación directa de Leaflet y sus capas espaciales (Puntos, Calor y Coropletas).
 */
export class ControladorMapa {
    constructor(idContenedor) {
        this.idContenedor = idContenedor;
        this.mapa = null;
        this.controlLeyenda = null; // Control de leyenda Leaflet
        this.instanciaCapas = {
            puntos: null,
            puntosAgrupados: null,
            mapaCalor: null,
            coropletas: null, // Capa GeoJSON para coropletas
        };
        this.capaBaseActual = null;
        this.configMapasBase = null;
    }

    inicializar(centroCoords = { lat: -32.8, lng: -56.0 }, zoomInicial = 7) {
        if (this.mapa) return;

        this.mapa = L.map(this.idContenedor, {
            zoomAnimation: false,
            fadeAnimation: false,
            markerZoomAnimation: false,
            inertia: false,
            bounceAtZoomLimits: false,
        }).setView([centroCoords.lat, centroCoords.lng], zoomInicial);

        this.instanciaCapas.puntos = L.featureGroup();
        this.instanciaCapas.puntosAgrupados = L.markerClusterGroup();
        this.instanciaCapas.mapaCalor = L.heatLayer([], {
            radius: 30,
            blur: 6,
            maxZoom: 14,
        });

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
     * Actualiza las capas en el mapa segun la modalidad (Puntos, Calor o Coropletas)
     */
    async actualizarCapas(registros, config, campoTooltip = '', animar = true) {
        this.removerTodasLasCapasDeDatos();

        // Si la configuracion exige un mapa de coropletas/poligonos
        if (
            config?.tipoCapaCartografica === 'poligonos_coropletas' ||
            config?.capaGeografica
        ) {
            await this.actualizarCapaCoropletas(
                registros,
                config,
                campoTooltip
            );
            return;
        }

        // Lógica estándar para puntos / coordenadas
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
                this.mapa.fitBounds(bounds, {
                    padding: [20, 20],
                    animate: false,
                });
            } else {
                this.mapa.fitBounds(bounds, { padding: [20, 20] });
            }
        }
    }

    /**
     * Carga el GeoJSON y colorea los polígonos por conteo de departamento
     */
    async actualizarCapaCoropletas(registros, config, campoTooltip) {
        const configGeo = config.capaGeografica;
        if (!configGeo || !configGeo.fuente) {
            console.error(
                'No se definió capaGeografica en la configuración del tablero.'
            );
            return;
        }

        const campoCSV = (
            configGeo.campoClaveCSV || 'depto_hechos'
        ).toUpperCase();
        const campoGeoJSON = configGeo.campoClaveGeoJSON || 'nombre';

        // 1. Agrupar la cantidad de casos por departamento
        const conteoPorDepto = {};
        registros.forEach((r) => {
            const rUpper = Object.keys(r).reduce((acc, key) => {
                acc[key.toUpperCase()] = r[key];
                return acc;
            }, {});

            const valRaw = rUpper[campoCSV];
            if (!valRaw) return;

            const valNorm = this.normalizarTexto(valRaw);
            conteoPorDepto[valNorm] = (conteoPorDepto[valNorm] || 0) + 1;
        });

        const valores = Object.values(conteoPorDepto);
        const maxValor = valores.length > 0 ? Math.max(...valores) : 1;

        try {
            const respuesta = await fetch(configGeo.fuente);
            if (!respuesta.ok) {
                console.error(
                    `Error HTTP ${respuesta.status} cargando GeoJSON: ${configGeo.fuente}`
                );
                return;
            }
            const geojsonData = await respuesta.json();

            this.instanciaCapas.coropletas = L.geoJSON(geojsonData, {
                style: (feature) => {
                    const nombreGeo = feature.properties[campoGeoJSON];
                    const normGeo = this.normalizarTexto(nombreGeo);
                    const cantidad = conteoPorDepto[normGeo] || 0;

                    return {
                        fillColor: this.obtenerColorCoropleta(
                            cantidad,
                            maxValor
                        ),
                        fillOpacity: 0.75,
                        weight: 1.5,
                        opacity: 1,
                        color: '#FFFFFF',
                        dashArray: '2',
                    };
                },
                onEachFeature: (feature, layer) => {
                    const nombreGeo = feature.properties[campoGeoJSON] || '';
                    const normGeo = this.normalizarTexto(nombreGeo);
                    const cantidad = conteoPorDepto[normGeo] || 0;

                    layer.bindTooltip(
                        `
                        <div style="font-size: 13px; font-family: sans-serif;">
                            <strong>${nombreGeo}</strong><br/>
                            Casos: <strong>${cantidad.toLocaleString()}</strong>
                        </div>
                    `,
                        { sticky: true }
                    );

                    layer.on({
                        mouseover: (e) => {
                            const l = e.target;
                            l.setStyle({
                                weight: 3,
                                color: '#333333',
                                fillOpacity: 0.9,
                            });
                            l.bringToFront();
                        },
                        mouseout: (e) => {
                            if (this.instanciaCapas.coropletas) {
                                this.instanciaCapas.coropletas.resetStyle(
                                    e.target
                                );
                            }
                        },
                    });
                },
            });

            this.mapa.addLayer(this.instanciaCapas.coropletas);

            // DIBUJAR LEYENDA CARTOGRÁFICA
            this.actualizarLeyendaCoropletas(maxValor);

            const bounds = this.instanciaCapas.coropletas.getBounds();
            if (bounds.isValid()) {
                this.mapa.fitBounds(bounds, { padding: [20, 20] });
            }
        } catch (error) {
            console.error('Error al procesar el GeoJSON de coropletas:', error);
        }
    }

    /**
     * Dibuja la caja de leyenda en la esquina inferior derecha del mapa
     */
    actualizarLeyendaCoropletas(maxValor) {
        if (this.controlLeyenda) {
            this.mapa.removeControl(this.controlLeyenda);
        }

        this.controlLeyenda = L.control({ position: 'bottomright' });

        this.controlLeyenda.onAdd = () => {
            const div = L.DomUtil.create('div', 'leyenda-coropleta');
            L.DomEvent.disableClickPropagation(div);

            div.style.backgroundColor = '#FFFFFF';
            div.style.padding = '10px 14px';
            div.style.borderRadius = '8px';
            div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
            div.style.fontSize = '12px';
            div.style.fontFamily = 'sans-serif';
            div.style.lineHeight = '18px';
            div.style.color = '#1E293B';

            div.innerHTML = `<strong style="display:block; margin-bottom: 6px; font-size: 13px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">Escala de Casos (Ratio)</strong>`;

            const rangos = [
                {
                    etiqueta: '> 75% del máx.',
                    min: Math.round(maxValor * 0.75),
                    color: '#800026',
                },
                {
                    etiqueta: '50% - 75%',
                    min: Math.round(maxValor * 0.5),
                    color: '#BD0026',
                },
                {
                    etiqueta: '25% - 50%',
                    min: Math.round(maxValor * 0.25),
                    color: '#E31A1C',
                },
                {
                    etiqueta: '10% - 25%',
                    min: Math.round(maxValor * 0.1),
                    color: '#FC4E2A',
                },
                {
                    etiqueta: '2% - 10%',
                    min: Math.round(maxValor * 0.02),
                    color: '#FD8D3C',
                },
                { etiqueta: '< 2%', min: 1, color: '#FFEDA0' },
                { etiqueta: 'Sin registros', min: 0, color: '#F2F4F8' },
            ];

            rangos.forEach((item) => {
                const textoCasos =
                    item.min > 0 ? ` (≥ ${item.min.toLocaleString()})` : '';
                div.innerHTML += `
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                        <span style="width: 16px; height: 16px; background: ${item.color}; border: 1px solid #CBD5E1; display: inline-block; border-radius: 3px; flex-shrink: 0;"></span>
                        <span style="color: #475569;">${item.etiqueta} <strong>${textoCasos}</strong></span>
                    </div>
                `;
            });

            return div;
        };

        this.controlLeyenda.addTo(this.mapa);
    }

    normalizarTexto(str) {
        if (!str) return '';
        return str
            .toString()
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    obtenerColorCoropleta(valor, maximo) {
        if (!valor || valor === 0) return '#F2F4F8';
        const ratio = valor / (maximo || 1);

        if (ratio > 0.75) return '#800026';
        if (ratio > 0.5) return '#BD0026';
        if (ratio > 0.25) return '#E31A1C';
        if (ratio > 0.1) return '#FC4E2A';
        if (ratio > 0.02) return '#FD8D3C';
        return '#FFEDA0';
    }

    removerTodasLasCapasDeDatos() {
        if (this.controlLeyenda) {
            this.mapa.removeControl(this.controlLeyenda);
            this.controlLeyenda = null;
        }

        if (
            this.instanciaCapas.puntos &&
            this.mapa.hasLayer(this.instanciaCapas.puntos)
        ) {
            this.instanciaCapas.puntos.clearLayers();
            this.mapa.removeLayer(this.instanciaCapas.puntos);
        }

        if (
            this.instanciaCapas.puntosAgrupados &&
            this.mapa.hasLayer(this.instanciaCapas.puntosAgrupados)
        ) {
            this.instanciaCapas.puntosAgrupados.clearLayers();
            this.mapa.removeLayer(this.instanciaCapas.puntosAgrupados);
        }

        if (
            this.instanciaCapas.mapaCalor &&
            this.mapa.hasLayer(this.instanciaCapas.mapaCalor)
        ) {
            this.mapa.removeLayer(this.instanciaCapas.mapaCalor);
        }

        if (
            this.instanciaCapas.coropletas &&
            this.mapa.hasLayer(this.instanciaCapas.coropletas)
        ) {
            this.mapa.removeLayer(this.instanciaCapas.coropletas);
            this.instanciaCapas.coropletas = null;
        }
    }

    redimensionar() {
        if (!this.mapa) return;

        requestAnimationFrame(() => {
            if (!this.mapa) return;
            this.mapa.invalidateSize({ animate: false });
            requestAnimationFrame(() => {
                if (this.mapa) {
                    this.mapa.invalidateSize({ animate: false });
                }
            });
        });
    }
}
