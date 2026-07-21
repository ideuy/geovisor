/**
 * orquestador.js
 * Enrutador y Mediador Central de la Arquitectura.
 */
import { Bienvenida } from './presentacion/bienvenida.js';
import { Cartografia } from './vista-cartografia/cartografia.js';
import { Tematicas } from './vista-tematicas/tematicas.js';
import { Tablero } from './vista-tableros/tablero.js';
import { Direcciones } from './vista-direcciones/direcciones.js';

export class Orquestador {
    constructor() {
        this.configuracionGlobal = null;
        this.configuracionMapasBase = null;
        this.propiedadLogger = false;
        this.vistaControladorActual = null;
        this.rutaBaseActual = '';
    }

    async inicializar() {
        try {
            const respuesta = await fetch('./config/aplicacion.json');
            if (!respuesta.ok)
                this.throwError(
                    'Orquestador',
                    'Fallo al descargar aplicacion.json.'
                );

            this.configuracionGlobal = await respuesta.json();
            this.propiedadLogger =
                this.configuracionGlobal.aplicacion.logger || false;

            this.info(
                'Orquestador',
                'Configuración de aplicación cargada con éxito.'
            );

            try {
                const resMapas = await fetch('./config/mapas-base.json');
                if (resMapas.ok) {
                    this.configuracionMapasBase = await resMapas.json();
                    this.info(
                        'Orquestador',
                        'Configuración de mapas base indexada con éxito.'
                    );
                } else {
                    this.warn('[Orquestador] No se encontró mapas-base.json.');
                }
            } catch (errMapas) {
                this.error(
                    'Orquestador',
                    'Error al precargar mapas-base.json: ',
                    errMapas
                );
            }

            this.establecerInterfazGlobal();

            this.enrutarA(
                this.configuracionGlobal.aplicacion['vista-cartografia'] ||
                    'bienvenida'
            );
        } catch (error) {
            this.error(
                'Orquestador',
                'Error en inicialización del Orquestador:',
                error
            );
        }
    }

    /*
    registrarDebug(modulo, mensaje) {
        if (this.propiedadLogger) {
            console.log(
                `%c[DEBUG][${modulo}] ${mensaje}`,
                'color: #55B5E5; font-weight: bold;'
            );
        }
    }
    */

    /**
     * Método privado centralizado para procesar la salida por consola.
     */
    _log(nivel, modulo, mensaje, detalle = null) {
        // 1. REGLA DE ERRORES: Los errores críticos SIEMPRE se muestran (incluso con logger en false)
        if (nivel === 'ERROR') {
            const etiqueta = `%c[ERROR][${modulo}] ${mensaje}`;
            const estilo = 'color: #E74C3C; font-weight: bold;';

            if (detalle !== null && detalle !== undefined) {
                console.error(etiqueta, estilo, detalle);
            } else {
                console.error(etiqueta, estilo);
            }
            return;
        }

        // 2. REGLA GENERAL: Si el logger está desactivado, silencia el resto de niveles
        if (!this.propiedadLogger) return;

        // 3. Mapa de configuraciones visuales y funciones nativas de console
        const configuraciones = {
            DEBUG: { color: '#55B5E5', fn: console.log },
            INFO: { color: '#2ECC71', fn: console.info },
            WARN: { color: '#F39C12', fn: console.warn },
            TIME: { color: '#9B59B6', fn: console.time },
            TIMEEND: { color: '#9B59B6', fn: console.timeEnd },
        };

        const config = configuraciones[nivel];
        if (!config) return;

        const etiqueta = `%c[${nivel.startsWith('TIME') ? 'TIEMPO' : nivel}][${modulo}] ${mensaje}`;
        const estilo = `color: ${config.color}; font-weight: bold;`;

        // Caso especial para time / timeEnd (usan solo la cadena identificadora)
        if (nivel === 'TIME' || nivel === 'TIMEEND') {
            config.fn(`${etiqueta}`);
            return;
        }

        // Caso habitual: logs con o sin detalle/objeto
        if (detalle !== null && detalle !== undefined) {
            config.fn(etiqueta, estilo, detalle);
        } else {
            config.fn(etiqueta, estilo);
        }
    }

    // --- Métodos Públicos Dedicados ---

    debug(modulo, mensaje, detalle = null) {
        this._log('DEBUG', modulo, mensaje, detalle);
    }
    info(modulo, mensaje, detalle = null) {
        this._log('INFO', modulo, mensaje, detalle);
    }
    warn(modulo, mensaje, detalle = null) {
        this._log('WARN', modulo, mensaje, detalle);
    }
    error(modulo, mensaje, errorObj = null) {
        this._log('ERROR', modulo, mensaje, errorObj);
    }

    /** Cronómetros estilizados e integrados con el flag propiedadLogger */
    time(modulo, etiqueta) {
        this._log('TIME', modulo, etiqueta);
    }
    timeEnd(modulo, etiqueta) {
        this._log('TIMEEND', modulo, etiqueta);
    }

    /** Lanzador rápido de excepciones con log previo */
    throwError(modulo, mensaje) {
        this.error(modulo, mensaje);
        throw new Error(`[${modulo}] ${mensaje}`);
    }

    establecerInterfazGlobal() {
        const appInfo = this.configuracionGlobal.aplicacion;
        document.getElementById('texto-institucion').innerText =
            appInfo.institucion;
        document.getElementById('texto-aplicacion').innerText = appInfo.titulo;
        if (appInfo.logo)
            document.getElementById('logo-institucion').src = appInfo.logo;

        const contenedorNavegacion =
            document.getElementById('navegacion-vistas');
        if (contenedorNavegacion) {
            contenedorNavegacion.addEventListener('click', (evento) => {
                const boton = evento.target.closest('.selector-vistas__boton');
                if (!boton) return;

                const destino = boton.dataset.vista;

                contenedorNavegacion
                    .querySelectorAll('.selector-vistas__boton')
                    .forEach((b) => {
                        b.classList.remove('selector-vistas__boton--activo');
                    });
                boton.classList.add('selector-vistas__boton--activo');

                this.enrutarA(destino);
            });
        }
    }

    /**
     * Mediador Central de Eventos de la Arquitectura
     * Resuelve peticiones inter-módulos desacopladas evitando errores de llamadas directas.
     * @param {string} canal Identificador de la acción
     * @param {Object} datos Carga útil / payload enviada por las vistas
     */
    async notificar(canal, datos) {
        this.debug('Orquestador', `Notificación recibida en canal [${canal}]`);

        switch (canal) {
            case 'GRUPO_SELECCIONADO': {
                const { tableroActivo, listaTableros, rutaBase } = datos;

                if (!tableroActivo || !listaTableros) {
                    this.error(
                        'Orquestador',
                        'Datos de grupo no válidos recibidos:',
                        datos
                    );
                    this.enrutarA('tematicas');
                    break;
                }

                this.rutaBaseActual = rutaBase;
                this.debug(
                    'Orquestador',
                    `Procesando grupo temático. Descargando CSV inicial: ${tableroActivo.datos}`
                );

                try {
                    const origenFuente = {
                        ruta: `${rutaBase}${tableroActivo.datos}`,
                        formato: tableroActivo.formato,
                        latitud: tableroActivo.latitud,
                        longitud: tableroActivo.longitud,
                        crs: tableroActivo.crs,
                    };

                    const datosEstandarizados =
                        await this.cargarYParserDatos(origenFuente);

                    this.enrutarA('tablero', {
                        configDirecta: tableroActivo,
                        datosEstandarizados: datosEstandarizados,
                        listaTableros: listaTableros,
                    });
                } catch (error) {
                    this.error(
                        'Orquestador',
                        'Error al procesar datos del grupo seleccionado:',
                        error
                    );
                }
                break;
            }

            case 'CAMBIO_TABLERO_INTERNO': {
                const nuevaConfig = datos;
                this.debug(
                    'Orquestador',
                    `Petición de recarga silenciosa recibida. Archivo: ${nuevaConfig.datos}`
                );

                if (
                    !this.vistaControladorActual ||
                    typeof this.vistaControladorActual
                        .recargarDatosMismoTablero !== 'function'
                ) {
                    this.warn(
                        'Orquestador',
                        'No existe una instancia viva de Tablero para actualizar.'
                    );
                    break;
                }

                try {
                    const origenFuente = {
                        ruta: `${this.rutaBaseActual}${nuevaConfig.datos}`,
                        formato: nuevaConfig.formato,
                        latitud: nuevaConfig.latitud,
                        longitud: nuevaConfig.longitud,
                        crs: nuevaConfig.crs,
                    };

                    const nuevosDatos =
                        await this.cargarYParserDatos(origenFuente);

                    this.vistaControladorActual.recargarDatosMismoTablero(
                        nuevaConfig,
                        nuevosDatos
                    );
                } catch (error) {
                    this.error(
                        'Orquestador',
                        'Error en recarga interna de datos:',
                        error
                    );
                }
                break;
            }

            case 'cambio-vista':
                if (datos?.destino) {
                    this.enrutarA(datos.destino, datos.parametros || null);
                }
                break;

            default:
                this.debug(
                    'Orquestador',
                    `El canal "${canal}" no tiene un manejador activo.`
                );
        }
    }

    /**
     * Router Dinámico de Vistas Completas
     * @param {string} destino Nombre identificador de la vista.
     * @param {Object} [parametrosExtra] Parámetros estructurados enviados desde el Mediador
     */
    async enrutarA(destino, parametrosExtra = null) {
        this.debug('Orquestador', `Enrutando hacia: ${destino}`);

        const contenedor = document.querySelector('.panel__tarjetas');

        if (
            this.vistaControladorActual &&
            typeof this.vistaControladorActual.destruir === 'function'
        ) {
            this.vistaControladorActual.destruir();
        }

        contenedor.innerHTML = '';

        switch (destino) {
            case 'bienvenida':
                this.vistaControladorActual = new Bienvenida(this);
                const nodoHtmlBienvenida =
                    this.vistaControladorActual.inicializar();
                contenedor.appendChild(nodoHtmlBienvenida);
                break;

            case 'cartografia':
                document
                    .getElementById('navegacion-vistas')
                    .classList.remove('oculto');
                this.vistaControladorActual = new Cartografia(this);
                const nodoHtmlCartografia =
                    await this.vistaControladorActual.inicializar();
                contenedor.appendChild(nodoHtmlCartografia);
                break;

            case 'tematicas':
                document
                    .getElementById('navegacion-vistas')
                    .classList.remove('oculto');
                this.vistaControladorActual = new Tematicas(this);
                const nodoHtmlTematicas =
                    await this.vistaControladorActual.inicializar();
                contenedor.appendChild(nodoHtmlTematicas);
                break;

            case 'tablero':
                try {
                    document
                        .getElementById('navegacion-vistas')
                        .classList.remove('oculto');

                    const configTablero = {
                        ...parametrosExtra?.configDirecta,
                        rutaBase: this.rutaBaseActual,
                    };
                    const datosEstandarizados =
                        parametrosExtra?.datosEstandarizados;
                    const listaTableros = parametrosExtra?.listaTableros;

                    if (!configTablero || !datosEstandarizados) {
                        this.throwError(
                            'Orquestador',
                            `Parámetros insuficientes para inicializar la vista Tablero de forma aislada.`
                        );
                    }
                    this.vistaControladorActual = new Tablero(
                        this,
                        configTablero,
                        datosEstandarizados,
                        listaTableros
                    );

                    contenedor.appendChild(
                        await this.vistaControladorActual.inicializar()
                    );
                } catch (error) {
                    this.error(
                        'Orquestador',
                        'Error al levantar la vista del Tablero:',
                        error
                    );
                }
                break;

            case 'direcciones':
                try {
                    document
                        .getElementById('navegacion-vistas')
                        .classList.remove('oculto');
                    this.vistaControladorActual = new Direcciones(this);
                    const nodoHtmlDirecciones =
                        await this.vistaControladorActual.inicializar();
                    contenedor.appendChild(nodoHtmlDirecciones);
                } catch (error) {
                    this.error(
                        'Orquestador',
                        'Error al levantar la vista Direcciones:',
                        error
                    );
                }
                break;

            default:
                this.error(`Orquestador', 'La ruta "${destino}" no existe.`);
        }
    }

    /**
     * Descarga y estandariza los datos según el formato especificado (JSON/CSV)
     */
    async cargarYParserDatos(fuente) {
        const formatoLimpio = fuente.formato?.toLowerCase();
        const respuesta = await fetch(fuente.ruta);

        if (!respuesta.ok) {
            this.throwError(
                'Orquestador',
                `Error HTTP al descargar recurso: ${fuente.ruta}`
            );
        }

        switch (formatoLimpio) {
            case 'json':
            case 'geojson':
                return await respuesta.json();

            case 'csv':
                const textoRaw = await respuesta.text();

                const resultadoParseo = Papa.parse(textoRaw, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: false,
                });

                if (
                    resultadoParseo.errors &&
                    resultadoParseo.errors.length > 0
                ) {
                    this.debug(
                        'Orquestador',
                        `Advertencia en parseo CSV: ${resultadoParseo.errors[0].message}`
                    );
                }

                return resultadoParseo.data;

            default:
                this.throwError(
                    'Orquestador',
                    `El formato de datos "${fuente.formato}" no está soportado.`
                );
        }
    }
}
