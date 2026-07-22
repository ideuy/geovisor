import { obtenerTemplateTablero } from './interfaz-tablero.js';
import { ProcesadorAnalitico } from './procesador-analitico.js';
import { ControladorMapa } from './controlador-mapa.js';
import { ControladorGraficos } from './controlador-graficos.js';

/**
 * Controlador Principal de la Vista Tablero.
 * Encargado de coordinar sub-controladores y reaccionar a los eventos de la UI.
 */
export class Tablero {
    constructor(orquestador, configTablero, datosEstandarizados) {
        this.orquestador = orquestador;
        this.config = configTablero;
        this.datos = datosEstandarizados || [];

        this.procesador = new ProcesadorAnalitico();
        this.procesador.setDatosYConfiguracion(this.datos, this.config);

        this.mapaCtrl = null;
        this.graficosCtrl = null;
        this.nodoRaiz = null;
        this.tablerosHermanos = [];

        this.listaTablerosCached = null;
    }

    async inicializar() {
        const contenedorTemporal = document.createElement('div');
        contenedorTemporal.innerHTML = obtenerTemplateTablero(this.config);
        this.nodoRaiz = contenedorTemporal.firstElementChild;

        const elementoTitulo = this.nodoRaiz.querySelector('#mapa-titulo');
        if (elementoTitulo && this.config && this.config.titulo) {
            elementoTitulo.textContent = this.config.titulo;
        }

        this.esperarContenedorListo().then(async () => {
            this.inicializarSubComponentes();
            this.poblarComboboxDimensiones();
            await this.poblarComboboxTableros();
            this.vincularEventosUI();
            this.actualizarFlujoAnalitico(this.config.dimensionPrincipal.campo);
        });

        this.orquestador.info(
            'Tablero',
            'Tablero seleccionado fue iniciado con éxito.'
        );

        return this.nodoRaiz;
    }

    esperarContenedorListo() {
        return new Promise((resolve) => {
            const ubicarContenedor = () =>
                this.nodoRaiz
                    ? this.nodoRaiz.querySelector('#mapa-leaflet')
                    : null;

            let resuelto = false;
            const finalizar = () => {
                if (resuelto) return;
                resuelto = true;
                if (observer) observer.disconnect();
                resolve();
            };

            const contenedorInicial = ubicarContenedor();
            if (
                contenedorInicial &&
                contenedorInicial.offsetWidth > 0 &&
                contenedorInicial.offsetHeight > 0
            ) {
                finalizar();
                return;
            }

            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (
                        entry.contentRect.width > 0 &&
                        entry.contentRect.height > 0
                    ) {
                        finalizar();
                        return;
                    }
                }
            });

            const esperarNodoEnDom = () => {
                const nodo = ubicarContenedor();
                if (nodo) {
                    observer.observe(nodo);
                } else if (!resuelto) {
                    requestAnimationFrame(esperarNodoEnDom);
                }
            };
            esperarNodoEnDom();

            setTimeout(() => {
                if (!resuelto) {
                    this.orquestador.warn(
                        'Tablero',
                        'El contenedor del mapa no reportó un tamaño válido a tiempo; se continúa de todas formas.'
                    );
                    finalizar();
                }
            }, 2000);
        });
    }

    inicializarSubComponentes() {
        this.mapaCtrl = new ControladorMapa('mapa-leaflet');
        this.mapaCtrl.inicializar();
        this.mapaCtrl.redimensionar();

        const idMapaBase = this.config.idMapaBase || null;
        const mapasBaseJson = this.orquestador.configuracionMapasBase;

        this.mapaCtrl.cambiarMapaBase(idMapaBase, mapasBaseJson);

        this.mapaCtrl.actualizarCapas(
            this.datos,
            this.config,
            this.config.dimensionPrincipal.campo
        );

        this.graficosCtrl = new ControladorGraficos(
            'grafico-barras',
            'grafico-pastel'
        );
    }

    async poblarComboboxTableros() {
        const cmb = this.nodoRaiz.querySelector('#cmb-tableros');
        if (!cmb) return;

        if (!this.tablerosHermanos || this.tablerosHermanos.length === 0) {
            try {
                const respuesta = await fetch('./config/tableros.json');
                if (!respuesta.ok)
                    this.orquestador.throwError(
                        'Tablero',
                        'No se pudo leer el archivo de tableros.'
                    );

                const configGeneral = await respuesta.json();
                const todosLosTableros = configGeneral.tableros || [];

                this.tablerosHermanos = todosLosTableros.filter(
                    (t) => t.idGrupo === this.config.idGrupo
                );
            } catch (error) {
                this.orquestador.error(
                    'Tablero',
                    'Error al cargar series:',
                    error
                );
                cmb.innerHTML =
                    '<option value="">Error al cargar series</option>';
                return;
            }
        }
        cmb.innerHTML = '';
        this.tablerosHermanos.forEach((tablero) => {
            const opcion = document.createElement('option');
            opcion.value = tablero.idTablero;
            opcion.textContent = tablero.nombre || tablero.titulo;

            if (tablero.idTablero === this.config.idTablero) {
                opcion.selected = true;
            }
            cmb.appendChild(opcion);
        });
    }

    recargarDatosMismoTablero(nuevaConfig, nuevosDatos) {
        this.orquestador.debug(
            'Tablero',
            `Recarga silenciosa de datos: ${nuevaConfig.idTablero}`
        );

        this.config = nuevaConfig;
        this.datos = nuevosDatos || [];
        this.procesador.setDatosYConfiguracion(this.datos, this.config);

        const elementoTitulo = this.nodoRaiz.querySelector('#mapa-titulo');
        if (elementoTitulo) {
            elementoTitulo.textContent = this.config.titulo || '';
        }

        const cmbTableros = this.nodoRaiz.querySelector('#cmb-tableros');
        if (cmbTableros && cmbTableros.value !== this.config.idTablero) {
            cmbTableros.value = this.config.idTablero;
        }

        this.poblarComboboxDimensiones();

        const cmbDimensiones = this.nodoRaiz.querySelector('#cmb-dimensiones');
        const campoDimension = cmbDimensiones
            ? cmbDimensiones.value
            : this.config.dimensionPrincipal.campo;

        this.mapaCtrl.actualizarCapas(this.datos, this.config, campoDimension);
        this.actualizarFlujoAnalitico(campoDimension);

        this._habilitarComboTableros();
    }

    notificarErrorRecarga() {
        const cmbTableros = this.nodoRaiz.querySelector('#cmb-tableros');
        if (cmbTableros) {
            cmbTableros.value = this.config.idTablero;
        }
        this._habilitarComboTableros();
    }

    _habilitarComboTableros() {
        const cmbTableros = this.nodoRaiz.querySelector('#cmb-tableros');
        if (cmbTableros) {
            cmbTableros.disabled = false;
        }
    }

    poblarComboboxDimensiones() {
        const cmb = this.nodoRaiz.querySelector('#cmb-dimensiones');
        if (!cmb) return;
        cmb.innerHTML = '';
        const dimensiones = this.procesador.obtenerDimensionesDisponibles();
        dimensiones.forEach((dim) => {
            const opcion = document.createElement('option');
            opcion.value = dim.campo;
            opcion.textContent = dim.titulo;
            cmb.appendChild(opcion);
        });
    }

    vincularEventosUI() {
        const cmb = this.nodoRaiz.querySelector('#cmb-dimensiones');
        if (cmb) {
            cmb.addEventListener('change', (e) =>
                this.actualizarFlujoAnalitico(e.target.value)
            );
        }

        const cmbTableros = this.nodoRaiz.querySelector('#cmb-tableros');
        if (cmbTableros) {
            cmbTableros.addEventListener('change', (e) => {
                const idSeleccionado = e.target.value;
                const tableroDestino = this.tablerosHermanos.find(
                    (t) => t.idTablero === idSeleccionado
                );

                if (!tableroDestino) return;

                cmbTableros.disabled = true;

                this.orquestador.notificar(
                    'CAMBIO_TABLERO_INTERNO',
                    tableroDestino
                );
            });
        }

        // Eventos de tipo de visualización geográfica
        const selectoresGeo = this.nodoRaiz.querySelectorAll(
            'input[name="tipo-geo"]'
        );
        selectoresGeo.forEach((radio) => {
            radio.addEventListener('change', (e) => {
                const modoSeleccionado = e.target.value;
                const selectDimension =
                    this.nodoRaiz.querySelector('#cmb-dimensiones');
                const cmbActual = selectDimension
                    ? selectDimension.value
                    : this.config.dimensionPrincipal.campo;

                this.config.visualizacion = modoSeleccionado;
                if (this.mapaCtrl) {
                    this.mapaCtrl.actualizarCapas(
                        this.datos,
                        this.config,
                        cmbActual
                    );
                }
            });
        });
    }

    actualizarFlujoAnalitico(campoDimension) {
        const dimensiones = this.procesador.obtenerDimensionesDisponibles();
        const infoDim = dimensiones.find((d) => d.campo === campoDimension);
        const tituloDim = infoDim ? infoDim.titulo : campoDimension;

        const totalCasos = this.procesador.calcularTotalCasos();
        const totalCategorias =
            this.procesador.calcularTotalCategoriasUnicas(campoDimension);
        const distribucion =
            this.procesador.obtenerDistribucionPorColumna(campoDimension);

        const txtCasos = this.nodoRaiz.querySelector('#txt-total-casos');
        const txtDimensiones = this.nodoRaiz.querySelector(
            '#txt-total-dimensiones'
        );

        if (txtCasos) txtCasos.textContent = totalCasos.toLocaleString();
        if (txtDimensiones)
            txtDimensiones.textContent = totalCategorias.toLocaleString();

        if (this.graficosCtrl) {
            this.graficosCtrl.actualizarGraficos(distribucion, tituloDim);
        }
        this.actualizarTablaResumen(distribucion);
    }

    actualizarTablaResumen(distribucion) {
        const tbody = this.nodoRaiz.querySelector('#tabla-resumen-datos tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        distribucion.forEach((item) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.categoria}</td><td><strong>${item.casos.toLocaleString()}</strong></td>`;
            tbody.appendChild(tr);
        });
    }

    destruir() {
        if (this.mapaCtrl) this.mapaCtrl.removerTodasLasCapasDeDatos();
        if (this.graficosCtrl) this.graficosCtrl.destruir();
        this.nodoRaiz = null;
    }
}
