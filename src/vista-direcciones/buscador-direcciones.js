/**
 * buscador-direcciones.js
 * Módulo encargado de gestionar la interfaz del buscador
 */
export class BuscadorDirecciones {
    /**
     * @param {Object} orquestador - Referencia para logs.
     * @param {Object} servicio - Instancia de ServicioDirecciones para hacer las consultas.
     * @param {Object} callbacks - Funciones para notificar al orquestador.
     * @param {Function} callbacks.onClear - Se ejecuta cuando el usuario borra el input.
     * @param {Function} callbacks.onSelect - Se ejecuta cuando el usuario elige una sugerencia.
     */
    constructor(orquestador, servicio, callbacks) {
        this.orquestador = orquestador;
        this.servicio = servicio;
        this.callbacks = callbacks;
        this.inputBuscarDOM = null;
        this.listaSugerenciasDOM = null;
        this.selectFiltroDOM = null;
        this.selectLimiteDOM = null;
        this.debounceTimer = null;
        this.isSelecting = false;
    }

    inicializar() {
        this.orquestador.registrarDebug(
            'Buscador',
            'Inicializando módulo de Búsqueda y Autocomplete.'
        );

        this.inputBuscarDOM = document.getElementById(
            'input-busqueda-direcciones'
        );
        this.listaSugerenciasDOM = document.getElementById(
            'lista-resultados-autocomplete'
        );
        this.selectFiltroDOM = document.getElementById('select-filtro-tipo');
        this.selectLimiteDOM = document.getElementById(
            'select-limite-resultados'
        );

        if (!this.inputBuscarDOM || !this.listaSugerenciasDOM) {
            console.warn('[Buscador] Faltan elementos clave en el DOM.');
            return;
        }

        this.inputBuscarDOM.addEventListener('input', () =>
            this.manejarInput()
        );

        if (this.selectFiltroDOM) {
            this.selectFiltroDOM.addEventListener('change', () =>
                this.refrescarBusqueda()
            );
        }
        if (this.selectLimiteDOM) {
            this.selectLimiteDOM.addEventListener('change', () =>
                this.refrescarBusqueda()
            );
        }

        document.addEventListener('click', (evento) => {
            const contenedorBuscador = document.getElementById(
                'buscador-direcciones-container'
            );
            if (
                contenedorBuscador &&
                !contenedorBuscador.contains(evento.target)
            ) {
                this.limpiarSugerenciasDOM();
            }
        });
    }

    manejarInput() {
        if (this.isSelecting) return;

        clearTimeout(this.debounceTimer);
        const query = this.inputBuscarDOM.value.trim();

        if (query.length === 0) {
            this.limpiarSugerenciasDOM();
            if (this.callbacks.onClear) this.callbacks.onClear();
            return;
        }

        if (query.length < 3) {
            this.limpiarSugerenciasDOM();
            return;
        }

        this.debounceTimer = setTimeout(() => {
            this.ejecutarAutocomplete(query);
        }, 300);
    }

    refrescarBusqueda() {
        const query = this.inputBuscarDOM.value.trim();
        if (query.length >= 3) {
            clearTimeout(this.debounceTimer);
            this.ejecutarAutocomplete(query);
        }
    }

    /**
     * Cambia el filtro del buscador y desbloquea el combobox si es necesario.
     * @param {string} valor - El valor de la opción ('CALLEyPORTAL', 'CALLE', etc.)
     * @param {boolean} deshabilitar - Si debe bloquearse el select
     */
    establecerFiltro(valor, deshabilitar = false) {
        if (!this.selectFiltroDOM) return;

        // Protección de doble ejecución
        if (
            this.selectFiltroDOM.value === valor &&
            this.selectFiltroDOM.disabled === deshabilitar
        ) {
            return;
        }

        this.selectFiltroDOM.disabled = deshabilitar;
        this.selectFiltroDOM.value = valor;

        if (this.selectFiltroDOM.value !== valor) {
            const option = this.selectFiltroDOM.querySelector(
                `option[value="${valor}"]`
            );
            if (option) option.selected = true;
        }
        // ---------------------------------

        this.selectFiltroDOM.blur();

        this.selectFiltroDOM.dispatchEvent(
            new Event('change', { bubbles: true })
        );
    }

    /**
     * Consulta al servicio de direcciones sin la opción redundante 'Todos'.
     * @param {string} terminoBusqueda
     */
    async ejecutarAutocomplete(terminoBusqueda) {
        if (!this.servicio) return;

        const contenedorResultados = document.querySelector(
            '.buscador-flotante__resultados'
        );

        const filtroSeleccionado = this.selectFiltroDOM
            ? this.selectFiltroDOM.value
            : 'CALLEyPORTAL';
        const limiteSeleccionado = this.selectLimiteDOM
            ? this.selectLimiteDOM.value
            : 10;

        const soloLocalidadParam =
            filtroSeleccionado === 'LOCALIDAD' ? 'true' : 'false';

        try {
            const listaCandidatos = await this.servicio.buscarCandidatos(
                terminoBusqueda,
                soloLocalidadParam,
                limiteSeleccionado
            );

            const resultadosFiltrados = listaCandidatos.filter((item) => {
                if (filtroSeleccionado === 'LOCALIDAD')
                    return item.type === 'LOCALIDAD';
                if (filtroSeleccionado === 'CALLEyPORTAL') return true;
                if (filtroSeleccionado === 'CALLE')
                    return item.type === 'CALLE';
                if (filtroSeleccionado === 'POI') return item.type === 'POI';
                return false;
            });

            if (resultadosFiltrados.length === 0 && contenedorResultados) {
                contenedorResultados.innerHTML =
                    '<div class="mensaje-sin-resultados">No se encontraron coincidencias.</div>';
            } else {
                this.renderizarResultados(resultadosFiltrados);
            }
        } catch (error) {
            console.error('[ERROR][Buscador.autocomplete]', error);

            if (contenedorResultados) {
                contenedorResultados.innerHTML = `
                <div class="mensaje-error-busqueda">
                    <p>⚠️ <strong>Error de conexión</strong></p>
                    <small>No pudimos conectar con el servidor. Verifica tu red e intenta nuevamente.</small>
                </div>
            `;
            }
        }
    }

    /**
     * Construye e inyecta los elementos <li> en la lista desplegable.
     * @param {Array} items
     */
    renderizarResultados(items) {
        this.limpiarSugerenciasDOM();

        if (items.length === 0) {
            this.listaSugerenciasDOM.innerHTML = `<li class="buscador-flotante__sin-resultados">Sin resultados coincidentes</li>`;
            this.listaSugerenciasDOM.style.display = 'block';
            return;
        }

        const fragmento = document.createDocumentFragment();

        items.forEach((item) => {
            const elementoLi = document.createElement('li');
            elementoLi.className = 'resultado-item';
            elementoLi.setAttribute('data-tooltip', item.address);
            elementoLi.setAttribute('title', item.address);

            let rutaIcono = '/imagenes/direccion.svg';
            if (item.type === 'LOCALIDAD')
                rutaIcono = '/imagenes/localidad.svg';
            else if (item.type === 'CALLE') rutaIcono = '/imagenes/calle.svg';
            else if (item.type === 'POI') rutaIcono = '/imagenes/poi.svg';

            elementoLi.innerHTML = `
                <img src=".${rutaIcono}" class="buscador-flotante__resultados-icono" alt="${item.type}" onerror="this.style.display='none';">
                <span>${item.address}</span>
            `;

            elementoLi.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isSelecting = true;

                this.inputBuscarDOM.value = item.address;
                this.limpiarSugerenciasDOM();

                if (this.callbacks.onSelect) {
                    this.callbacks.onSelect(item);
                }

                setTimeout(() => {
                    this.isSelecting = false;
                }, 800);
            });

            fragmento.appendChild(elementoLi);
        });

        this.listaSugerenciasDOM.appendChild(fragmento);
        this.listaSugerenciasDOM.style.display = 'block';
    }

    limpiarInput() {
        if (this.inputBuscarDOM) {
            this.inputBuscarDOM.value = '';
        }

        this.limpiarSugerenciasDOM();
        this.establecerFiltro('CALLEyPORTAL', false);
    }

    limpiarSugerenciasDOM() {
        if (this.listaSugerenciasDOM) {
            this.listaSugerenciasDOM.innerHTML = '';
            this.listaSugerenciasDOM.style.display = 'none';
        }
    }

    destruir() {
        clearTimeout(this.debounceTimer);
        this.limpiarSugerenciasDOM();
    }
}