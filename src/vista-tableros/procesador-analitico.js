/**
 * Clase encargada de la lógica analítica de agregación y cálculo de dimensiones.
 * Opera de forma desacoplada sobre datos planos estandarizados en memoria.
 */
export class ProcesadorAnalitico {
    constructor() {
        this.datosUnificados = []; // Registros planos mapeados [{ Campo1: valor, Campo2: valor }]
        this.configTablero = null;
    }

    /**
     * Inicializa los datos de trabajo y la configuración específica del tablero activo.
     * @param {Array<Object>} datos Estandarizados en formato clave-valor
     * @param {Object} config Configuración del objeto tablero del JSON
     */
    setDatosYConfiguracion(datos, config) {
        this.datosUnificados = datos || [];
        this.configTablero = config;
    }

    /**
     * Extrae todas las dimensiones (campos analíticos) disponibles configuradas.
     * Combina la dimensión principal con las secundarias.
     * @returns {Array<{campo: string, titulo: string}>}
     */
    obtenerDimensionesDisponibles() {
        if (!this.configTablero) return [];

        const dimensiones = [];

        // Incluir dimensión principal
        if (this.configTablero.dimensionPrincipal) {
            dimensiones.push({
                campo: this.configTablero.dimensionPrincipal.campo,
                titulo: this.configTablero.dimensionPrincipal.titulo,
            });
        }

        // Concatenar dimensiones secundarias
        if (
            this.configTablero.dimensionesSecundarias &&
            Array.isArray(this.configTablero.dimensionesSecundarias)
        ) {
            this.configTablero.dimensionesSecundarias.forEach((dim) => {
                dimensiones.push({
                    campo: dim.campo,
                    titulo: dim.titulo,
                });
            });
        }

        return dimensiones;
    }

    /**
     * Cuenta el total de registros válidos cargados en memoria.
     * @returns {number}
     */
    calcularTotalCasos() {
        return this.datosUnificados.length;
    }

    /**
     * Calcula la cantidad de categorías únicas existentes para un campo específico.
     * @param {string} campo Nombre de la propiedad a evaluar
     * @returns {number}
     */
    calcularTotalCategoriasUnicas(campo) {
        if (!campo || this.datosUnificados.length === 0) return 0;

        const categorias = new Set();
        this.datosUnificados.forEach((fila) => {
            const valor = fila[campo];
            if (valor !== undefined && valor !== null && valor !== '') {
                categorias.add(valor.toString().trim());
            }
        });

        return categorias.size;
    }

    /**
     * Genera la distribución de frecuencias (conteo de casos) agrupando por un campo específico.
     * El resultado se entrega ordenado de mayor a menor según la cantidad de casos.
     * @param {string} campo Nombre del campo por el cual agrupar
     * @returns {Array<{categoria: string, casos: number}>}
     */
    obtenerDistribucionPorColumna(campo) {
        if (!campo || this.datosUnificados.length === 0) return [];

        const mapaFrecuencias = {};

        this.datosUnificados.forEach((fila) => {
            let valor = fila[campo];

            if (valor === undefined || valor === null || valor === '') {
                valor = '(Sin Dato)';
            } else {
                valor = valor.toString().trim().toUpperCase();
            }

            mapaFrecuencias[valor] = (mapaFrecuencias[valor] || 0) + 1;
        });

        return Object.keys(mapaFrecuencias)
            .map((cat) => ({
                categoria: cat,
                casos: mapaFrecuencias[cat],
            }))
            .sort((a, b) => b.casos - a.casos);
    }
}
