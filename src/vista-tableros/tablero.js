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

        // AJUSTE DE TIEMPOS: Dejamos pasar 50ms para garantizar que el nodoRaiz ya esté
        // inyectado en el DOM real antes de instanciar mapas, gráficos o buscar elementos de la UI.
        setTimeout(async () => {
            this.inicializarSubComponentes();
            this.poblarComboboxDimensiones();
            await this.poblarComboboxTableros();
            this.vincularEventosUI();
            this.actualizarFlujoAnalitico(this.config.dimensionPrincipal.campo);

            if (this.mapaCtrl) {
                this.mapaCtrl.redimensionar();
                if (this.config.visualizacion === 'mapaCalor') {
                    this.mapaCtrl.actualizarCapas(
                        this.datos,
                        this.config,
                        this.config.dimensionPrincipal.campo
                    );
                }
            }
        }, 50);

        return this.nodoRaiz;
    }

    inicializarSubComponentes() {
        this.mapaCtrl = new ControladorMapa('mapa-leaflet');
        this.mapaCtrl.inicializar();

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

        // Si la caché ya existe, no hacemos fetch de nuevo.
        if (!this.tablerosHermanos || this.tablerosHermanos.length === 0) {
            try {
                const respuesta = await fetch('./config/tableros.json');
                if (!respuesta.ok)
                    throw new Error('No se pudo leer el archivo de tableros.');

                const configGeneral = await respuesta.json();
                const todosLosTableros = configGeneral.tableros || [];

                this.tablerosHermanos = todosLosTableros.filter(
                    (t) => t.idGrupo === this.config.idGrupo
                );
            } catch (error) {
                console.error('[Tablero] Error al cargar series:', error);
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
        // Evento para cambiar dimensión analítica
        const cmb = this.nodoRaiz.querySelector('#cmb-dimensiones');
        if (cmb) {
            cmb.addEventListener('change', (e) =>
                this.actualizarFlujoAnalitico(e.target.value)
            );
        }

        // Evento para cambiar de Tablero (Año / Variante de la Serie)
        const cmbTableros = this.nodoRaiz.querySelector('#cmb-tableros');
        if (cmbTableros) {
            cmbTableros.addEventListener('change', (e) => {
                const idSeleccionado = e.target.value;
                // Usamos la caché que ya poblamos anteriormente
                const tableroDestino = this.tablerosHermanos.find(
                    (t) => t.idTablero === idSeleccionado
                );

                if (tableroDestino) {
                    this.orquestador.notificar('GRUPO_SELECCIONADO', {
                        tableroActivo: tableroDestino,
                        listaTableros: this.tablerosHermanos,
                        rutaBase: this.config.rutaBase,
                    });
                }
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
