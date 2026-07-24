/**
 * busqueda-inversa.js
 * Gestiona la búsqueda de direcciones.
 */
export class BusquedaInversa {
    constructor(mapa, servicioConfig, orquestador, parent) {
        this.orquestador = orquestador;
        this.servicioConfig = servicioConfig;
        this.parent = parent;

        if (!mapa) {
            this.orquestador.warn('Búsqueda Inversa', 'Mapa no recibido.');
            return;
        }

        this.mapa = mapa;
        this.layerGroup = L.layerGroup();
        this.layerGroup.addTo(this.mapa);

        this.limpiezaExtra = null;
        this.puntoClick = null;
        this.routingControl = null;
        this.manejadorClickMapa = this.manejarClickMapa.bind(this);

        this.iconos = {
            CALLEyPORTAL: L.divIcon({
                className: 'icon-escala-contenedor',
                html: '<div class="icon-escala-interno">🏠</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
            POI: L.divIcon({
                className: 'icon-escala-contenedor',
                html: '<div class="icon-escala-interno">📌</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
            DEFAULT: L.divIcon({
                className: 'icon-escala-contenedor',
                html: '<div class="icon-escala-interno">🔵</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
            OBJETIVO: L.divIcon({
                className: '',
                html: '<span style="color:#1500ff;font-size:24px;line-height:1;">◉</span>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12],
            }),
            MULTIPLE: L.divIcon({
                className: 'icon-escala-contenedor',
                html: `<div class="icon-escala-interno marcador-multiple">🏢</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            }),
        };

        this.mapa.on('popupopen', (e) => {
            const btn = e.popup
                .getElement()
                ?.querySelector('.direcciones-btn-trazar-cruce');
            if (btn) {
                btn.onclick = () => {
                    const lat = parseFloat(
                        String(btn.dataset.lat).replace(',', '.')
                    );
                    const lng = parseFloat(
                        String(btn.dataset.lng).replace(',', '.')
                    );

                    if (!isNaN(lat) && !isNaN(lng)) {
                        this.trazarRecorrido(L.latLng(lat, lng));
                    } else {
                        this.orquestador.error(
                            'Búsqueda Inversa',
                            `Coordenadas inválidas en botón: lat=${btn.dataset.lat}, lng=${btn.dataset.lng}`
                        );
                    }
                };
            }
        });
        this.orquestador.info(
            'Búsqueda Inversa',
            'Herramienta creada con éxito.'
        );
    }

    activar() {
        this.limpiarTodo();
        this.mapa.getContainer().style.cursor = 'crosshair';
        this.mapa.once('click', this.manejadorClickMapa);
    }

    desactivar() {
        this.mapa.off('click', this.manejadorClickMapa);
        this.mapa.getContainer().style.cursor = '';
        this.limpiarTodo();
    }

    async manejarClickMapa(e) {
        this.mapa.getContainer().style.cursor = '';
        this.puntoClick = e.latlng;

        try {
            const urlBase = this.servicioConfig['url-base'].replace(/\/$/, '');
            const urlServicio = this.servicioConfig['url-servicio'];
            const url = new URL(`${urlBase}${urlServicio}`);

            url.searchParams.append('latitud', e.latlng.lat);
            url.searchParams.append('longitud', e.latlng.lng);
            url.searchParams.append(
                'limit',
                this.servicioConfig.parametros?.limit || '50'
            );

            const response = await fetch(url);

            if (!response.ok) {
                this.orquestador.throwError(
                    'Búsqueda Inversa',
                    `Error en el servicio de búsqueda inversa: ${response.status} ${response.statusText}`
                );
            }

            const data = await response.json();

            if (data && data.length > 0) {
                this.renderizarResultados(e.latlng, data);
            } else {
                this.pintarPuntoObjetivo(e.latlng);
                this.mapa.setView(e.latlng, 17);
            }
        } catch (error) {
            this.orquestador.error('Búsqueda Inversa', 'Error: ', error);
        }
    }

    pintarPuntoObjetivo(latlng) {
        const popup = `
            <div class="direcciones-popup-contenedor">
                <h4 class="direcciones-popup-titulo">Punto Objetivo</h4>
                <div class="direcciones-popup-cuerpo">
                    <p><strong>Coordenadas:</strong> ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}</p>
                </div>
            </div>`;
        L.marker(latlng, { icon: this.iconos.OBJETIVO })
            .bindPopup(popup, { autoClose: false, closeOnClick: false })
            .addTo(this.layerGroup)
            .openPopup();
    }

    renderizarResultados(puntoClick, resultados) {
        if (this.layerGroup) this.layerGroup.clearLayers();
        const bounds = L.latLngBounds([puntoClick]);

        this.pintarPuntoObjetivo(puntoClick);

        const agrupados = {};
        resultados.forEach((item) => {
            if (!item.lat || !item.lng) return;
            const key = `${item.lat.toFixed(6)}_${item.lng.toFixed(6)}`;
            if (!agrupados[key]) agrupados[key] = [];
            agrupados[key].push(item);
        });

        Object.values(agrupados).forEach((grupo) => {
            const itemBase = grupo[0];
            const pos = L.latLng(itemBase.lat, itemBase.lng);
            bounds.extend(pos);

            let iconoUsar;
            let cuerpoPopup = '';

            if (grupo.length > 1) {
                iconoUsar = L.divIcon({
                    className: 'icon-escala-contenedor',
                    html: `<div class="icon-escala-interno marcador-multiple">🏢<span class="badge-multiple">${grupo.length}</span></div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                });

                cuerpoPopup = `
                    <div class="direcciones-popup-contenedor">
                        <h4 class="direcciones-popup-titulo">Direcciones Superpuestas (${grupo.length})</h4>
                        <div class="direcciones-popup-cuerpo" style="max-height: 200px; overflow-y: auto; padding-right: 5px;">
                            ${grupo
                                .map(
                                    (item, index) => `
                                <div style="${index > 0 ? 'border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px;' : ''}">
                                    <p style="margin:2px 0;"><strong>Dirección:</strong> ${item.address || 'N/A'}</p>
                                    <p><strong>Coordenadas:</strong> <span class="direcciones-popup-mono">${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}</span></p>
                                </div>`
                                )
                                .join('')}
                        </div>
                    </div>`;
            } else {
                iconoUsar =
                    this.iconos[itemBase.type] || this.iconos['DEFAULT'];

                let infoPuerta = itemBase.portalNumber || '';
                if (itemBase.letra) infoPuerta += ` ${itemBase.letra}`;

                cuerpoPopup = `
                    <div class="direcciones-popup-contenedor">
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
                        ${
                            puntoClick.distanceTo(pos) > 500
                                ? `
                            <button class="direcciones-btn-trazar-cruce" data-lat="${pos.lat}" data-lng="${pos.lng}">Trazar Recorrido</button>
                        `
                                : ''
                        }
                    </div>`;
            }

            const marcador = L.marker(pos, { icon: iconoUsar }).bindPopup(
                cuerpoPopup
            );

            marcador.on('click', () => {
                this.parent.candidatoActual = { punto: pos, datos: itemBase };
            });

            marcador.addTo(this.layerGroup);

            const dist = puntoClick.distanceTo(pos);
            if (dist > 0) {
                const line = L.polyline([puntoClick, pos], {
                    color: '#64748b',
                    weight: 1.5,
                    dashArray: '5, 5',
                }).addTo(this.layerGroup);

                line.bindTooltip(
                    `${dist >= 1000 ? (dist / 1000).toFixed(2) + ' km' : Math.round(dist) + ' m'}`,
                    { permanent: true, direction: 'center' }
                );
            }
        });

        if (bounds.isValid()) {
            this.mapa.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
        }
    }

    trazarRecorrido(destino) {
        if (!this.puntoClick) return;
        if (this.routingControl) this.mapa.removeControl(this.routingControl);

        this.routingControl = L.Routing.control({
            waypoints: [this.puntoClick, destino],
            createMarker: () => null,
            addWaypoints: false,
            show: false,
        }).addTo(this.mapa);
    }

    limpiarTodo() {
        if (this.layerGroup) this.layerGroup.clearLayers();
        if (this.routingControl) {
            this.mapa.removeControl(this.routingControl);
            this.routingControl = null;
        }
    }
}
