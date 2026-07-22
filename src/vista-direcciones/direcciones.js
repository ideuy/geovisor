/**
 * direcciones.js
 * Orquestador principal de la Vista Direcciones.
 */
import { InterfazDirecciones } from './interfaz-direcciones.js';
import { ServicioDirecciones } from './servicios-direcciones.js';
import { InterfazMapillary } from './interfaz-mapillary.js';
import { InterfazSidebar } from './interfaz-sidebar.js';
import { GestorMapa } from './gestor-mapa.js';
import { BuscadorDirecciones } from './buscador-direcciones.js';

import { BusquedaInversa } from './herramientas/busqueda-inversa.js';
import { DireccionesPoligono } from './herramientas/direcciones-poligono.js';
import { TramosEje } from './herramientas/tramos-eje.js';
import { CrucesEje } from './herramientas/cruces-eje.js';
import { SerieElectoral } from './herramientas/serie-electoral.js';
import { MapillaryHerramienta } from './herramientas/mapillary.js';

export class Direcciones {
    constructor(orquestador) {
        this.orquestador = orquestador;

        this.elementoRaiz = null;
        this.servicio = null;
        this.gestorMapa = new GestorMapa(this.orquestador);
        this.buscadorComponent = null;
        this.mapillaryComponent = null;
        this.sidebarComponent = null;

        this.busquedaInversa = null;
        this.direccionesPoligono = null;
        this.tramosEje = null;
        this.crucesEje = null;
        this.serieElectoral = null;
        this.mapillaryHerramienta = null;

        this.herramientaActivaId = null;

        this.configApi = null;
        this.configCapaElectoral = null;
        this.configDirecUnica = null;
        this.configMapillary = null;

        this.configReverse = null;
        this.configPoligono = null;
        this.configTramos = null;
        this.configCruces = null;

        this.candidatoActual = null;
    }

    async inicializar() {
        this.orquestador.info(
            'Direcciones',
            'Iniciando el Orquestador de Direcciones.'
        );

        try {
            const [
                respuestaDirecciones,
                respuestaMapasBase,
                respuestaCapasOperativas,
                respuestaAplicacion,
            ] = await Promise.all([
                fetch('./config/direcciones.json'),
                fetch('./config/mapas-base.json'),
                fetch('./config/capas-operativas.json'),
                fetch('./config/aplicacion.json'),
            ]);

            const datosDirecciones = await respuestaDirecciones.json();
            const datosMapasBase = await respuestaMapasBase.json();
            const datosCapasOperativas = await respuestaCapasOperativas.json();
            const datosAplicacion = await respuestaAplicacion.json();

            this.configApi = datosDirecciones.apiDirecciones;
            this.servicio = new ServicioDirecciones(
                this.orquestador,
                datosDirecciones
            );

            this.configReverse = this.configApi.servicios.find(
                (s) => s.idServicio === 'reverse'
            );
            if (this.configReverse)
                this.configReverse['url-base'] = this.configApi['url-base'];

            this.configPoligono = this.configApi.servicios.find(
                (s) => s.idServicio === 'direcEnPoligono'
            );
            if (this.configPoligono)
                this.configPoligono['url-base'] = this.configApi['url-base'];

            this.configDirecUnica = this.configApi.servicios.find(
                (s) => s.idServicio === 'direcUnica'
            );
            if (this.configDirecUnica)
                this.configDirecUnica['url-base'] = this.configApi['url-base'];

            this.configTramos = this.configApi.servicios.find(
                (s) => s.idServicio === 'tramosCalle'
            );
            this.configCruces = this.configApi.servicios.find(
                (s) => s.idServicio === 'crucesPorIdCalle'
            );

            const mapaConfig = datosDirecciones.mapaDirecciones;
            const proveedores = datosMapasBase.mapasBase.proveedores;
            const proveedorSeleccionado = proveedores[mapaConfig.idMapaBase];

            this.configMapillary = datosAplicacion.mapillary || {};
            const configMapillary = this.configMapillary;

            if (!proveedorSeleccionado) {
                this.orquestador.throwError(
                    'Direcciones',
                    `El proveedor de mapa base "${mapaConfig.idMapaBase}" no está definido.`
                );
            }

            this.configCapaElectoral =
                datosCapasOperativas.capasOperativas.find(
                    (capa) => capa.id === 'series_electorales'
                );

            this.elementoRaiz =
                InterfazDirecciones.crearContenedorDirecciones();

            setTimeout(() => {
                this.orquestador.debug(
                    'Direcciones',
                    'Iniciando configuración de componentes visuales.'
                );

                this.gestorMapa.inicializar(
                    'mapa-direcciones-leaflet',
                    mapaConfig,
                    proveedorSeleccionado
                );

                this.sidebarComponent = new InterfazSidebar(
                    'sidebar-herramientas',
                    'btn-toggle-sidebar-herramientas',
                    this.orquestador
                );

                this.sidebarComponent.inicializar(
                    proveedores,
                    mapaConfig.idMapaBase,
                    (nuevoId) => {
                        if (proveedores[nuevoId])
                            this.gestorMapa.cambiarMapaBase(
                                proveedores[nuevoId]
                            );
                    }
                );

                const btnToggle = document.getElementById(
                    'btn-toggle-sidebar-herramientas'
                );
                const contenedor = this.elementoRaiz;

                if (btnToggle) {
                    btnToggle.addEventListener('click', () => {
                        contenedor.classList.toggle('sidebar-oculto');

                        setTimeout(() => {
                            if (this.gestorMapa && this.gestorMapa.mapa) {
                                this.gestorMapa.mapa.invalidateSize();
                            }
                        }, 400);
                    });
                }

                const listaCapas = datosCapasOperativas.capasOperativas;
                this.sidebarComponent.renderizarCapasOperativas(
                    listaCapas,
                    (capaConfig, activa) => {
                        this.gestorMapa.manejarCapaOperativa(
                            capaConfig,
                            activa
                        );
                    }
                );

                this.renderizarPanelHerramientas();
                this.asegurarControlesAdicionales();

                this.mapillaryComponent = new InterfazMapillary(
                    'contenedor-mapillary',
                    this.orquestador,
                    configMapillary
                );

                this.buscadorComponent = new BuscadorDirecciones(
                    this.orquestador,
                    this.servicio,
                    {
                        onClear: () => this.limpiarVistasOperativas(),
                        onSelect: (item) => this.manejarSeleccionBuscador(item),
                    }
                );
                this.buscadorComponent.inicializar();
            }, 0);

            return this.elementoRaiz;
        } catch (error) {
            this.orquestador.error(
                'Direcciones',
                'Falló la inicialización del Orquestador de Direcciones:',
                error
            );
            this.elementoRaiz = document.createElement('div');
            this.elementoRaiz.className = 'contenedor-vista-direcciones';
            this.elementoRaiz.innerHTML = `<div style="padding:20px; color:var(--color-texto);">Error al cargar componentes cartográficos.</div>`;
            return this.elementoRaiz;
        }
    }

    /**
     * Renderiza el panel de herramientas en el sidebar.
     */
    renderizarPanelHerramientas() {
        const contenedor = this.sidebarComponent.cuerpoDOM;

        let panelHerramientas = contenedor.querySelector(
            '#panel-herramientas-segmentado'
        );
        if (!panelHerramientas) {
            panelHerramientas = document.createElement('div');
            panelHerramientas.id = 'panel-herramientas-segmentado';
            contenedor.appendChild(panelHerramientas);
        }
        panelHerramientas.innerHTML = '';

        const iconoInversa = './imagenes/busqueda-inversa.svg';
        const iconoArea = './imagenes/busqueda-area.svg';
        const iconoTramos = './imagenes/busqueda-tramos.svg';
        const iconoCruces = './imagenes/busqueda-cruces.svg';

        const herramientasExclusivas = [
            {
                id: 'tool-inversa',
                label: 'Búsqueda Inversa',
                icon: `<img src="${iconoInversa}" class="iconos" />`,
                key: 'busquedaInversa',
                Clase: BusquedaInversa,
            },
            {
                id: 'tool-area',
                label: 'Búsqueda<br>en Área',
                icon: `<img src="${iconoArea}" class="iconos" />`,
                key: 'direccionesPoligono',
                Clase: DireccionesPoligono,
            },
            {
                id: 'tool-tramos',
                label: 'Tramos de Ejes de Calle',
                icon: `<img src="${iconoTramos}" class="iconos" />`,
                key: 'tramosEje',
                Clase: TramosEje,
            },
            {
                id: 'tool-cruces',
                label: 'Cruces de<br>Ejes de Calle',
                icon: `<img src="${iconoCruces}" class="iconos" />`,
                key: 'crucesEje',
                Clase: CrucesEje,
            },
        ];

        const modificadores = [
            {
                id: 'mod-electoral',
                label: 'Serie Electoral',
                description: 'Agregar el polígono de la Serie Electoral',
                key: 'serieElectoral',
                Clase: SerieElectoral,
            },
            {
                id: 'mod-mapillary',
                label: 'Imágenes Callejeras',
                description: 'Agregar imágenes callejeras del entorno',
                key: 'mapillaryHerramienta',
                Clase: MapillaryHerramienta,
            },
        ];

        panelHerramientas.appendChild(
            this.sidebarComponent.renderizarHerramientasExclusivas(
                'Herramientas Direcciones',
                herramientasExclusivas
            )
        );
        panelHerramientas.appendChild(
            this.sidebarComponent.renderizarModificadores(
                'Información Contextual',
                modificadores
            )
        );

        this._vincularEventosHerramientas(
            panelHerramientas,
            herramientasExclusivas,
            modificadores
        );
    }

    /**
     * Vincula los eventos del panel mediante delegación con soporte Toggle robusto.
     */
    _vincularEventosHerramientas(panel, herramientas, modificadores) {
        panel.addEventListener('click', (e) => {
            if (e.target.classList.contains('control-segmentado__input')) {
                const item = herramientas.find((h) => h.id === e.target.id);
                const itemContenedor = e.target.closest(
                    '.control-segmentado__item'
                );
                const todosLosItems = panel.querySelectorAll(
                    '.control-segmentado__item'
                );

                if (item) {
                    if (this.herramientaActivaId === item.id) {
                        this.orquestador.debug(
                            'Direcciones',
                            `Desactivando herramienta por segundo clic: ${item.key}`
                        );

                        e.preventDefault();
                        e.target.checked = false;
                        this.herramientaActivaId = null;

                        if (itemContenedor) {
                            itemContenedor.classList.remove(
                                'control-segmentado__item--active'
                            );
                        }

                        if (this[item.key]?.desactivar) {
                            this[item.key].desactivar();
                        }

                        setTimeout(() => {
                            this.limpiarVistasOperativas();
                        }, 50);
                    } else {
                        this.herramientaActivaId = item.id;

                        this.orquestador.debug(
                            'Direcciones',
                            `Activando herramienta exclusiva: ${item.key}`
                        );

                        todosLosItems.forEach((el) =>
                            el.classList.remove(
                                'control-segmentado__item--active'
                            )
                        );
                        if (itemContenedor) {
                            itemContenedor.classList.add(
                                'control-segmentado__item--active'
                            );
                        }

                        this.activarHerramienta(
                            item.key,
                            this.obtenerConfigHerramienta(item.key),
                            item.Clase
                        );
                    }
                }
            }
        });

        // Escucha de Cambios para Modificadores Independientes (Checkboxes)
        panel.addEventListener('change', (e) => {
            if (e.target.classList.contains('interruptor__input')) {
                const mod = modificadores.find((m) => m.id === e.target.id);
                if (mod) {
                    const activo = e.target.checked;
                    this.orquestador.debug(
                        'Direcciones',
                        `Modificador ${mod.key} cambiado a: ${activo}`
                    );
                    if (activo) {
                        const config =
                            mod.key === 'serieElectoral'
                                ? this.configCapaElectoral
                                : this.configMapillary;
                        this.activarHerramienta(mod.key, config, mod.Clase);
                    } else {
                        if (this[mod.key]?.desactivar) {
                            this[mod.key].desactivar();
                        }
                    }
                }
            }
        });
    }

    /**
     * Retorna la configuración de servicio mapeada.
     */
    obtenerConfigHerramienta(key) {
        switch (key) {
            case 'busquedaInversa':
                return this.configReverse;
            case 'direccionesPoligono':
                return this.configPoligono;
            case 'tramosEje':
                return this.configTramos;
            case 'crucesEje':
                return this.configCruces;
            default:
                return {};
        }
    }

    /**
     * Activa una herramienta específica.
     */
    activarHerramienta(herramientaKey, configuracion, ClaseClase) {
        const requiereMarcadorActivo =
            herramientaKey === 'serieElectoral' ||
            herramientaKey === 'mapillaryHerramienta';

        if (
            requiereMarcadorActivo &&
            this.candidatoActual &&
            this.candidatoActual.datos
        ) {
            const lat = this.candidatoActual.punto.lat;
            const lng = this.candidatoActual.punto.lng;
            const contenidoPopup = this.crearContenidoPopup(
                this.candidatoActual.datos
            );

            this.orquestador.debug(
                'Direcciones',
                `Transfiriendo candidato activo a capaBusqueda antes de activar ${herramientaKey}.`
            );
            this.gestorMapa.graficarMarcador(
                [lat, lng],
                contenidoPopup,
                this.gestorMapa.mapa.getZoom()
            );
        }

        this.limpiarVistasOperativas(herramientaKey);

        if (!this[herramientaKey]) {
            this[herramientaKey] = new ClaseClase(
                this.gestorMapa.mapa,
                configuracion,
                this.orquestador,
                this
            );
        }

        this[herramientaKey].activar();

        if (herramientaKey === 'tramosEje' || herramientaKey === 'crucesEje') {
            if (this.buscadorComponent) {
                this.orquestador.debug(
                    'Direcciones',
                    `Configurando buscador en modo exclusivo 'CALLE' para: ${herramientaKey}`
                );
                this.buscadorComponent.establecerFiltro('CALLE', true);
            }
        }
    }

    /**
     * Inyecta el contenedor de Mapillary
     */
    asegurarControlesAdicionales() {
        if (!document.getElementById('contenedor-mapillary')) {
            const sidebar = document.getElementById('sidebar-herramientas');
            if (!sidebar) return;

            const contMapillary = document.createElement('div');
            contMapillary.id = 'contenedor-mapillary';
            contMapillary.style.width = '100%';
            contMapillary.style.height = '200px';
            contMapillary.style.display = 'none';
            contMapillary.style.marginTop = '10px';
            sidebar.appendChild(contMapillary);
        }
    }

    manejarSeleccionBuscador(item) {
        this.orquestador.debug(
            'Direcciones',
            `Ítem seleccionado en UI: ${item.address}`
        );

        if (this.tramosEje && this.tramosEje.activo) {
            this.tramosEje.procesarSeleccion(item);
            return;
        }

        if (this.crucesEje && this.crucesEje.activo) {
            this.crucesEje.procesarSeleccion(item);
            return;
        }

        if (item.lat && item.lng && item.type === 'MANZANAySOLAR') {
            this.graficarPuntoEnMapa(item);
        } else if (item.type === 'CALLE') {
            this.ejecutarDirecUnica(item);
        } else {
            this.ejecutarGeocodeFind(item);
        }
    }

    async ejecutarDirecUnica(itemCandidato) {
        if (!itemCandidato || !this.configDirecUnica) return;
        document.body.style.cursor = 'wait';

        try {
            const urlBase = this.configDirecUnica['url-base'];
            const urlServicio = this.configDirecUnica['url-servicio'];

            const baseClean = urlBase.endsWith('/')
                ? urlBase.slice(0, -1)
                : urlBase;
            const servicioClean = urlServicio.startsWith('/')
                ? urlServicio
                : '/' + urlServicio;

            const params = new URLSearchParams();

            if (this.configDirecUnica.parametros) {
                Object.keys(this.configDirecUnica.parametros).forEach(
                    (clave) => {
                        if (clave === 'q') {
                            const queryVal =
                                itemCandidato.address ||
                                itemCandidato.nomVia ||
                                itemCandidato.nomvia ||
                                '';
                            params.append(clave, queryVal);
                        } else {
                            params.append(
                                clave,
                                this.configDirecUnica.parametros[clave]
                            );
                        }
                    }
                );
            }

            const urlCompleta = `${baseClean}${servicioClean}?${params.toString()}`;

            const respuesta = await fetch(urlCompleta);

            if (!respuesta.ok) {
                this.orquestador.throwError(
                    'Direcciones',
                    `HTTP status ${respuesta.status}`
                );
            }

            const datos = await respuesta.json();
            let puntoEncontrado = null;

            if (datos) {
                const resultado = Array.isArray(datos) ? datos[0] : datos;
                if (resultado) {
                    const lat =
                        resultado.lat ||
                        resultado.y ||
                        (resultado.punto && resultado.punto.lat);
                    const lng =
                        resultado.lng ||
                        resultado.x ||
                        (resultado.punto && resultado.punto.lng);

                    if (lat && lng) {
                        puntoEncontrado = {
                            ...itemCandidato,
                            lat: parseFloat(lat),
                            lng: parseFloat(lng),
                            stateMsg:
                                resultado.stateMsg || itemCandidato.stateMsg,
                        };
                    }
                }
            }

            if (puntoEncontrado) {
                this.graficarPuntoEnMapa(puntoEncontrado);
            } else {
                this.orquestador.warn(
                    'Direcciones',
                    'El servicio [direcUnica] no pudo localizar el centroide de la calle seleccionada.'
                );
            }
        } catch (error) {
            this.orquestador.error(
                'Direcciones',
                'Error en consulta [direcUnica]: ',
                error
            );
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    async ejecutarGeocodeFind(itemCandidato) {
        if (!itemCandidato || !itemCandidato.address || !this.servicio) return;

        if (
            itemCandidato.type === 'CALLE' &&
            !itemCandidato.portalNumber &&
            !itemCandidato.portal
        ) {
            this.orquestador.debug(
                'Direcciones',
                '[GeocodeFind] Cancelado: Evitando error 500 al buscar una calle sin altura.'
            );
            return;
        }

        document.body.style.cursor = 'wait';

        try {
            const puntoEncontrado =
                await this.servicio.obtenerCoordenadasPrecisas(itemCandidato);

            if (!puntoEncontrado) {
                this.orquestador.warn(
                    'Direcciones',
                    'No se pudieron recuperar las coordenadas precisas para este elemento.'
                );
                return;
            }

            if (puntoEncontrado.lat && puntoEncontrado.lng) {
                this.graficarPuntoEnMapa(puntoEncontrado);
            }
        } catch (error) {
            this.orquestador.error('Direcciones', '[GeocodeFind]: ', error);
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    graficarPuntoEnMapa(punto) {
        const electoralActivo =
            document.getElementById('mod-electoral')?.checked;
        const mapillaryActivo =
            document.getElementById('mod-mapillary')?.checked;

        this.limpiarVistasOperativas(true);

        this.candidatoActual = {
            punto: { lat: punto.lat, lng: punto.lng },
            datos: punto,
        };

        const contenidoPopup = this.crearContenidoPopup(punto);

        this.gestorMapa.graficarMarcador(
            [punto.lat, punto.lng],
            contenidoPopup,
            17
        );

        if (electoralActivo) {
            this.orquestador.debug(
                'Direcciones',
                'Reactivando automáticamente Serie Electoral para el nuevo punto.'
            );
            this.activarHerramienta(
                'serieElectoral',
                this.configCapaElectoral,
                SerieElectoral
            );
        }

        if (mapillaryActivo) {
            this.orquestador.debug(
                'Direcciones',
                'Reactivando automáticamente Mapillary para el nuevo punto.'
            );
            this.activarHerramienta(
                'mapillaryHerramienta',
                this.configMapillary,
                MapillaryHerramienta
            );
        }
    }

    crearContenidoPopup(punto, codigoSerie = null) {
        let infoPuerta = punto.portalNumber || '';
        if (punto.letra) infoPuerta += ` ${punto.letra}`;
        if (!infoPuerta) infoPuerta = 'N/A';

        const filaSerieElectoral = codigoSerie
            ? `<p><strong>Serie Electoral:</strong> <span style="color: #ff0000; font-weight: bold;">${codigoSerie}</span></p>`
            : '';

        const mapeoTipos = {
            CALLEyPORTAL: 'DIRECCION',
            CALLE: 'VIA DE CIRCULACION',
            POI: 'PUNTO DE INTERÉS',
            LOCALIDAD: 'LOCALIDAD',
            MANZANAySOLAR: 'MANZANA y SOLAR',
            ESQUINA: 'ESQUINA',
            SOLAR: 'SOLAR',
            RUTA: 'RUTA NACIONAL',
            INMUEBLE: 'INMUEBLE',
        };
        const tipoTexto = mapeoTipos[punto.type] || punto.type || 'N/A';

        return `
            <div class="direcciones-popup-contenedor">
                <h4 class="direcciones-popup-titulo">Dirección Localizada</h4>
                <div class="direcciones-popup-cuerpo">
                    <p><strong>Tipo:</strong> ${tipoTexto}</p>
                    <p><strong>Direccion:</strong> ${punto.address || 'N/A'}</p>
                    <p><strong>Departamento:</strong> ${punto.departamento || 'N/A'}</p>
                    <p><strong>Localidad:</strong> ${punto.localidad || 'N/A'}</p>
                    <p><strong>Calle:</strong> ${punto.nomVia || 'N/A'}</p>
                    <p><strong>Puerta:</strong> ${infoPuerta}</p>
                    <p><strong>Codigo Postal:</strong> ${punto.postalCode || 'N/A'}</p>
                    ${filaSerieElectoral}
                    <p><strong>Coordenadas:</strong> <span class="direcciones-popup-mono">${punto.lat.toFixed(6)}, ${punto.lng.toFixed(6)}</span></p>
                    <p><strong>Observación:</strong> <span class="direcciones-popup-obs">${punto.stateMsg || 'Sin observaciones'}</span></p>
                </div>
            </div>
        `;
    }

    configurarEventosPoligono() {
        const btnBuscar = document.getElementById('btn-buscar-poligono');

        if (!btnBuscar) return;

        btnBuscar.addEventListener('click', async () => {
            const limit =
                document.getElementById('input-limit-poligono').value || 50;
            const tipoDirec =
                document.getElementById('select-tipo-poligono').value ||
                'portales';

            const geojsonPoligono = this.gestorMapa.obtenerGeoJSONDibujado();

            if (!geojsonPoligono) {
                this.orquestador.warn(
                    'Direcciones',
                    'No hay ningún polígono dibujado. Se debe dibujar un área en el mapa primero'
                );
                return;
            }

            btnBuscar.disabled = true;
            document.body.style.cursor = 'wait';

            try {
                await this.direccionesPoligono.buscarEnPoligono(
                    geojsonPoligono,
                    limit,
                    tipoDirec
                );
            } finally {
                btnBuscar.disabled = false;
                document.body.style.cursor = 'default';
            }
        });
    }

    /**
     * Limpieza centralizada inteligente con sincronización visual de UI y desactivación de listeners.
     */
    limpiarVistasOperativas(preservar = null) {
        const mantenerMapillary = preservar === true;
        const esSerieElectoral = preservar === 'serieElectoral';
        const esMapillaryHerramienta = preservar === 'mapillaryHerramienta';
        const preservarMarcadorActivo =
            esSerieElectoral || esMapillaryHerramienta;

        const herramientasExclusivasKeys = [
            'busquedaInversa',
            'direccionesPoligono',
            'tramosEje',
            'crucesEje',
        ];

        const esHerramientaExclusiva =
            herramientasExclusivasKeys.includes(preservar);

        this.orquestador.debug(
            'Direcciones',
            `Ejecutando limpieza centralizada. Preservando: ${preservar || 'Ninguna'}`
        );

        herramientasExclusivasKeys.forEach((key) => {
            if (key !== preservar && this[key]) {
                if (typeof this[key].desactivar === 'function') {
                    this.orquestador.debug(
                        'Direcciones',
                        `Desactivando listeners de la herramienta: ${key}`
                    );
                    this[key].desactivar();
                }
            }
        });

        const seMantieneHerramientaEjes =
            preservar === 'tramosEje' || preservar === 'crucesEje';

        if (!seMantieneHerramientaEjes && this.buscadorComponent) {
            this.buscadorComponent.establecerFiltro('CALLEyPORTAL', false);
        }

        if (!preservarMarcadorActivo) {
            if (this.serieElectoral?.desactivar)
                this.serieElectoral.desactivar();
            if (this.mapillaryHerramienta?.desactivar)
                this.mapillaryHerramienta.desactivar();
        }

        if (
            !mantenerMapillary &&
            !preservarMarcadorActivo &&
            this.buscadorComponent?.limpiarInput
        ) {
            this.buscadorComponent.limpiarInput();
        }

        if (!preservarMarcadorActivo) {
            this.gestorMapa.limpiarCapaBusqueda();
            this.candidatoActual = null;

            if (!esHerramientaExclusiva) {
                this.herramientaActivaId = null;
            }

            if (preservar === null || preservar === true) {
                if (this.sidebarComponent?.cuerpoDOM) {
                    const radios =
                        this.sidebarComponent.cuerpoDOM.querySelectorAll(
                            '.control-segmentado__input'
                        );
                    radios.forEach((radio) => (radio.checked = false));

                    const itemsSegmentados =
                        this.sidebarComponent.cuerpoDOM.querySelectorAll(
                            '.control-segmentado__item'
                        );
                    itemsSegmentados.forEach((item) =>
                        item.classList.remove(
                            'control-segmentado__item--active'
                        )
                    );
                }
            }
        }

        this.gestorMapa.limpiarCapaPoligonos();

        if (!preservarMarcadorActivo) {
            if (this.busquedaInversa) {
                if (this.busquedaInversa.layerGroup) {
                    this.busquedaInversa.layerGroup.clearLayers();
                }
                if (this.busquedaInversa.routingControl) {
                    const rc = this.busquedaInversa.routingControl;
                    if (typeof rc.remove === 'function') {
                        rc.remove();
                    } else {
                        try {
                            this.gestorMapa.mapa.removeControl(rc);
                        } catch (error) {
                            this.orquestador.warn(
                                'Direcciones',
                                '[Limpieza] No se pudo remover el control de ruteo: ',
                                error
                            );
                        }
                    }
                    if (rc._line) {
                        this.gestorMapa.mapa.removeLayer(rc._line);
                    }
                    this.busquedaInversa.routingControl = null;
                }
            }

            if (this.direccionesPoligono?.limpiarTodo)
                this.direccionesPoligono.limpiarTodo();

            if (this.tramosEje?.limpiarTodo) this.tramosEje.limpiarTodo();

            if (this.crucesEje && this.crucesEje.limpiarTodo)
                this.crucesEje.limpiarTodo();

            if (!mantenerMapillary && this.mapillaryComponent?.desactivar) {
                this.mapillaryComponent.desactivar();
            }
        }
    }

    destruir() {
        this.orquestador.debug(
            'Direcciones',
            'Iniciando destrucción de la vista Direcciones.'
        );

        // 1. Apaga/limpia todas las herramientas exclusivas y modificadores
        this.limpiarVistasOperativas();

        // 2. direccionesPoligono registra un listener 'zoomend' hay que cerrarlo 
        if (
            this.direccionesPoligono &&
            typeof this.direccionesPoligono.destruir === 'function'
        ) {
            this.direccionesPoligono.destruir();
        }

        // 3. Sub-componentes con recursos propios (mapa Leaflet, timers, etc.)
        if (this.gestorMapa) this.gestorMapa.destruir();
        if (this.buscadorComponent) this.buscadorComponent.destruir();

        // 4. Anula referencias a herramientas e instancias
        this.busquedaInversa = null;
        this.direccionesPoligono = null;
        this.tramosEje = null;
        this.crucesEje = null;
        this.serieElectoral = null;
        this.mapillaryHerramienta = null;

        this.gestorMapa = null;
        this.buscadorComponent = null;
        this.mapillaryComponent = null;
        this.sidebarComponent = null;

        this.candidatoActual = null;
        this.elementoRaiz = null;

        this.orquestador.debug(
            'Direcciones',
            'Recursos destruidos correctamente.'
        );
    }
}
