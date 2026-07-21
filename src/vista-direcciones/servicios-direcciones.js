/**
 * servicios-direcciones.js
 * Módulo encargado de gestionar las peticiones HTTP a las APIs de direcciones/geocodificación
 */
export class ServicioDirecciones {
    constructor(orquestador, configApi = null) {
        this.orquestador = orquestador;
        this.configApi = configApi;
        this.abortControllerCandidatos = null;
    }

    establecerConfiguracion(configApi) {
        this.configApi = configApi;
    }

    async buscarCandidatos(
        terminoBusqueda,
        soloLocalidad = false,
        limiteSeleccionado = 10
    ) {
        if (this.abortControllerCandidatos) {
            this.abortControllerCandidatos.abort();
        }

        this.abortControllerCandidatos = new AbortController();
        const { signal } = this.abortControllerCandidatos;

        const config = this.configApi?.apiDirecciones || this.configApi;
        const servicioConfig = config?.servicios?.find(
            (s) => s.idServicio === 'candidates' || s.id === 'candidates'
        );

        if (!servicioConfig) {
            this.orquestador.error(
                'Servicio Direcciones',
                'No se encontró la configuración para el servicio "candidates"'
            );
            return [];
        }

        const parametros = new URLSearchParams();

        if (servicioConfig.parametros) {
            Object.keys(servicioConfig.parametros).forEach((clave) => {
                let valor = '';

                if (clave === 'q') {
                    valor = terminoBusqueda;
                } else if (clave === 'soloLocalidad') {
                    valor = Boolean(soloLocalidad);
                } else if (clave === 'limit') {
                    valor =
                        limiteSeleccionado ||
                        servicioConfig.parametros[clave] ||
                        10;
                } else {
                    valor = servicioConfig.parametros[clave] ?? '';
                }

                parametros.append(clave, String(valor));
            });
        }

        const urlBase = config['url-base'] || '';
        const baseClean = urlBase.endsWith('/')
            ? urlBase.slice(0, -1)
            : urlBase;
        const urlServicio = servicioConfig['url-servicio'] || '';
        const servicioClean = urlServicio.startsWith('/')
            ? urlServicio
            : '/' + urlServicio;
        const urlCompleta = `${baseClean}${servicioClean}?${parametros.toString()}`;

        const etiquetaTiempo = `Respuesta HTTP para: ${terminoBusqueda}`;

        try {
            this.orquestador.time('Servicio Direcciones', etiquetaTiempo);

            const respuesta = await fetch(urlCompleta, { signal });

            if (!respuesta.ok) {
                this.orquestadorthrowError(
                    'Servicio Direcciones',
                    `HTTP status error ${respuesta.status}`
                );
            }

            return await respuesta.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                this.orquestador.debug(
                    'Servicio Direcciones',
                    `Petición obsoleta cancelada para: "${terminoBusqueda}"`
                );
                return [];
            }

            this.orquestador.error(
                'Servicio Direcciones',
                `Error al buscar candidatos para: "${terminoBusqueda}"`,
                error
            );
            return [];
        } finally {
            this.orquestador.timeEnd('Servicio Direcciones', etiquetaTiempo);
        }
    }

    /**
     * Obtiene las coordenadas precisas consultando el servicio 'find'
     */
    async obtenerCoordenadasPrecisas(itemCandidato) {
        if (!itemCandidato) return null;

        if (itemCandidato.lat && itemCandidato.lng) {
            return {
                ...itemCandidato,
                lat: parseFloat(itemCandidato.lat),
                lng: parseFloat(itemCandidato.lng),
            };
        }

        const config = this.configApi?.apiDirecciones || this.configApi;

        const servicioConfig = config?.servicios?.find(
            (s) => s.idServicio === 'find' || s.id === 'find'
        );

        if (!servicioConfig) {
            this.orquestador.error(
                'Servicio Direcciones',
                'No se encontró la configuración para el servicio "find"'
            );
            return null;
        }

        const parametros = new URLSearchParams();

        if (servicioConfig.parametros) {
            Object.keys(servicioConfig.parametros).forEach((clave) => {
                const c = clave.toLowerCase();
                let valor = '';

                if (c === 'nomvia') {
                    valor = itemCandidato.nomVia || itemCandidato.nomvia;
                    ('');
                } else if (c === 'portal') {
                    valor =
                        itemCandidato.portalNumber ||
                        itemCandidato.portal ||
                        itemCandidato.numero ||
                        '';
                } else if (c === 'idcalle') {
                    valor =
                        itemCandidato.idCalle || itemCandidato.idcalle || '';
                } else if (c === 'departamento') {
                    valor = itemCandidato.departamento || '';
                } else if (c === 'localidad') {
                    valor = itemCandidato.localidad || '';
                } else if (c === 'letra') {
                    valor = itemCandidato.letra || '';
                } else if (c === 'type') {
                    valor =
                        itemCandidato.type ||
                        servicioConfig.parametros[clave] ||
                        'CALLEyPORTAL';
                } else {
                    valor =
                        itemCandidato[clave] ??
                        servicioConfig.parametros[clave] ??
                        '';
                }

                if (valor !== null && valor !== undefined && valor !== '') {
                    parametros.append(clave, String(valor));
                }
            });
        }

        const urlBase = config['url-base'] || '';
        const baseClean = urlBase.endsWith('/')
            ? urlBase.slice(0, -1)
            : urlBase;
        const urlServicio = servicioConfig['url-servicio'] || '';
        const servicioClean = urlServicio.startsWith('/')
            ? urlServicio
            : '/' + urlServicio;
        const urlCompleta = `${baseClean}${servicioClean}?${parametros.toString()}`;

        try {
            const respuesta = await fetch(urlCompleta);

            if (!respuesta.ok) {
                this.orquestador.error(
                    'Servicio Direcciones',
                    `HTTP status error ${respuesta.status} en GeocodeFind`
                );
                return null;
            }

            const datos = await respuesta.json();
            const resultado = Array.isArray(datos) ? datos[0] : datos;

            if (!resultado) return null;

            const lat =
                resultado.lat ??
                resultado.y ??
                resultado.punto?.lat ??
                resultado.punto?.y ??
                resultado.location?.lat;

            const lng =
                resultado.lng ??
                resultado.x ??
                resultado.punto?.lng ??
                resultado.punto?.x ??
                resultado.location?.lng;

            if (!lat || !lng) {
                return null;
            }

            return {
                ...itemCandidato,
                ...resultado,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
            };
        } catch (error) {
            this.orquestador.error(
                'Servicio Direcciones',
                'Error al obtener coordenadas precisas',
                error
            );
            return null;
        }
    }

    async obtenerPoligonoSerieElectoral(lat, lng, configCapa) {
        if (!configCapa) return null;

        const urlWfsBase = configCapa.url
            ? configCapa.url.replace('/ows', '/wfs')
            : 'https://mapas.ide.uy/geoserver-vectorial/wfs';
        const typeName = configCapa.capaWfs || configCapa.capa;
        const campoGeom = configCapa.campoGeometria || 'geom';

        const filtroCql = `INTERSECTS(${campoGeom}, POINT(${lng} ${lat}))`;

        const parametros = new URLSearchParams({
            service: 'WFS',
            version: '1.0.0',
            request: 'GetFeature',
            typeName: typeName,
            outputFormat: 'application/json',
            srsName: 'EPSG:4326',
            CQL_FILTER: filtroCql,
        });

        try {
            const respuesta = await fetch(
                `${urlWfsBase}?${parametros.toString()}`
            );
            if (!respuesta.ok)
                throw new Error(`WFS HTTP status ${respuesta.status}`);

            const textoCrudo = await respuesta.text();

            if (textoCrudo.trim().startsWith('<')) {
                console.group(
                    '%c[ERROR][GeoServer] Excepción WFS detectada',
                    'color: #ff0000; font-weight: bold;'
                );
                console.log(textoCrudo);
                console.groupEnd();
                return null;
            }

            return JSON.parse(textoCrudo);
        } catch (error) {
            console.error(
                '[ERROR][Servicio] Falló la intersección WFS de Serie Electoral:',
                error
            );
            return null;
        }
    }
}
