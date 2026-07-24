import { obtenerTemplateTablero } from './interfaz-tablero.js';
import { ProcesadorAnalitico } from './procesador-analitico.js';
import { ControladorMapa } from './controlador-mapa.js';
import { ControladorGraficos } from './controlador-graficos.js';

export class Tablero {
    constructor(orquestador, configTablero, datosEstandarizados) {
        this.orquestador = orquestador;
        this.config = configTablero;
        this.datos = datosEstandarizados || [];

        this.procesador = new ProcesadorAnalitico();
        this.procesador.setDatosYConfiguracion(this.datos, this.config);

        this.mapaCtrl = null;
        this.datosActivos = this.datos;
        this.graficosCtrl = null;
        this.nodoRaiz = null;
        this.tablerosHermanos = [];
        this.anioSeleccionado = null;
        this.datosActivos = [];
    }

    async inicializar() {
        const contenedorTemporal = document.createElement('div');
        contenedorTemporal.innerHTML = obtenerTemplateTablero(this.config);
        this.nodoRaiz = contenedorTemporal.firstElementChild;

        const elementoTitulo = this.nodoRaiz.querySelector('#mapa-titulo');
        if (elementoTitulo && this.config && this.config.titulo) {
            elementoTitulo.textContent = this.config.titulo;
        }

        // Mostrar spinner al inicio
        this.mostrarSpinner(true);

        this.esperarContenedorListo().then(async () => {
            try {
                // 1. Esperar a que el mapa cargue el GeoJSON por completo
                await this.inicializarSubComponentes();
                this.poblarComboboxDimensiones();
                await this.poblarComboboxTableros();
                this.vincularEventosUI();
                this.actualizarFlujoAnalitico(
                    this.config.dimensionPrincipal.campo
                );
            } catch (error) {
                console.error('Error al inicializar el tablero:', error);
            } finally {
                // 2. Ocultar el spinner cuando todo está dibujado
                this.mostrarSpinner(false);
            }
        });

        this.orquestador.info(
            'Tablero',
            'Tablero seleccionado fue iniciado con éxito.'
        );

        return this.nodoRaiz;
    }

    async inicializarSubComponentes() {
        this.mapaCtrl = new ControladorMapa('mapa-leaflet');
        this.mapaCtrl.inicializar();
        this.mapaCtrl.redimensionar();

        const idMapaBase = this.config.idMapaBase || null;
        const mapasBaseJson = this.orquestador.configuracionMapasBase;

        this.mapaCtrl.cambiarMapaBase(idMapaBase, mapasBaseJson);

        this.datosActivos = this.datos;

        // Importante: hacer await del renderizado del mapa
        await this.mapaCtrl.actualizarCapas(
            this.datosActivos,
            this.config,
            this.config.dimensionPrincipal.campo
        );

        this.graficosCtrl = new ControladorGraficos(
            'grafico-barras',
            'grafico-pastel'
        );
    }

    mostrarSpinner(mostrar) {
        const loader = this.nodoRaiz
            ? this.nodoRaiz.querySelector('#tablero-loader')
            : null;
        if (!loader) return;

        if (mostrar) {
            loader.classList.remove('oculto');
            loader.style.display = 'flex';
        } else {
            loader.classList.add('oculto');
            setTimeout(() => {
                if (loader.classList.contains('oculto')) {
                    loader.style.display = 'none';
                }
            }, 300);
        }
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
                if (!resuelto) finalizar();
            }, 2000);
        });
    }

    async poblarComboboxTableros() {
        const cmb = this.nodoRaiz.querySelector('#cmb-tableros');
        if (!cmb) return;

        if (!this.tablerosHermanos || this.tablerosHermanos.length === 0) {
            try {
                const respuesta = await fetch('./config/tableros.json');
                if (!respuesta.ok) return;
                const configGeneral = await respuesta.json();
                this.tablerosHermanos = (configGeneral.tableros || []).filter(
                    (t) => t.idGrupo === this.config.idGrupo
                );
            } catch (error) {
                console.error('Error al cargar tableros:', error);
                return;
            }
        }

        cmb.innerHTML = '';
        const anosDisponibles = this.extraerAnosUnicos(this.datos);

        this.tablerosHermanos.forEach((tablero) => {
            const opcionPrincipal = document.createElement('option');
            opcionPrincipal.value = tablero.idTablero;
            opcionPrincipal.textContent = `${tablero.nombre || tablero.titulo} (Todos los años)`;
            if (
                tablero.idTablero === this.config.idTablero &&
                !this.anioSeleccionado
            ) {
                opcionPrincipal.selected = true;
            }
            cmb.appendChild(opcionPrincipal);

            if (anosDisponibles.length > 0) {
                anosDisponibles.sort().forEach((anio) => {
                    const opcionAnio = document.createElement('option');
                    opcionAnio.value = `${tablero.idTablero}__ANIO__${anio}`;
                    opcionAnio.textContent = ` Año ${anio}`;
                    if (this.anioSeleccionado === anio) {
                        opcionAnio.selected = true;
                    }
                    cmb.appendChild(opcionAnio);
                });
            }
        });
    }

    extraerAnosUnicos(registros) {
        const anos = new Set();
        registros.forEach((r) => {
            const mesAudi = r.mes_primera_audi || r.MES_PRIMERA_AUDI || '';
            if (mesAudi.length >= 4) {
                const y = mesAudi.substring(0, 4);
                if (!isNaN(parseInt(y))) anos.add(y);
            }
        });
        return Array.from(anos);
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
            cmbTableros.addEventListener('change', async (e) => {
                const valSeleccionado = e.target.value;
                if (valSeleccionado.includes('__ANIO__')) {
                    const [idTablero, anio] = valSeleccionado.split('__ANIO__');
                    await this.filtrarPorAnio(anio);
                } else {
                    await this.filtrarPorAnio(null);
                }
            });
        }

        const radiosVista = this.nodoRaiz.querySelectorAll(
            '.tablero__radio-input'
        );
        radiosVista.forEach((radio) => {
            radio.addEventListener('change', async (e) => {
                if (!e.target.checked) return;

                this.config.visualizacion = e.target.value;
                const dimActual = cmb?.value || this.config.dimensionPrincipal?.campo;

                this.mostrarSpinner(true);
                await new Promise((resolve) => setTimeout(resolve, 50));

                if (this.mapaCtrl) {
                    const datosParaRenderizar =
                        this.datosActivos && this.datosActivos.length > 0
                            ? this.datosActivos
                            : this.datos;

                    await this.mapaCtrl.actualizarCapas(
                        datosParaRenderizar,
                        this.config,
                        dimActual
                    );
                }

                this.mostrarSpinner(false);
            });
        });
    }

    async filtrarPorAnio(anio) {
        this.mostrarSpinner(true);

        // Dar un frame al navegador para renderizar el spinner antes de congelar el hilo con los datos
        await new Promise((resolve) => setTimeout(resolve, 50));

        this.anioSeleccionado = anio;
        let datosFiltrados = this.datos;

        if (anio) {
            datosFiltrados = this.datos.filter((r) => {
                const mesAudi = r.mes_primera_audi || r.MES_PRIMERA_AUDI || '';
                return mesAudi.startsWith(anio);
            });
        }

        this.datosActivos = datosFiltrados;
        this.procesador.setDatosYConfiguracion(datosFiltrados, this.config);

        const cmbDimensiones = this.nodoRaiz.querySelector('#cmb-dimensiones');
        const dimActual = cmbDimensiones
            ? cmbDimensiones.value
            : this.config.dimensionPrincipal.campo;

        await this.mapaCtrl.actualizarCapas(
            datosFiltrados,
            this.config,
            dimActual
        );
        this.actualizarFlujoAnalitico(dimActual);

        this.mostrarSpinner(false);
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
