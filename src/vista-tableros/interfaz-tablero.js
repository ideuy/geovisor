/**
 * interfaz-tablero.js
 * Estructura de maquetación HTML pura para la Vista Tablero.
 */
export function obtenerTemplateTablero(config) {
    return `
        <div class="vista-tablero-contenedor">
            
            <section class="tablero__mapa">
                <div id="mapa-titulo" class="tablero__mapa-titulo"></div>
                <div id="mapa-leaflet" class="tablero__mapa-canvas"></div>
                
                <div class="tablero__selector-vistas">
                    <span class="tablero__selector-titulo">Ver:</span>
                    
                    <input type="radio" id="geo-puntos" class="tablero__radio-input" name="tipo-geo" value="puntos" ${config.visualizacion === 'puntos' ? 'checked' : ''}>
                    <label for="geo-puntos" class="tablero__radio-label">Puntos</label>
                    
                    <input type="radio" id="geo-agrupados" class="tablero__radio-input" name="tipo-geo" value="puntosAgrupados" ${config.visualizacion === 'puntosAgrupados' ? 'checked' : ''}>
                    <label for="geo-agrupados" class="tablero__radio-label">Agrupados</label>
                    
                    <input type="radio" id="geo-calor" class="tablero__radio-input" name="tipo-geo" value="mapaCalor" ${config.visualizacion === 'mapaCalor' ? 'checked' : ''}>
                    <label for="geo-calor" class="tablero__radio-label">Mapa Calor</label>
                </div>
            </section>

            <section class="tablero__analitica">
                
                <div class="tablero__panel-controles">
                    
                    <div class="tablero__contadores-grupo">
                        <div class="tarjeta tarjeta--contador">
                            <span class="tablero__contador-etiqueta">Total Dimensiones</span>
                            <span id="txt-total-dimensiones" class="tablero__contador-numero">0</span>
                        </div>
                        <div class="tarjeta tarjeta--contador">
                            <span class="tablero__contador-etiqueta">Total Casos</span>
                            <span id="txt-total-casos" class="tablero__contador-numero">0</span>
                        </div>
                    </div>
                    
                    <div class="tablero__formulario-fila">
                        <div class="tablero__formulario-columna">
                            <div class="tablero__control-grupo">
                                <label for="cmb-tableros" class="tablero__control-label">Seleccionar por:</label>
                                <select id="cmb-tableros" class="tablero__select"></select>
                            </div>
                        </div>
                        
                        <div class="tablero__formulario-columna">
                            <div class="tablero__control-grupo">
                                <label for="cmb-dimensiones" class="tablero__control-label">Agrupar por:</label>
                                <select id="cmb-dimensiones" class="tablero__select"></select>
                            </div>
                        </div>
                    </div>

                    <div class="tablero__graficos-contenedor">
                        <div class="tarjeta tarjeta--grafico tarjeta--grafico-barras">
                            <canvas id="grafico-barras"></canvas>
                        </div>
                        <div class="tarjeta tarjeta--grafico tarjeta--grafico-pastel">
                            <canvas id="grafico-pastel"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="tablero__panel-tabla">
                    <h3 class="tablero__tabla-titulo">Resumen de Dimensiones</h3>
                    <div class="tablero__tabla-wrapper">
                        <table id="tabla-resumen-datos" class="tablero__tabla">
                            <thead>
                                <tr>
                                    <th>Dimensión</th>
                                    <th>Casos</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
                
            </section>
        </div>
    `;
}