/**
 * interfaz-cartografia.js
 * Capa de Interfaz de Usuario (UI) para la Vista Cartografía.
 */

export class InterfazCartografia {
    /**
     * Construye la estructura de contenedores principal para el layout cartográfico.
     * Define el andamiaje del Sidebar, la solapa flotante y el contenedor del mapa.
     * @returns {HTMLElement} El contenedor raíz del layout completo.
     */
    static crearContenedorCartografia() {
        const contenedorRaiz = document.createElement('div');
        contenedorRaiz.className = 'contenedor-vista';

        contenedorRaiz.innerHTML = `
            <aside id="sidebar-capas" class="barra-lateral">
                    
                <p class="barra-lateral__titulo">Mapas Base</p>
                <select id="combo-mapas-base" class="combobox"></select>

                <p class="barra-lateral__titulo">Capas Operativas</p>
                <div id="panel-interruptores" class="panel-interruptores"></div>

                <p class="barra-lateral__titulo">Herramientas Cartografía</p>
                <div id="panel-herramientas-segmentado"></div>
            </aside>

            <button id="btn-solapa-sidebar" class="barra-lateral__solapa" title="Ocultar/Mostrar Panel">
                ◀
            </button>

            <div id="mapa-base-leaflet" class="mapa-contenedor"></div>
        `;

        return contenedorRaiz;
    }

    /**
     * Genera una opción HTML individual (<option>) para poblar el combobox de mapas base.
     * @param {Object} proveedor Objeto que contiene las propiedades mapeadas del proveedor de mapas.
     * @param {string} proveedor.id Identificador único del mapa base.
     * @param {string} proveedor.nombre Nombre legible que se desplegará en la interfaz.
     * @returns {HTMLOptionElement} El elemento option del DOM listo para anexar.
     */
    static crearOpcionMapaBase(proveedor) {
        const opcion = document.createElement('option');
        opcion.value = proveedor.id;
        opcion.textContent = proveedor.nombre;
        return opcion;
    }

    /**
     * Genera un bloque de control completo acoplándose al CSS nativo.
     * @param {Object} config Datos parametrizados de la capa operativa.
     * @returns {HTMLElement} Contenedor limpio listo para inyectarse en el panel.
     */
    static crearFilaInterruptorCapa(config) {
        const fila = document.createElement('div');
        fila.className = 'capa-operativa-item';
        fila.setAttribute('data-capa-id', config.id);

        fila.innerHTML = `
            <label class="interruptor">
                <input type="checkbox" class="interruptor__input" ${config.activoPorDefecto ? 'checked' : ''}>
                <span class="interruptor__slider"></span>
                <span class="interruptor__texto">${config.nombre}</span>
            </label>
            
            <div class="capa-opacidad-contenedor" style="display: ${config.activoPorDefecto ? 'block' : 'none'};">
                
                <div class="capa-opacidad-meta meta-opacidad">
                    <span class="opacidad-titulo">Opacidad</span>
                    <span class="opacidad-valor">100%</span>
                </div>
                <input type="range" class="interruptor__opacidad" min="0" max="100" value="100">
                
                <div class="capa-opacidad-meta meta-corte">
                    <span class="corte-titulo">Visibilidad</span>
                    <span class="corte-valor">100%</span>
                </div>
                <input type="range" class="interruptor__corte" min="0" max="100" value="100">
                
            </div>
        `;
        return fila;
    }

    /**
     * Genera el grupo segmentado (radio buttons estilizados) para las
     * herramientas exclusivas de Cartografía. 
     * @param {Array} herramientas Lista de objetos { id, label, icon }.
     * @returns {HTMLElement} Contenedor con la grilla `.control-segmentado`.
     */
    static crearPanelHerramientasExclusivas(herramientas) {
        const grid = document.createElement('div');
        grid.className = 'control-segmentado';

        herramientas.forEach((h) => {
            const item = document.createElement('div');
            item.className = 'control-segmentado__item';
            item.innerHTML = `
                <input type="radio" name="herramienta-cartografia-activa" id="${h.id}" class="control-segmentado__input">
                <label for="${h.id}" class="control-segmentado__label">
                    <span class="icono-herramienta">${h.icon}</span>
                    ${h.label}
                </label>
            `;
            grid.appendChild(item);
        });

        return grid;
    }
}