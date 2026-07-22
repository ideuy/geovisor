/**
 * buscador-direcciones.js
 * Módulo encargado de gestionar la interfaz del buscador y desplegar los resultados
 */
export class BuscadorDirecciones {
    constructor(orquestador, servicio, callbacks = {}) {
        this.orquestador = orquestador;
        this.servicio = servicio;
        this.callbacks = callbacks;
        this.inputBuscarDOM = null;
        this.listaSugerenciasDOM = null;
        this.selectFiltroDOM = null;
        this.selectLimiteDOM = null;
        this.debounceTimer = null;
        this.isSelecting = false;
        this._handlerClickFuera = null;
    }

    inicializar() {
        this.orquestador.debug(
            'Buscador Direcciones',
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

        if (this.inputBuscarDOM) {
            this.inputBuscarDOM.addEventListener('input', () =>
                this.manejarInput()
            );
        }

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

        // Cierre al hacer clic fuera del contenedor
        this._handlerClickFuera = (evento) => {
            const contenedorBuscador = document.getElementById(
                'buscador-direcciones-container'
            );
            if (
                contenedorBuscador &&
                !contenedorBuscador.contains(evento.target)
            ) {
                this.limpiarSugerenciasDOM();
            }
        };

        document.addEventListener('click', this._handlerClickFuera);
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
        const query = this.inputBuscarDOM
            ? this.inputBuscarDOM.value.trim()
            : '';
        if (query.length >= 3) {
            clearTimeout(this.debounceTimer);
            this.ejecutarAutocomplete(query);
        }
    }

    establecerFiltro(valor, deshabilitar = false) {
        if (!this.selectFiltroDOM) return;

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

        this.selectFiltroDOM.blur();
        this.selectFiltroDOM.dispatchEvent(
            new Event('change', { bubbles: true })
        );
    }

    async ejecutarAutocomplete(terminoBusqueda) {
        if (!this.servicio) return;

        const filtroSeleccionado = this.selectFiltroDOM
            ? this.selectFiltroDOM.value
            : 'CALLEyPORTAL';
        const limiteSeleccionado = this.selectLimiteDOM
            ? parseInt(this.selectLimiteDOM.value, 10)
            : 10;

        // Booleano nativo true si la categoría seleccionada es LOCALIDAD
        const soloLocalidad = filtroSeleccionado === 'LOCALIDAD';

        try {
            const respuestaServicio = await this.servicio.buscarCandidatos(
                terminoBusqueda,
                soloLocalidad,
                limiteSeleccionado
            );

            // Garantizamos trabajar siempre con un Array válido
            const listaCandidatos = Array.isArray(respuestaServicio)
                ? respuestaServicio
                : respuestaServicio?.candidates || [];

            const resultadosFiltrados = listaCandidatos.filter((item) => {
                if (!item) return false;
                if (filtroSeleccionado === 'LOCALIDAD')
                    return item.type === 'LOCALIDAD';
                if (filtroSeleccionado === 'CALLEyPORTAL') return true;
                if (filtroSeleccionado === 'CALLE')
                    return item.type === 'CALLE';
                if (filtroSeleccionado === 'POI') return item.type === 'POI';
                return true;
            });

            // Muestra sugerencias o mensaje de sin resultados dentro de la <ul> existente
            this.renderizarResultados(resultadosFiltrados);
        } catch (error) {
            this.orquestador.error(
                'Buscador Direcciones',
                'Error en ejecutarAutocomplete:',
                error
            );

            if (this.listaSugerenciasDOM) {
                this.listaSugerenciasDOM.innerHTML = `
                    <li class="mensaje-error-busqueda">
                        ⚠️ <strong>Error de conexión</strong><br>
                        <small>No pudimos conectar con el servicio.</small>
                    </li>
                `;
                this.listaSugerenciasDOM.style.display = 'block';
            }
        }
    }

    renderizarResultados(items) {
        this.limpiarSugerenciasDOM();
        if (!this.listaSugerenciasDOM) return;

        if (!items || items.length === 0) {
            this.listaSugerenciasDOM.innerHTML = `
                <li class="buscador-flotante__sin-resultados">Sin resultados coincidentes</li>
            `;
            this.listaSugerenciasDOM.style.display = 'block';
            return;
        }

        const fragmento = document.createDocumentFragment();

        items.forEach((item) => {
            const direccionTexto =
                item.address ||
                item.direccion ||
                item.nomVia ||
                'Dirección sin nombre';

            const elementoLi = document.createElement('li');
            elementoLi.className = 'resultado-item';
            elementoLi.setAttribute('data-tooltip', direccionTexto);
            elementoLi.setAttribute('title', direccionTexto);

            let rutaIcono = './imagenes/direccion.svg';
            if (item.type === 'LOCALIDAD')
                rutaIcono = './imagenes/localidad.svg';
            else if (item.type === 'CALLE') rutaIcono = './imagenes/calle.svg';
            else if (item.type === 'POI') rutaIcono = './imagenes/poi.svg';

            elementoLi.innerHTML = `
                <img src="${rutaIcono}" class="buscador-flotante__resultados-icono" alt="${item.type || 'icono'}" onerror="this.style.display='none';">
                <span>${direccionTexto}</span>
            `;

            elementoLi.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isSelecting = true;

                this.inputBuscarDOM.value = direccionTexto;
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

        if (this._handlerClickFuera) {
            document.removeEventListener('click', this._handlerClickFuera);
            this._handlerClickFuera = null;
        }
    }
}
