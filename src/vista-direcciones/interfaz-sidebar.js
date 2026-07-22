/**
 * interfaz-sidebar.js
 * Gestiona el panel lateral, colapso y herramientas.
 */
export class InterfazSidebar {
    constructor(sidebarId, toggleBtnId, orquestador) {
        this.sidebarDOM = document.getElementById(sidebarId);
        this.btnToggleDOM = document.getElementById(toggleBtnId);
        this.orquestador = orquestador;

        this.cuerpoDOM = this.sidebarDOM
            ? this.sidebarDOM.querySelector('#contenedor-dinamico-sidebar')
            : null;

        if (!this.cuerpoDOM) {
            console.warn(
                '[ADVERTENCIA] InterfazSidebar: No se encontró #contenedor-dinamico-sidebar dentro del sidebar.'
            );
        }
    }

    inicializar(proveedoresMapaBase, idMapaBaseActual, callbackCambioMapa) {
        if (!this.sidebarDOM || !this.btnToggleDOM || !this.cuerpoDOM) return;

        this.btnToggleDOM.addEventListener('click', () => {
            this.sidebarDOM.classList.toggle('barra-lateral--colapsado');
            setTimeout(() => {
                if (this.orquestador && this.orquestador.mapaDirecciones) { 
                    this.orquestador.mapaDirecciones.invalidateSize({ animate: true });
                }
            }, 400);
        });

        this._renderizarSeccionMapasBase(
            proveedoresMapaBase,
            idMapaBaseActual,
            callbackCambioMapa
        );
    }

    _renderizarSeccionMapasBase(proveedores, idActual, callbackCambioMapa) {
        if (!this.cuerpoDOM) return;

        this.cuerpoDOM.insertAdjacentHTML(
            'beforeend',
            `
            <div>
                <p class="barra-lateral__titulo barra-lateral__titulo--direcciones">Mapas Base</p>
                <div id="wrapper-select-mapas"></div>
            </div>
        `
        );

        const wrapper = this.cuerpoDOM.querySelector('#wrapper-select-mapas');
        const select = document.createElement('select');

        select.className = 'combobox combobox--direcciones';

        Object.keys(proveedores).forEach((id) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = proveedores[id].nombre;
            if (id === idActual) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            if (callbackCambioMapa) callbackCambioMapa(e.target.value);
        });

        wrapper.appendChild(select);
    }

    renderizarCapasOperativas(capasOperativas, callbackToggle) {
        if (!this.cuerpoDOM) return;

        this.cuerpoDOM.insertAdjacentHTML(
            'beforeend',
            `
            <div>
                <p class="barra-lateral__titulo barra-lateral__titulo--direcciones">Capas Operativas</p>
                <div id="wrapper-capas-operativas" class="panel-interruptores"></div>
            </div>
        `
        );

        const wrapper = this.cuerpoDOM.querySelector(
            '#wrapper-capas-operativas'
        );

        capasOperativas.forEach((capa) => {
            if (capa.id === 'series_electorales') return;

            const labelContainer = document.createElement('label');
            labelContainer.className = 'interruptor';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'interruptor__input';
            input.checked = capa.visibleInicial || false;

            const slider = document.createElement('span');
            slider.className = 'interruptor__slider';

            const texto = document.createElement('span');
            texto.className = 'interruptor__texto';
            texto.textContent = capa.nombre;

            labelContainer.appendChild(input);
            labelContainer.appendChild(slider);
            labelContainer.appendChild(texto);

            input.addEventListener('change', (e) => {
                callbackToggle(capa, e.target.checked);
            });

            wrapper.appendChild(labelContainer);

            if (capa.visibleInicial) {
                callbackToggle(capa, true);
            }
        });
    }

    /**
     * Renderiza herramientas exclusivas en formato de grilla segmentada (Radio Buttons).
     * @param {string} titulo - Título de la sección.
     * @param {Array} herramientas - Lista de objetos { id, label, icon }.
     */
    renderizarHerramientasExclusivas(titulo, herramientas) {
        const contenedor = document.createElement('div');
        contenedor.innerHTML = `<h3 class="barra-lateral__titulo barra-lateral__titulo--direcciones">${titulo}</h3>`;

        const grid = document.createElement('div');
        grid.className = 'control-segmentado';

        herramientas.forEach(h => {
            const item = document.createElement('div');
            item.className = 'control-segmentado__item';
            item.innerHTML = `
                <input type="radio" name="herramienta-activa" id="${h.id}" class="control-segmentado__input">
                <label for="${h.id}" class="control-segmentado__label">
                    <span class="icono-herramienta">${h.icon}</span>
                    ${h.label}
                </label>
            `;
            grid.appendChild(item);
        });

        contenedor.appendChild(grid);
        return contenedor;
    }

    /**
     * Renderiza modificadores en formato de interruptores (Switches).
     * @param {string} titulo - Título de la sección.
     * @param {Array} modificadores - Lista de objetos { id, label, description }.
     */
    renderizarModificadores(titulo, modificadores) {
        const contenedor = document.createElement('div');
        contenedor.innerHTML = `<p class="barra-lateral__titulo barra-lateral__titulo--direcciones">${titulo}</p>`;

        const panel = document.createElement('div');
        panel.className = 'panel-interruptores';

        modificadores.forEach(m => {
            const wrapper = document.createElement('label');
            wrapper.className = 'interruptor';
            wrapper.innerHTML = `
                <input type="checkbox" class="interruptor__input" id="${m.id}">
                <span class="interruptor__slider"></span>
                <div class="modificador-texto">
                    <span class="modificador-nombre">${m.label}</span>
                    <span class="modificador-descripcion">${m.description}</span>
                </div>
            `;
            panel.appendChild(wrapper);
        });

        contenedor.appendChild(panel);
        return contenedor;
    }
}