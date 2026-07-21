/**
 * interfaz-tematicas.js
 * Interfaz pura para la vista de Ejes Temáticos.
 */
export class InterfazTematicas {
    /**
     * Crea la estructura base de la vista utilizando el contenedor estructural de temáticas
     * @param {Object} encabezado Datos del título y descripción de la sección
     * @returns {HTMLElement} Contenedor listo para el Orquestador
     */
    static crearContenedorBase(encabezado) {
        const contenedor = document.createElement('div');
        
        contenedor.className = 'vista-tematicas-contenedor'; 

        contenedor.innerHTML = `
            <div class="tematicas-encabezado">
                <h1 class="tematicas-encabezado__titulo">${encabezado.titulo || ''}</h1>
                <p class="tematicas-encabezado__subtitulo">${encabezado.descripcion || ''}</p>
            </div>
            <div id="grilla-tarjetas-tematicas" class="tematicas-grilla-contenedor"></div>
        `;
        return contenedor;
    }

    /**
     * Crea un componente de tarjeta individual para un eje temático aplicando estilos BEM
     * @param {string} idTematica Identificador único del eje
     * @param {Object} infoTematica Datos de configuración del eje (título, descripción, grupos)
     * @returns {HTMLElement} Nodo de la tarjeta
     */
    static crearTarjetaTematica(idTematica, infoTematica) {
        const tarjeta = document.createElement('div');
        
        tarjeta.className = 'tarjeta tarjeta--tematicas tarjeta-tematica-item';
        tarjeta.dataset.id = idTematica;
        tarjeta.dataset.ruta = infoTematica.rutaDatos;

        let htmlBotones = '';
        if (infoTematica.grupos) {
            Object.entries(infoTematica.grupos).forEach(([idGrupo, infoGrupo]) => {
                htmlBotones += `
                    <button class="boton boton--herramienta boton--herramienta--tematica btn-activar-grupo" data-grupo-id="${idGrupo}">
                        ${infoGrupo.titulo}
                    </button>
                `;
            });
        }

        tarjeta.innerHTML = `
            <h2 class="tarjeta__titulo">${infoTematica.titulo}</h2>
            <p class="tarjeta__texto">${infoTematica.descripcion}</p>
            
            <div class="panel-botones-herramientas">
                ${htmlBotones || '<p class="sin-tableros">No hay tableros configurados</p>'}
            </div>
        `;
        return tarjeta;
    }
}