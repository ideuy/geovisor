/**
 * cartografia.js
 * Lógica de negocio de la Vista Cartografía (Presentador / Controlador de Vista).
 * Gobierna el estado del mapa, sidebar, carga de datos desde la IDE de Uruguay
 * y la comunicación con las herramientas espaciales.
 */
import { InterfazCartografia } from './interfaz-cartografia.js';
import { HerramientaMedicion } from './herramientas/herramienta-medicion.js';
import { HerramientaArea } from './herramientas/herramienta-area.js';
import { HerramientaAtributos } from './herramientas/herramienta-atributos.js';
import { PerfilElevacion } from './herramientas/perfil-elevacion.js';

export class Cartografia {
    /**
     * @param {Orquestador} orquestador Instancia del mediador central de la app.
     */
    constructor(orquestador) {
        this.orquestador = orquestador;
        this.elementoRaiz = null;
        this.instanciaMapa = null;
        this.sidebarColapsado = false;

        this.capaBaseActiva = null;
        this.mapasBaseConfig = {};
        this.capasOperativasCargadas = {};
        this.datosMapasBaseConfig = null;
        this.datosAplicacionConfig = null;

        this.moduloMedicion = null;
        this.moduloArea = null;
        this.moduloAtributos = null;
        this.moduloPerfilElevacion = null;

        this.herramientaActivaId = null;
        this.herramientasExclusivas = [];
    }

    /**
     * Ciclo de vida: Inicializa los componentes de la vista.
     * @returns {HTMLElement} El nodo raíz listo para ser inyectado en el DOM.
     */
    async inicializar() {
        this.orquestador.info(
            'Cartografía',
            'Inicializando lógica de la vista cartográfica.'
        );

        this.elementoRaiz = InterfazCartografia.crearContenedorCartografia();

        const botonSolapa = this.elementoRaiz.querySelector(
            '#btn-solapa-sidebar'
        );
        const sidebar = this.elementoRaiz.querySelector('#sidebar-capas');

        if (botonSolapa && sidebar) {
            botonSolapa.addEventListener('click', () =>
                this.conmutarSidebar(sidebar, botonSolapa)
            );
        }

        this.renderizarPanelHerramientas();

        setTimeout(async () => {
            await this.cargarConfiguracionElementos();
        }, 50);

        return this.elementoRaiz;
    }

    /**
     * Renderiza el grupo segmentado de herramientas exclusivas en el sidebar
     * y vincula sus eventos. Misma estrategia que la vista Direcciones.
     */
    renderizarPanelHerramientas() {
        const contenedorPanel = this.elementoRaiz.querySelector(
            '#panel-herramientas-segmentado'
        );
        if (!contenedorPanel) return;

        const iconoMedicion = './imagenes/medir-distancia.svg';
        const iconoArea = './imagenes/medir-area.svg';
        const iconoAtributos = './imagenes/consultar-atributos.svg';
        const iconoPerfil = './imagenes/perfil-elevacion.svg';

        this.herramientasExclusivas = [
            {
                id: 'tool-medicion',
                label: 'Medir<br>Distancias',
                icon: `<img src="${iconoMedicion}" class="iconos" />`,
                key: 'moduloMedicion',
                Clase: HerramientaMedicion,
            },
            {
                id: 'tool-area',
                label: 'Medir<br>Área',
                icon: `<img src="${iconoArea}" class="iconos" />`,
                key: 'moduloArea',
                Clase: HerramientaArea,
            },
            {
                id: 'tool-atributos',
                label: 'Consultar<br>Atributos',
                icon: `<img src="${iconoAtributos}" class="iconos" />`,
                key: 'moduloAtributos',
                Clase: HerramientaAtributos,
            },
            {
                id: 'tool-perfil-elevacion',
                label: 'Perfil de<br>Elevación',
                icon: `<img src="${iconoPerfil}" class="iconos" />`,
                key: 'moduloPerfilElevacion',
                Clase: PerfilElevacion,
            },
        ];

        const grupoSegmentado = InterfazCartografia.crearPanelHerramientasExclusivas(
            this.herramientasExclusivas
        );
        contenedorPanel.appendChild(grupoSegmentado);

        this._vincularEventosHerramientas(contenedorPanel, this.herramientasExclusivas);
    }

    /**
     * Delegación de eventos sobre el grupo segmentado:
     * un primer clic activa la herramienta (y desactiva cualquier otra), un
     * segundo clic sobre la misma opción la desactiva.
     */
    _vincularEventosHerramientas(panel, herramientas) {
        panel.addEventListener('click', (e) => {
            if (!e.target.classList.contains('control-segmentado__input')) {
                return;
            }

            const item = herramientas.find((h) => h.id === e.target.id);
            if (!item) return;

            if (this.herramientaActivaId === item.id) {
                this.orquestador.debug(
                    'Cartografía',
                    `Desactivando herramienta por segundo clic: ${item.key}`
                );

                e.preventDefault();
                e.target.checked = false;
                this.herramientaActivaId = null;

                this.desactivarTodasLasHerramientas();
            } else {
                this.orquestador.debug(
                    'Cartografía',
                    `Activando herramienta exclusiva: ${item.key}`
                );

                this.herramientaActivaId = item.id;
                this.activarHerramienta(item);
            }
        });
    }

    activarHerramienta(item) {
        this.desactivarTodasLasHerramientas();

        if (!this[item.key]) {
            this[item.key] = this.instanciarModulo(item.key, item.Clase);
        }

        this[item.key].activar();
    }

    instanciarModulo(key, Clase) {
        if (key === 'moduloAtributos') {
            return new Clase(
                this.instanciaMapa,
                this.capasOperativasCargadas,
                this.orquestador
            );
        }
        return new Clase(this.instanciaMapa, this.orquestador);
    }

    /**
     * Consume los archivos de parametrización JSON para inicializar el mapa base
     * e inyectar dinámicamente los controles interactivos en el Sidebar.
     */
    async cargarConfiguracionElementos() {
        try {
            const [resMapas, resCapas, resApp] = await Promise.all([
                fetch('./config/mapas-base.json'),
                fetch('./config/capas-operativas.json'),
                fetch('./config/aplicacion.json')
            ]);

            if (!resMapas.ok) throw new Error('No se pudo obtener mapas-base.json');
            if (!resCapas.ok) throw new Error('No se pudo obtener capas-operativas.json');

            const datosMapas = await resMapas.json();
            const datosCapas = await resCapas.json();
            const datosAplicacion = resApp.ok ? await resApp.json() : {};

            this.datosMapasBaseConfig = datosMapas;
            this.datosAplicacionConfig = datosAplicacion;

            const configMapa = datosMapas.mapasBase.configMapa;
            this.mapasBaseConfig = datosMapas.mapasBase.proveedores;

            this.instanciaMapa = L.map('mapa-base-leaflet', {
                zoomControl: false
            }).setView(
                configMapa.centro,
                configMapa.zoomInicial
            );

            L.control.zoom({
                position: 'topright'
            }).addTo(this.instanciaMapa);

            this.orquestador.debug(
                'Cartografía',
                `Mapa instanciado. Centro: ${configMapa.centro}`
            );

            const combo = this.elementoRaiz.querySelector('#combo-mapas-base');
            let idPorDefecto = null;

            Object.entries(this.mapasBaseConfig).forEach(([id, info]) => {
                const opcion = InterfazCartografia.crearOpcionMapaBase({
                    id,
                    nombre: info.nombre,
                });
                combo.appendChild(opcion);

                if (info.activo === 'true') {
                    idPorDefecto = id;
                }
            });

            combo.addEventListener('change', (e) =>
                this.cambiarMapaBase(e.target.value)
            );

            const idCartografia =
                idPorDefecto || Object.keys(this.mapasBaseConfig)[0];
            combo.value = idCartografia;
            this.cambiarMapaBase(idCartografia);

            const panelInterruptores = this.elementoRaiz.querySelector(
                '#panel-interruptores'
            );

            datosCapas.capasOperativas.forEach((capa) => {
                const nodoFilaCapa =
                    InterfazCartografia.crearFilaInterruptorCapa({
                        id: capa.id,
                        nombre: capa.nombre,
                        activoPorDefecto: capa.visibleInicial,
                    });
                panelInterruptores.appendChild(nodoFilaCapa);

                const inputCheck = nodoFilaCapa.querySelector('.interruptor__input');
                const contenedorOpacidad = nodoFilaCapa.querySelector('.capa-opacidad-contenedor');
                const inputOpacidad = nodoFilaCapa.querySelector('.interruptor__opacidad');
                const textoOpacidad = nodoFilaCapa.querySelector('.opacidad-valor');
                const inputCorte = nodoFilaCapa.querySelector('.interruptor__corte');
                const textoCorte = nodoFilaCapa.querySelector('.corte-valor');

                inputCheck.addEventListener('change', (e) => {
                    const estaActiva = e.target.checked;

                    this.orquestador.debug(
                        'Cartografía',
                        `Switch clickeado para capa: ${capa.id}. Estado: ${estaActiva}`
                    );
                    
                    contenedorOpacidad.style.display = estaActiva ? 'block' : 'none';
                    
                    if (estaActiva) {
                        const capaWms = this.capasOperativasCargadas[capa.id];
                        if (capaWms) {
                            const opacidadActual = capaWms.options.opacity * 100;
                            inputOpacidad.value = opacidadActual;
                            textoOpacidad.textContent = `${Math.round(opacidadActual)}%`;
                        }
                    }
                    this.conmutarCapaWMS(capa, estaActiva);
                });

                inputOpacidad.addEventListener('input', (e) => {
                    const valorOpacidad = e.target.value; 
                    textoOpacidad.textContent = `${valorOpacidad}%`;
                    const capaWms = this.capasOperativasCargadas[capa.id];
                    if (capaWms && typeof capaWms.setOpacity === 'function') {
                        capaWms.setOpacity(valorOpacidad / 100);
                    }
                });

                inputCorte.addEventListener('input', (e) => {
                    const valorCorte = parseFloat(e.target.value);
                    const filaPadre = e.target.closest('.capa-operativa-item');
                    const textoCorte = filaPadre ? filaPadre.querySelector('.corte-valor') : null;
                    if (textoCorte) textoCorte.textContent = `${valorCorte}%`;

                    const capaWms = this.capasOperativasCargadas[capa.id];
                    if (capaWms) {
                        this.aplicarCortePersiana(capaWms, valorCorte);
                    }
                });
                if (capa.visibleCartografia) {

                    this.orquestador.debug(
                        'Cartografía',
                        `Capa ${capa.id} configurada activa por defecto.`
                    );
                   
                    this.conmutarCapaWMS(capa, true);
                }
            });
        } catch (error) {
            this.orquestador.error(
                'Cartografía', 
                'Error crítico al estructurar el entorno parametrizado: ', error
            );
        }
    }

    /**
     * Alterna de forma segura el mosaico base activo en el lienzo cartográfico.
     * @param {string} idMapa Identificador del proveedor elegido.
     */
    cambiarMapaBase(idMapa) {
        this.orquestador.debug(
            'Cartografía',
            `Solicitando cambio de Mapa Base a: ${idMapa}`
        );

        const infoProveedor = this.mapasBaseConfig[idMapa];

        if (!infoProveedor || !this.instanciaMapa) return;

        if (this.capaBaseActiva) {
            this.instanciaMapa.removeLayer(this.capaBaseActiva);
        }

        this.capaBaseActiva = L.tileLayer(
            infoProveedor.url,
            infoProveedor.opciones
        ).addTo(this.instanciaMapa);
    }

    /**
     * Agrega o remueve del mapa capas del estándar WMS (Web Map Service) de OGC en tiempo real.
     */
    conmutarCapaWMS(configCapa, estaActiva) {
        this.orquestador.debug(
            'Cartografía',
            `Conmutar capa WMS invocado para: ${configCapa.id} (Activar: ${estaActiva})`
        );

        if (!this.instanciaMapa) {
            this.orquestador.error(
                'Cartografía',
                'Error crítico: La instancia del mapa no está definida.'
            );
            return;
        }

        if (estaActiva) {
            const nodoFila = this.elementoRaiz.querySelector(`[data-capa-id="${configCapa.id}"]`);
            const inputOpacidad = nodoFila ? nodoFila.querySelector('.interruptor__opacidad') : null;
            const opacidadInicial = inputOpacidad ? (parseFloat(inputOpacidad.value) / 100) : 1.0;
            
            const inputCorte = nodoFila ? nodoFila.querySelector('.interruptor__corte') : null;
            const corteInicial = inputCorte ? parseFloat(inputCorte.value) : 100;

            this.orquestador.debug(
                'Cartografía',
                `Valores iniciales leídos -> Opacidad: ${opacidadInicial}, Corte: ${corteInicial}%`
            );

            const capaWms = L.tileLayer.wms(configCapa.url, {
                layers: configCapa.capa,
                format: 'image/png',
                transparent: true,
                version: configCapa.version,
                attribution: configCapa.atribucion,
                tipoGeometria: configCapa.tipo || 'poligono',
                nombreCapa: configCapa.nombre || 'Capa Operativa',
                opacity: opacidadInicial,
                maxZoom: 22,
                maxNativeZoom: 18
            });

            this.capasOperativasCargadas[configCapa.id] = capaWms;

            const inputCorteInicial = nodoFila ? nodoFila.querySelector('.interruptor__corte') : null;
            const sincronizarCorte = () => {
                const valorActual = inputCorteInicial ? parseFloat(inputCorteInicial.value) : 100;
                this.aplicarCortePersiana(capaWms, valorActual);
            };

            capaWms.on('load tileload', sincronizarCorte);
            this.instanciaMapa.on('move zoom zoomend', sincronizarCorte);

            this.orquestador.debug('Cartografía', 'Ejecutando capaWms.addTo(mapa)');
            capaWms.addTo(this.instanciaMapa);

        } else {
            const capaExistente = this.capasOperativasCargadas[configCapa.id];
            if (capaExistente) {
                this.instanciaMapa.removeLayer(capaExistente);
                delete this.capasOperativasCargadas[configCapa.id];
                this.orquestador.debug('Cartografía', `Capa ${configCapa.id} removida correctamente.`);
            }
        }
    }

    /**
     * Aplica (o quita) el recorte tipo "persiana" sobre una capa WMS.
     */
    aplicarCortePersiana(capaWms, valorCorte) {
        if (!capaWms || !capaWms._container || !this.instanciaMapa) return;

        const elementoCapa = capaWms._container;

        if (valorCorte >= 100) {
            elementoCapa.style.clipPath = 'none';
            return;
        }

        const tamanoMapa = this.instanciaMapa.getSize();
        const xCorteEnPantalla = tamanoMapa.x * (valorCorte / 100);

        const puntoOrigen = this.instanciaMapa.containerPointToLayerPoint([0, 0]);
        const puntoCorte = this.instanciaMapa.containerPointToLayerPoint([
            xCorteEnPantalla,
            tamanoMapa.y,
        ]);

        elementoCapa.style.clipPath = `polygon(
            ${puntoOrigen.x}px ${puntoOrigen.y}px,
            ${puntoCorte.x}px ${puntoOrigen.y}px,
            ${puntoCorte.x}px ${puntoCorte.y}px,
            ${puntoOrigen.x}px ${puntoCorte.y}px
        )`;
    }

    /**
     * Apaga todas las herramientas activas y limpia el mapa y la interfaz.
     */
    desactivarTodasLasHerramientas() {
        this.orquestador.debug(
            'Cartografía',
            'Desactivación global de herramientas solicitadas.'
        );

        if (this.moduloMedicion && this.moduloMedicion.activo) {
            this.moduloMedicion.desactivar();
        }

        if (this.moduloArea && this.moduloArea.activo) {
            this.moduloArea.desactivar();
        }

        if (this.moduloAtributos && this.moduloAtributos.activo) {
            this.moduloAtributos.desactivar();
        }

        if (this.moduloPerfilElevacion && this.moduloPerfilElevacion.activo) {
            this.moduloPerfilElevacion.desactivar();
        }
    }

    /**
     * Controles CSS coordinados de apertura y cierre del panel.
     */
    conmutarSidebar(sidebar, boton) {
        this.sidebarColapsado = !this.sidebarColapsado;
        this.orquestador.debug(
            'Cartografía',
            `Modificando contenedor del sidebar. Colapsado = ${this.sidebarColapsado}`
        );

        sidebar.classList.toggle('barra-lateral--colapsado', this.sidebarColapsado);
        boton.classList.toggle('barra-lateral__solapa--colapsada', this.sidebarColapsado);
        boton.innerText = this.sidebarColapsado ? '▶' : '◀';

        const tiempoInicio = performance.now();
        const duracionTransicion = 400; 

        const actualizarMapaContinuo = (tiempoActual) => {
            const tiempoTranscurrido = tiempoActual - tiempoInicio;

            if (this.instanciaMapa) {
                this.instanciaMapa.invalidateSize({ animate: false });
            }

            if (tiempoTranscurrido < duracionTransicion) {
                requestAnimationFrame(actualizarMapaContinuo);
            } else if (this.instanciaMapa) {
                this.instanciaMapa.invalidateSize({ animate: true });
            }
        };
        requestAnimationFrame(actualizarMapaContinuo);
    }

    /**
     * Ciclo de vida: Remueve eventos, listeners y limpia el mapa de la memoria global
     */
    destruir() {
        this.orquestador.debug(
            'Cartografía',
            'Ejecutando proceso de recolección de basura del módulo.'
        );

        if (this.moduloMedicion) {
            this.moduloMedicion.desactivar();
            this.moduloMedicion = null;
        }

        if (this.moduloArea) {
            this.moduloArea.desactivar();
            this.moduloArea = null;
        }

        if (this.moduloAtributos) {
            this.moduloAtributos.desactivar();
            this.moduloAtributos = null;
        }

        if (this.moduloPerfilElevacion) {
            this.moduloPerfilElevacion.desactivar();
            this.moduloPerfilElevacion = null;
        }

        Object.keys(this.capasOperativasCargadas).forEach((id) => {
            this.instanciaMapa.removeLayer(this.capasOperativasCargadas[id]);
        });
        this.capasOperativasCargadas = {};

        if (this.instanciaMapa) {
            this.instanciaMapa.remove();
            this.instanciaMapa = null;
        }

        this.capaBaseActiva = null;
        this.datosMapasBaseConfig = null;
        this.datosAplicacionConfig = null;
        this.herramientaActivaId = null;
        this.elementoRaiz = null;
    }
}