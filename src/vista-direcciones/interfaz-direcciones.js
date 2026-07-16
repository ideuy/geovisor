/**
 * interfaz-direcciones.js
 * Componente UI encargado de generar la estructura HTML para la vista Direcciones
 */
export class InterfazDirecciones {
    static crearContenedorDirecciones() {
        const contenedor = document.createElement('div');
        contenedor.className = 'contenedor-vista-direcciones';

        contenedor.innerHTML = `
            <div id="buscador-direcciones-container" class="buscador-flotante">
                <div class="buscador-flotante__grupo">
                    <svg class="buscador-flotante__input-icono" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="input-busqueda-direcciones" class="buscador-flotante__input" placeholder="Ej: liniers 1280, montevido │ Ej: m22s12, soly, cane (mínimo 4 letras)" autocomplete="off">
                </div>

                <ul id="lista-resultados-autocomplete" class="buscador-flotante__resultados"></ul>

                <div class="buscador-flotante__controles-fila">
                    <div>
                        <select id="select-filtro-tipo" class="combobox">
                            <option value="CALLEyPORTAL" selected>Direcciones</option>
                            <option value="CALLE">Calles</option>
                            <option value="POI">Punto de Interés</option>
                            <option value="LOCALIDAD">Localidades</option>                            
                        </select>
                    </div>
                    <div>
                        <select id="select-limite-resultados" class="combobox">
                            <option value="1">1</option>                            
                            <option value="5">5</option>                        
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                            <option value="25">50</option>

                        </select>
                    </div>
                </div>
            </div>

            <div id="contenedor-mapillary" class="direcciones-mapillary-flotante"></div>
            
            <div id="mapa-direcciones-leaflet"></div>

            <div class="barra-lateral" id="sidebar-herramientas">
                <div id="contenedor-dinamico-sidebar"></div>
            </div>

            <button id="btn-toggle-sidebar-herramientas" class="barra-lateral__solapa" title="Ocultar/Mostrar Panel">
                <span class="barra-lateral__flecha">
                    ◀
                </span>
            </button>
        `;

        return contenedor;
    }
}