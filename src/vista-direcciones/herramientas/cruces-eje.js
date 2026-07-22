/**
 * cruces-eje.js
 * Herramienta avanzada para localizar intersecciones (esquinas) de una vía.
 */
export class CrucesEje {
    constructor(mapa, servicioConfig, orquestador, parent) {
        this.mapa = mapa;
        this.servicioConfig = servicioConfig;
        this.orquestador = orquestador;
        this.parent = parent;

        this.layerGroup = L.featureGroup();
        if (this.mapa) {
            this.layerGroup.addTo(this.mapa);
        }

        this.activo = false;
        this.datosBuscadorOrig = null;

        this.orquestador.info('Cruces Eje', 'Herramienta creada con éxito.');
    }

    activar() {
        this.orquestador.debug(
            'Cruces Eje', 'Activando herramienta de cruces ejes.'
        );
        this.activo = true;
        this.layerGroup.clearLayers();

        const inputBuscador = document.getElementById(
            'input-busqueda-direcciones'
        );

        if (inputBuscador) {
            this.datosBuscadorOrig = {
                placeholder: inputBuscador.placeholder,
                fondoInput: inputBuscador.style.backgroundColor || '',
            };

            const colorResaltado = '#e2f0d9';

            inputBuscador.style.backgroundColor = colorResaltado;
            inputBuscador.placeholder =
                'Ej: liniers, montevideo │ Ej: 18 de julio, rocha';
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
            inputBuscador.style.backgroundColor =
                this.datosBuscadorOrig.fondoInput;
            inputBuscador.placeholder = this.datosBuscadorOrig.placeholder;
        }

        this.activo = false;
        this.orquestador.debug(
            'Cruces Eje','Limpieza completa de mapa y estilos realizada.'
        );
    }

    desactivar() {
        this.limpiarTodo();
    }

    async procesarSeleccion(itemCandidato) {
        this.orquestador.debug(
            'Cruces Eje', 'Procesando candidato seleccionado'
        );

        const idCalle =
            itemCandidato.idCalle || itemCandidato.idcalle || itemCandidato.id;
        if (!idCalle) {
            this.orquestador.throwError(
                'Cruces Eje',
                'El candidato seleccionado no posee un identificador de calle válido (idCalle).'
            );
            return;
        }

        const configGlobal = this.parent.configApi || {};
        const apiDirecciones = configGlobal.apiDirecciones
            ? configGlobal.apiDirecciones
            : configGlobal;

        const urlBase = apiDirecciones['url-base'] || '';
        const configTramos = apiDirecciones.servicios?.find(
            (s) => s.idServicio === 'tramosCalle'
        );
        const configCruces =
            apiDirecciones.servicios?.find(
                (s) => s.idServicio === 'crucesPorIdCalle'
            ) || this.servicioConfig;

        if (!configTramos || !configCruces) {
            this.orquestador.throwError(
                'Cruces Ejes',
                'Error: No se encontraron las definiciones de tramosCalle o crucesPorIdCalle.'
            );
            return;
        }

        document.body.style.cursor = 'wait';
        this.layerGroup.clearLayers();

        try {
            const paramsTramos = new URLSearchParams();
            paramsTramos.append('idCalle', idCalle);
            paramsTramos.append('idcalle', idCalle);

            const paramsCruces = new URLSearchParams();
            paramsCruces.append('idCalle', idCalle);
            paramsCruces.append('idcalle', idCalle);

            let baseUrl = urlBase;
            let epTramos = configTramos['url-servicio'] || '';
            if (baseUrl.endsWith('/') && epTramos.startsWith('/'))
                epTramos = epTramos.substring(1);
            else if (!baseUrl.endsWith('/') && !epTramos.startsWith('/'))
                baseUrl += '/';
            const urlTramos = `${baseUrl}${epTramos}?${paramsTramos.toString()}`;

            baseUrl = urlBase;
            let epCruces = configCruces['url-servicio'] || '';
            if (baseUrl.endsWith('/') && epCruces.startsWith('/'))
                epCruces = epCruces.substring(1);
            else if (!baseUrl.endsWith('/') && !epCruces.startsWith('/'))
                baseUrl += '/';
            const urlCruces = `${baseUrl}${epCruces}?${paramsCruces.toString()}`;

            const [resTramos, resCruces] = await Promise.all([
                fetch(urlTramos),
                fetch(urlCruces),
            ]);

            if (!resTramos.ok || !resCruces.ok) {
                this.orquestador.throwError(
                    'Cruces Ejes',
                    `Error en endpoints remotos (Status Tramos: ${resTramos.status}, Cruces: ${resCruces.status})`
                );
            }

            const geojsonTramos = await resTramos.json();
            const datosCruces = await resCruces.json();

            this.dibujarResultadosCombinados(
                itemCandidato,
                geojsonTramos,
                datosCruces
            );
        } catch (error) {
            this.orquestador.error('Cruces Eje', 'Error al Procesar Esquinas: ', error);
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    dibujarResultadosCombinados(
        candidatoPrincipal,
        geojsonTramos,
        listaCruces
    ) {
        if (
            geojsonTramos &&
            geojsonTramos.features &&
            geojsonTramos.features.length > 0
        ) {
            const capaEjePrincipal = L.geoJSON(geojsonTramos, {
                style: { color: '#2980b9', weight: 6, opacity: 0.85 },
            });

            const popupPrincipal = `
                <div class="direcciones-popup-contenedor">
                    <h4 class="direcciones-popup-titulo">Calle buscada</h4>
                    <div class="direcciones-popup-cuerpo">
                        <p><strong>Departamento:</strong> ${candidatoPrincipal.departamento || 'N/A'}</p>
                        <p><strong>Localidad:</strong> ${candidatoPrincipal.localidad || 'N/A'}</p>
                        <p><strong>Calle:</strong> ${candidatoPrincipal.nomVia || 'N/A'}</p>
                        <p><strong>ID Calle:</strong> ${candidatoPrincipal.idCalle || candidatoPrincipal.idcalle || 'N/A'}</p>
                    </div>
                </div>
            `;
            capaEjePrincipal.bindPopup(popupPrincipal);
            capaEjePrincipal.addTo(this.layerGroup);
        }

        if (Array.isArray(listaCruces)) {
            listaCruces.forEach((cruce) => {
                if (!cruce.lat || !cruce.lng) return;

                const marcadorEsquina = L.circleMarker([cruce.lat, cruce.lng], {
                    radius: 6,
                    fillColor: '#e67e22',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9,
                });

                const textoCruceCorto =
                    cruce?.address?.split(',')[0]?.trim() ?? 'N/A';

                let textoCalle = 'N/A';
                let textoEsquina = 'N/A';
                if (cruce.address) {
                    const partes = cruce.address.split(' ESQ ');
                    textoCalle = partes[0] ? partes[0].trim() : 'N/A';
                    if (partes.length > 1) {
                        textoEsquina = partes[1].split(',')[0].trim();
                    }
                }

                const popupCruceHtml = `
                    <div class="direcciones-popup-contenedor">
                        <h4 class="direcciones-popup-titulo">Detalle del Cruce</h4>
                        <div class="direcciones-popup-cuerpo">
                            <p><strong>Cruce:</strong> ${textoCruceCorto}</p>
                            <p><strong>Departamento:</strong> ${cruce.departamento || 'N/A'}</p>
                            <p><strong>Localidad:</strong> ${cruce.localidad || 'N/A'}</p>
                            <hr class="cruces-popup-hr">
                            <p><strong>Calle:</strong> ${textoCalle}</p>
                            <p><strong>Esquina:</strong> ${textoEsquina}</p>
                            <p><strong>ID Calle:</strong> ${cruce.idCalle || 'N/A'}</p>
                            <p><strong>ID Calle Esquina:</strong> ${cruce.idCalleEsq || 'N/A'}</p>
                            <hr class="cruces-popup-hr">
                            <button class="direcciones-btn-trazar-cruce" data-idcalle="${cruce.idCalleEsq}">✏️ Trazar Calle Cruce</button>
                        </div>
                    </div>
                `;

                marcadorEsquina.bindPopup(popupCruceHtml);
                marcadorEsquina.addTo(this.layerGroup);

                marcadorEsquina.on('popupopen', (e) => {
                    const contenedorHTML = e.popup._contentNode;
                    if (!contenedorHTML) return;

                    const botonTrazar = contenedorHTML.querySelector(
                        '.direcciones-btn-trazar-cruce'
                    );
                    if (botonTrazar) {
                        botonTrazar.addEventListener(
                            'click',
                            () => {
                                const idCalleEsq =
                                    botonTrazar.getAttribute('data-idcalle');
                                this.trazarCalleCruceIndividual(
                                    idCalleEsq,
                                    botonTrazar,
                                    marcadorEsquina,
                                    cruce,
                                    textoCalle,
                                    textoEsquina
                                );
                            },
                            { once: true }
                        );
                    }
                });
            });
        }

        if (this.layerGroup.getLayers().length > 0) {
            this.mapa.fitBounds(this.layerGroup.getBounds(), {
                padding: [40, 40],
            });
        }
    }

    async trazarCalleCruceIndividual(
        idCalleEsq,
        botonUI,
        marcadorEsquina,
        cruce,
        textoCalle,
        textoEsquina
    ) {
        if (!idCalleEsq || idCalleEsq === '0' || idCalleEsq === 'null') {
            this.orquestador.warn(
                'Cruces Ejes',
                `No se dispone de un ID válido de eje vial para trazar esta calle cruce: ${idCalleEsq}`
            );
            return;
        }

        const configGlobal = this.parent.configApi || {};
        const apiDirecciones = configGlobal.apiDirecciones
            ? configGlobal.apiDirecciones
            : configGlobal;
        const configTramos = apiDirecciones.servicios?.find(
            (s) => s.idServicio === 'tramosCalle'
        );

        if (!configTramos) return;

        if (!botonUI && marcadorEsquina && marcadorEsquina.getPopup()) {
            const nodo = marcadorEsquina.getPopup()._contentNode;
            if (nodo)
                botonUI = nodo.querySelector('.direcciones-btn-trazar-cruce');
        }

        if (botonUI) {
            botonUI.disabled = true;
            botonUI.innerText = 'Trazando...';
            botonUI.classList.add('estado-trazando');
        }

        try {
            const params = new URLSearchParams();
            params.append('idCalle', idCalleEsq);
            params.append('idcalle', idCalleEsq);

            let baseUrl = apiDirecciones['url-base'] || '';
            let epTramos = configTramos['url-servicio'] || '';

            if (baseUrl.endsWith('/') && epTramos.startsWith('/'))
                epTramos = epTramos.substring(1);
            else if (!baseUrl.endsWith('/') && !epTramos.startsWith('/'))
                baseUrl += '/';
            const urlCompleta = `${baseUrl}${epTramos}?${params.toString()}`;

            const respuesta = await fetch(urlCompleta);
            if (!respuesta.ok)
                this.orquestador.throwError(
                    'Cruces Ejes',
                    `HTTP Error ${respuesta.status}`
                );

            const geojsonCruce = await respuesta.json();

            if (
                geojsonCruce &&
                geojsonCruce.features &&
                geojsonCruce.features.length > 0
            ) {
                const metricas = this.calcularMetricasEje(geojsonCruce);

                const textoCruceCorto =
                    cruce?.address?.split(',')[0]?.trim() ?? 'N/A';

                const capaCalleCruce = L.geoJSON(geojsonCruce, {
                    style: {
                        color: '#e67e22',
                        weight: 5,
                        opacity: 0.85,
                        dashArray: '6, 6',
                    },
                });
                capaCalleCruce.addTo(this.layerGroup);

                const popupActualizadoHtml = `
                    <div class="direcciones-popup-contenedor">
                        <h4 class="direcciones-popup-titulo">Detalle del Eje de Cruce</h4>
                        <div class="direcciones-popup-cuerpo">
                            <p><strong>Cruce:</strong> ${textoCruceCorto}</p>
                            <p><strong>Departamento:</strong> ${cruce.departamento || 'N/A'}</p>
                            <p><strong>Localidad:</strong> ${cruce.localidad || 'N/A'}</p>
                            <hr class="cruces-popup-hr">
                            <p><strong>Calle:</strong> ${textoCalle}</p>
                            <p><strong>Esquina:</strong> ${textoEsquina}</p>
                            <p><strong>ID Calle:</strong> ${cruce.idCalle || 'N/A'}</p>
                            <p><strong>ID Calle Esquina:</strong> ${cruce.idCalleEsq || 'N/A'}</p>
                            <hr class="cruces-popup-hr">
                            <div style="margin-bottom: 8px;">
                                <span class="direcciones-btn-trazar-cruce estado-exito" style="display:block; text-align:center; box-sizing:border-box;">
                                    ✓ Trazado con Éxito
                                </span>
                            </div>
                            <h5 class="direcciones-popup-titulo">Métricas del Eje de Cruce:</h5>
                            <ul class="cruces-popup-metricas">
                                <li><span>Longitud:</span> <span class="valor">${metricas.longitud}</span></li>
                                <li><span>Tramos (Segmentos):</span> <span class="valor">${metricas.cantidadTramos}</span></li>
                                <li><span>Cantidad de Nodos:</span> <span class="valor">${metricas.cantidadNodos}</span></li>
                                <li><span>Integridad:</span> <span class="valor">${metricas.integridad}</span></li>
                                <li><span>Orientación:</span> <span class="valor">${metricas.orientacion}</span></li>
                                <li><span>Sinuosidad:</span> <span class="valor">${metricas.sinuosidad}</span></li>
                                <li><span>Conectividad:</span> <span class="valor">${metricas.conectividad}</span></li>
                            </ul>
                        </div>
                    </div>
                `;

                if (marcadorEsquina) {
                    marcadorEsquina.setPopupContent(popupActualizadoHtml);
                }
            } else {
                this.orquestador.warn(
                    'Cruces Ejes',
                    'No se localizó el trazado lineal para este eje en los servidores de la IDE.'
                );
                if (botonUI) {
                    botonUI.classList.remove('estado-trazando');
                    botonUI.innerText = '⚠️ No Disponible';
                }
            }
        } catch (error) {
            this.orquestador.error(
                'Cruces Ejes',
                'Error: CrucesEje.trazarIndividual', error
            );
            
            if (botonUI) {
                botonUI.disabled = false;
                botonUI.classList.remove('estado-trazando');
                botonUI.innerText = '✏️ Reintentar Trazado';
            }
        }
    }

    /**
     * Analiza geométricamente el GeoJSON de la calle trazada para calcular
     * métricas espaciales en tiempo real usando fórmulas Haversine.
     */
    calcularMetricasEje(geojson) {
        let longitudTotalMetros = 0;
        let cantidadTramos = geojson.features.length;
        let coordenadasTodas = [];

        const calcularDistanciaPuntos = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3;
            const phi1 = (lat1 * Math.PI) / 180;
            const phi2 = (lat2 * Math.PI) / 180;
            const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
            const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
            const a =
                Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                Math.cos(phi1) *
                    Math.cos(phi2) *
                    Math.sin(deltaLambda / 2) *
                    Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        geojson.features.forEach((feature) => {
            if (!feature.geometry) return;

            const lineas =
                feature.geometry.type === 'MultiLineString'
                    ? feature.geometry.coordinates
                    : [feature.geometry.coordinates];

            lineas.forEach((linea) => {
                for (let i = 0; i < linea.length; i++) {
                    coordenadasTodas.push([linea[i][1], linea[i][0]]);
                    if (i > 0) {
                        longitudTotalMetros += calcularDistanciaPuntos(
                            linea[i - 1][1],
                            linea[i - 1][0],
                            linea[i][1],
                            linea[i][0]
                        );
                    }
                }
            });
        });

        const longitudTexto =
            longitudTotalMetros > 1000
                ? `${(longitudTotalMetros / 1000).toFixed(2)} km`
                : `${Math.round(longitudTotalMetros)} m`;

        let orientacionTexto = 'No calculable';
        let sinuosidadTexto = 'Baja (Rectilínea)';

        if (coordenadasTodas.length >= 2) {
            const pInicial = coordenadasTodas[0];
            const pFinal = coordenadasTodas[coordenadasTodas.length - 1];
            const distanciaLineaRecta = calcularDistanciaPuntos(
                pInicial[0],
                pInicial[1],
                pFinal[0],
                pFinal[1]
            );

            if (distanciaLineaRecta > 0) {
                const indiceSinuosidad =
                    longitudTotalMetros / distanciaLineaRecta;
                if (indiceSinuosidad > 1.4)
                    sinuosidadTexto = 'Alta (Muy Sinuosa)';
                else if (indiceSinuosidad > 1.1)
                    sinuosidadTexto = 'Media (Curva)';
                else sinuosidadTexto = 'Baja (Rectilínea)';
            }

            const dLat = pFinal[0] - pInicial[0];
            const dLng = pFinal[1] - pInicial[1];
            const angulo = (Math.atan2(dLng, dLat) * 180) / Math.PI;
            const azimut = (angulo + 360) % 360;

            if (
                azimut >= 337.5 ||
                azimut < 22.5 ||
                (azimut >= 157.5 && azimut < 202.5)
            ) {
                orientacionTexto = 'Norte - Sur ↕';
            } else if (
                (azimut >= 67.5 && azimut < 112.5) ||
                (azimut >= 247.5 && azimut < 292.5)
            ) {
                orientacionTexto = 'Este - Oeste ↔';
            } else if (
                (azimut >= 22.5 && azimut < 67.5) ||
                (azimut >= 202.5 && azimut < 247.5)
            ) {
                orientacionTexto = 'Nordeste - Sudoeste ↗';
            } else {
                orientacionTexto = 'Noroeste - Sudeste ↖';
            }
        }

        let nodosExtremos = new Set();
        geojson.features.forEach((f) => {
            if (f.geometry && f.geometry.coordinates) {
                const coords =
                    f.geometry.type === 'MultiLineString'
                        ? f.geometry.coordinates[0]
                        : f.geometry.coordinates;
                if (coords.length > 0) {
                    nodosExtremos.add(coords[0].join(','));
                    nodosExtremos.add(coords[coords.length - 1].join(','));
                }
            }
        });

        const cantidadNodos = nodosExtremos.size;

        let integridadTexto =
            '<span style="color: #27ae60;">✓ Eje Continuo</span>';

        if (cantidadTramos > 0) {
            if (cantidadNodos > cantidadTramos + 1) {
                integridadTexto =
                    '<span style="color: #c0392b; font-weight: bold;">⚠️ Fragmentado / Discontinuo</span>';
            } else if (cantidadNodos < cantidadTramos + 1) {
                integridadTexto =
                    '<span style="color: #2980b9;">🔄 Bucle / Rotonda Cerrada</span>';
            }
        }

        let conectividadTexto = 'Baja';
        if (cantidadNodos > 12) conectividadTexto = 'Alta (Eje muy articulado)';
        else if (cantidadNodos > 3)
            conectividadTexto = 'Media (Eje urbano estándar)';
        else conectividadTexto = 'Baja (Eje corto / Aislado)';

        return {
            longitud: longitudTexto,
            cantidadTramos: cantidadTramos,
            cantidadNodos: cantidadNodos,
            integridad: integridadTexto,
            orientacion: orientacionTexto,
            sinuosidad: sinuosidadTexto,
            conectividad: conectividadTexto,
        };
    }
}
