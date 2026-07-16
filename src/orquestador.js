/**
 * orquestador.js
 * Enrutador y Mediador Central de la Arquitectura.
 * Cero código HTML embebido.
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
                throw new Error('Fallo al descargar aplicacion.json');

            this.configuracionGlobal = await respuesta.json();
            this.propiedadLogger =
                this.configuracionGlobal.aplicacion.logger || false;

            this.registrarDebug(
                'Core',
                'Configuración de aplicación cargada con éxito.'
            );

            try {
                const resMapas = await fetch('./config/mapas-base.json');
                if (resMapas.ok) {
                    this.configuracionMapasBase = await resMapas.json();
                    this.registrarDebug(
                        'Core',
                        'Configuración de mapas base indexada con éxito.'
                    );
                } else {
                    console.warn(
                        '[WARN][Core] No se encontró mapas-base.json. Se usará el fallback de Leaflet.'
                    );
                }
            } catch (errMapas) {
                console.error(
                    '[ERROR][Core] Error al precargar mapas-base.json:',
                    errMapas
                );
            }

            this.establecerInterfazGlobal();

            // Carga cartografia parametrizada
            this.enrutarA(
                this.configuracionGlobal.aplicacion['vista-cartografia'] ||
                    'bienvenida'
            );
        } catch (error) {
            console.error(
                '[ERROR][Core] Error en inicialización del Orquestador:',
                error
            );
        }
    }

    registrarDebug(modulo, mensaje) {
        if (this.propiedadLogger) {
            console.log(
                `%c[DEBUG][${modulo}] ${mensaje}`,
                'color: #55B5E5; font-weight: bold;'
            );
        }
    }

    establecerInterfazGlobal() {
        const appInfo = this.configuracionGlobal.aplicacion;
        document.getElementById('texto-institucion').innerText =
            appInfo.institucion;
        document.getElementById('texto-aplicacion').innerText = appInfo.titulo;
        if (appInfo.logo)
            document.getElementById('logo-institucion').src = appInfo.logo;

        // Vincular los botones de vista del header al enrutador
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
        this.registrarDebug(
            'Mediador',
            `Notificación recibida en canal [${canal}]`
        );

        switch (canal) {
            // Se ejecuta al seleccionar un grupo desde la vista Temáticas
            case 'GRUPO_SELECCIONADO': {
                const { tableroActivo, listaTableros, rutaBase } = datos;

                if (!tableroActivo || !listaTableros) {
                    console.error(
                        '[ERROR][Mediador] Datos de grupo no válidos recibidos:',
                        datos
                    );
                    this.enrutarA('tematicas');
                    break;
                }

                this.rutaBaseActual = rutaBase;
                this.registrarDebug(
                    'Mediador',
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

                    // Descargamos y procesamos la infraestructura de datos en segundo plano
                    const datosEstandarizados =
                        await this.cargarYParserDatos(origenFuente);

                    // Redireccionamos enviando la configuración, los datos planos y la lista completa de hermanos
                    this.enrutarA('tablero', {
                        configDirecta: tableroActivo,
                        datosEstandarizados: datosEstandarizados,
                        listaTableros: listaTableros,
                    });
                } catch (error) {
                    console.error(
                        '[ERROR][Mediador] Error al procesar datos del grupo seleccionado:',
                        error
                    );
                }
                break;
            }

            // Cambio de combobox temporal interno dentro del propio Tablero (Ej: cambio de año)
            case 'CAMBIO_TABLERO_INTERNO': {
                const nuevaConfig = datos;
                this.registrarDebug(
                    'Mediador',
                    `Petición de recarga silenciosa recibida. Archivo: ${nuevaConfig.datos}`
                );

                if (
                    !this.vistaControladorActual ||
                    typeof this.vistaControladorActual
                        .recargarDatosMismoTablero !== 'function'
                ) {
                    console.warn(
                        '[Mediador] No existe una instancia viva de Tablero para actualizar.'
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

                    // Inyección en caliente: Actualiza Leaflet y Chart.js sin parpadeos en el DOM
                    this.vistaControladorActual.recargarDatosMismoTablero(
                        nuevaConfig,
                        nuevosDatos
                    );
                } catch (error) {
                    console.error(
                        '[ERROR][Mediador] Error en recarga interna de datos:',
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
                this.registrarDebug(
                    'Mediador',
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
        this.registrarDebug('Core', `Enrutando hacia: ${destino}`);
        
        const contenedor = document.querySelector('.panel__tarjetas');

        // Ciclo de desinstalación segura de la vista anterior (Recolección de basura)
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
                        throw new Error(
                            'Parámetros insuficientes para inicializar la vista Tablero de forma aislada.'
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
                } catch (err) {
                    console.error(
                        '[ERROR][Core] Error al levantar la vista de Tablero:',
                        err
                    );
                    contenedor.innerHTML = `<div class="alerta-error">Error al cargar el tablero seleccionado. Por favor, vuelva a la sección de Temáticas.</div>`;
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
                } catch (err) {
                    console.error(
                        '[ERROR][Core] Error al levantar la vista Direcciones:',
                        err
                    );
                }
                break;

            default:
                console.error(`[ERROR][Core] La ruta "${destino}" no existe.`);
        }
    }

    /**
     * Descarga y estandariza los datos según el formato especificado (JSON/CSV)
     */
    async cargarYParserDatos(fuente) {
        const formatoLimpio = fuente.formato?.toLowerCase();

        const respuesta = await fetch(fuente.ruta);
        if (!respuesta.ok) {
            throw new Error(`Error HTTP al descargar recurso: ${fuente.ruta}`);
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
                    this.registrarDebug(
                        'Core',
                        `Advertencia en parseo CSV: ${resultadoParseo.errors[0].message}`
                    );
                }

                return resultadoParseo.data;

            default:
                throw new Error(
                    `El formato de datos "${fuente.formato}" no está soportado.`
                );
        }
    }
}
