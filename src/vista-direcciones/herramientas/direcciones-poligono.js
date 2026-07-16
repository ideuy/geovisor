/**
 * direcciones-poligono.js
 * Gestiona la búsqueda de direcciones y POIs dentro de un polígono dibujado por el usuario.
 */
export class DireccionesPoligono {
    constructor(mapa, servicioConfig, orquestador, parent) {
        if (!mapa) {
            orquestador.registrarDebug(
                '[DireccionesPoligono] ERROR: Mapa no recibido.'
            );
            return;
        }

        this.mapa = mapa;
        this.servicioConfig = servicioConfig;
        this.orquestador = orquestador;
        this.parent = parent;

        this.layerGroup = L.layerGroup();
        if (this.mapa) {
            this.layerGroup.addTo(this.mapa);
        }

        this.activo = false;
        this.puntos = [];
        this.capaPoligono = null;
        this.capasMarcadores = [];
        this.manejadorClickMapa = this.alHacerClickMapa.bind(this);

        this.manejadorZoom = this.actualizarEscalaPorZoom.bind(this);
        this.mapa.on('zoomend', this.manejadorZoom);
        this.actualizarEscalaPorZoom();

        this.iconos = {
            CALLEyPORTAL: L.divIcon({
                className: 'icon-escala-contenedor',
                html: '<div class="icon-escala-interno">🏠</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
            POI: L.divIcon({
                className: 'icon-escala-contenedor',
                html: '<div class="icon-escala-interno">📍</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
            DEFAULT: L.divIcon({
                className: 'icon-escala-contenedor',
                html: '<div class="icon-escala-interno">🔵</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
        };

        this.orquestador.registrarDebug(
            '[DireccionesPoligono] Instancia creada con soporte de escala adaptativa.'
        );
    }

    activar() {
        this.orquestador.registrarDebug(
            '[DireccionesPoligono] Activando herramienta.'
        );
        this.limpiarTodo();
        this.iniciarModoDibujo();
        this.orquestador.registrarDebug(
            '[DireccionesPoligono] Herramienta lista para dibujar directamente en el mapa.'
        );
    }

    actualizarEscalaPorZoom() {
        if (!this.mapa) return;
        const zoomActual = this.mapa.getZoom();
        this.mapa.getContainer().style.setProperty('--map-zoom', zoomActual);
    }

    iniciarModoDibujo() {
        if (this.activo) return;
        this.activo = true;
        this.mapa.getContainer().style.cursor = 'crosshair';
        this.mapa.on('click', this.manejadorClickMapa);
        this.orquestador.registrarDebug(
            '[DireccionesPoligono] Modo dibujo habilitado.'
        );
    }

    detenerModoDibujo() {
        if (!this.activo) return;
        this.activo = false;
        this.mapa.getContainer().style.cursor = '';
        this.mapa.off('click', this.manejadorClickMapa);
        this.orquestador.registrarDebug(
            '[DireccionesPoligono] Modo dibujo detenido.'
        );
    }

    alHacerClickMapa(evento) {
        const coordenada = evento.latlng;
        this.puntos.push(coordenada);

        if (!this.capaPoligono) {
            this.capaPoligono = L.polygon(this.puntos, {
                color: '#3388ff',
                weight: 2,
                fillColor: '#3388ff',
                fillOpacity: 0.2,
            }).addTo(this.layerGroup);
        } else {
            this.capaPoligono.setLatLngs(this.puntos);
        }

        const marcadorVertice = L.circleMarker(coordenada, {
            radius: 4,
            color: '#3388ff',
            fillColor: '#FFF',
            fillOpacity: 1,
        }).addTo(this.layerGroup);

        this.capasMarcadores.push(marcadorVertice);

        if (this.puntos.length >= 3) {
            this.mostrarBotonEjecucion();
        }
    }

    mostrarBotonEjecucion() {
        if (document.getElementById('btn-buscar-flotante')) return;

        const mapaDiv = this.mapa.getContainer();
        const btn = document.createElement('button');
        btn.id = 'btn-buscar-flotante';
        btn.className = 'btn-buscar-flotante';
        btn.innerHTML = '✔ Buscar en esta área';

        btn.addEventListener('click', async () => {
            const geojson = this.obtenerPoligonoDibujado();
            this.detenerModoDibujo();
            btn.remove();
            await this.buscarEnPoligono(geojson);
        });

        mapaDiv.appendChild(btn);
    }

    obtenerPoligonoDibujado() {
        if (!this.capaPoligono || this.puntos.length < 3) {
            return null;
        }
        const feature = this.capaPoligono.toGeoJSON();
        return feature.geometry;
    }

    async buscarEnPoligono(geojsonPoligono) {
        this.orquestador.registrarDebug(
            '[DireccionesPoligono] Iniciando búsqueda...'
        );
        document.body.style.cursor = 'wait';

        const config = this.servicioConfig;

        if (!config || !config['url-base'] || !config['url-servicio']) {
            this.orquestador.registrarDebug(
                '[DireccionesPoligono] ERROR: Configuración incompleta.'
            );
            alert('Error: La configuración del servicio no es válida.');
            document.body.style.cursor = 'default';
            return;
        }

        const baseUrl = config['url-base'].replace(/\/$/, '');
        const endpoint = config['url-servicio'];
        const url = new URL(`${baseUrl}${endpoint}`);

        const params = config.parametros;
        if (!params) {
            this.orquestador.registrarDebug(
                '[DireccionesPoligono] ERROR: Parámetros del servicio no encontrados.'
            );
            alert('Error: No se encontraron parámetros de configuración.');
            document.body.style.cursor = 'default';
            return;
        }

        const limit = params.limit;
        const tipoDirec = params.tipoDirec;

        this.orquestador.registrarDebug(
            `[DireccionesPoligono] Aplicando estrictos parámetros: limit=${limit}, tipo=${tipoDirec}`
        );

        url.searchParams.append('limit', limit);
        url.searchParams.append('tipoDirec', tipoDirec);
        url.searchParams.append('poligono', JSON.stringify(geojsonPoligono));

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            this.layerGroup.clearLayers();
            L.geoJSON(geojsonPoligono, {
                style: { color: '#3388ff', weight: 2, fillOpacity: 0.2 },
            }).addTo(this.layerGroup);

            if (data && data.length > 0) {
                this.renderizarMarcadores(data);
            } else {
                alert('No se encontraron resultados.');
            }
        } catch (error) {
            this.orquestador.registrarDebug(
                '[DireccionesPoligono] Error:',
                error
            );
            alert('Ocurrió un error al consultar.');
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    renderizarMarcadores(resultados) {
        const agrupados = {};

        resultados.forEach((item) => {
            if (item.lat == null || item.lng == null) return;
            const key = `${item.lat}_${item.lng}`;
            if (!agrupados[key]) agrupados[key] = [];
            agrupados[key].push(item);
        });

        Object.values(agrupados).forEach((grupo) => {
            const itemBase = grupo[0];
            let iconoUsar;

            if (grupo.length > 1) {
                iconoUsar = L.divIcon({
                    className: 'icon-escala-contenedor',
                    html: `<div class="icon-escala-interno marcador-multiple">🏢<span class="badge-multiple">${grupo.length}</span></div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                });
            } else {
                iconoUsar =
                    this.iconos[itemBase.type] || this.iconos['DEFAULT'];
            }

            let cuerpoPopup = '';

            if (grupo.length > 1) {
                cuerpoPopup = `
                    <div class="direcciones-popup-contenedor">
                        <h4 class="direcciones-popup-titulo">Direcciones Superpuestas (${grupo.length})</h4>
                        <div class="direcciones-popup-cuerpo" style="max-height: 200px; overflow-y: auto; padding-right: 5px;">
                            ${grupo
                                .map(
                                    (item, index) => `
                                <div style="${index > 0 ? 'border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px;' : ''}">
                                    <p style="margin:2px 0;"><strong>Dirección:</strong> ${item.address || 'N/A'}</p>
                                    <p><strong>Coordenadas:</strong> <span class="direcciones-popup-mono">${itemBase.lat.toFixed(6)}, ${itemBase.lng.toFixed(6)}</span></p>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>`;
            } else {
                let infoPuerta = itemBase.portalNumber || '';
                if (itemBase.letra) infoPuerta += ` ${itemBase.letra}`;

                cuerpoPopup = `
                    <h4 class="direcciones-popup-titulo">Detalle de la Dirección</h4>
                    <div class="direcciones-popup-cuerpo">
                        <p><strong>Dirección:</strong> ${itemBase.address || 'N/A'}</p>
                        <p><strong>Departamento:</strong> ${itemBase.departamento || 'N/A'}</p>
                        <p><strong>Localidad:</strong> ${itemBase.localidad || 'N/A'}</p>
                        <p><strong>Calle:</strong> ${itemBase.nomVia || 'N/A'}</p>
                        <p><strong>Puerta:</strong> ${infoPuerta || 'N/A'}</p>
                        <p><strong>Código Postal:</strong> ${itemBase.postalCode || 'N/A'}</p>
                        <p><strong>Coordenadas:</strong> <span class="direcciones-popup-mono">${itemBase.lat.toFixed(6)}, ${itemBase.lng.toFixed(6)}</span></p>
                        <p><strong>Observación:</strong> <span class="direcciones-popup-obs">${itemBase.stateMsg || 'Sin observaciones'}</span></p>
                    </div>
                `;
            }

            const marcador = L.marker([itemBase.lat, itemBase.lng], { icon: iconoUsar })
                .bindPopup(cuerpoPopup)
                .addTo(this.layerGroup);

            marcador.on('click', () => {
                if (this.parent) {
                    this.parent.candidatoActual = {
                        punto: { lat: itemBase.lat, lng: itemBase.lng },
                        datos: itemBase
                    };
                    
                    this.orquestador.registrarDebug(
                        'DireccionesPoligono',
                        `Candidato activo actualizado desde marcador del polígono: ${itemBase.address || 'N/A'}`
                    );

                    const electoralActivo = document.getElementById('mod-electoral')?.checked;
                    const mapillaryActivo = document.getElementById('mod-mapillary')?.checked;

                    if (electoralActivo && this.parent.serieElectoral) {
                        this.parent.activarHerramienta(
                            'serieElectoral',
                            this.parent.configCapaElectoral,
                            this.parent.serieElectoral.constructor
                        );
                    }
                    if (mapillaryActivo && this.parent.mapillaryHerramienta) {
                        this.parent.mapillaryHerramienta.mostrarEntorno(itemBase.lat, itemBase.lng);
                    }
                }
            });
        });
    }

    desactivar() {
        this.limpiarTodo();
    }

    limpiarTodo() {
        this.detenerModoDibujo();

        const btnFlotante = document.getElementById('btn-buscar-flotante');
        if (btnFlotante) btnFlotante.remove();

        if (this.layerGroup) {
            this.layerGroup.clearLayers();
        }

        this.puntos = [];
        this.capaPoligono = null;
        this.capasMarcadores = [];

        this.orquestador.registrarDebug(
            '[DireccionesPoligono] Estado y capas limpiadas.'
        );
    }
}