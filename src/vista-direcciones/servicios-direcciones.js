/**
 * servicios-direcciones.js
 * Encargado de las peticiones HTTP a la API de Direcciones de la IDE y Mapillary
 */
export class ServicioDirecciones {
    constructor(configApi) {
        this.configApi = configApi;
        this.abortControllerCandidatos = null;
    }

    async buscarCandidatos(
        terminoBusqueda,
        filtroSeleccionado,
        limiteSeleccionado
    ) {
        if (this.abortControllerCandidatos) {
            this.abortControllerCandidatos.abort();
        }

        this.abortControllerCandidatos = new AbortController();
        const { signal } = this.abortControllerCandidatos;

        const servicioConfig = this.configApi.servicios.find(
            (s) => s.idServicio === 'candidates'
        );
        if (!servicioConfig) return [];

        const parametros = new URLSearchParams();
        if (servicioConfig.parametros) {
            Object.keys(servicioConfig.parametros).forEach((clave) => {
                let valor = '';
                if (clave === 'q') valor = terminoBusqueda;
                else if (clave === 'soloLocalidad')
                    valor =
                        filtroSeleccionado === 'Localidades' ? 'true' : 'false';
                else if (clave === 'limit')
                    valor =
                        limiteSeleccionado || servicioConfig.parametros[clave];
                else valor = servicioConfig.parametros[clave] || '';
                parametros.append(clave, valor);
            });
        }

        const urlBase = this.configApi['url-base'] || '';
        const baseClean = urlBase.endsWith('/')
            ? urlBase.slice(0, -1)
            : urlBase;
        const urlServicio = servicioConfig['url-servicio'] || '';
        const servicioClean = urlServicio.startsWith('/')
            ? urlServicio
            : '/' + urlServicio;
        const urlCompleta = `${baseClean}${servicioClean}?${parametros.toString()}`;

        try {
            console.time(
                `[TIEMPO][API IDE] Respuesta HTTP para: ${terminoBusqueda}`
            );

            const respuesta = await fetch(urlCompleta, { signal });

            console.timeEnd(
                `[TIEMPO][API IDE] Respuesta HTTP para: ${terminoBusqueda}`
            );

            if (!respuesta.ok)
                throw new Error(`HTTP status ${respuesta.status}`);

            return await respuesta.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(
                    `%c[INFO] Petición obsoleta cancelada: ${terminoBusqueda}`,
                    'color: #f39c12;'
                );
                return [];
            }

            console.timeEnd(
                `[TIEMPO][API IDE] Respuesta HTTP para: ${terminoBusqueda}`
            );
            throw error;
        }
    }

    async obtenerCoordenadasPrecisas(itemCandidato) {
        if (!itemCandidato || !this.configApi || !this.configApi.servicios)
            return null;

        const usarDirecUnica =
            itemCandidato.type === 'POI' || itemCandidato.type === 'CALLE';
        const idServicioDestino = usarDirecUnica ? 'direcUnica' : 'find';

        const servicioConfig = this.configApi.servicios.find(
            (s) => s.idServicio === idServicioDestino
        );
        if (!servicioConfig) return null;

        const parametros = new URLSearchParams();

        if (servicioConfig.parametros) {
            Object.keys(servicioConfig.parametros).forEach((clave) => {
                let valor = '';

                if (clave === 'q') {
                    valor =
                        itemCandidato.address ||
                        itemCandidato.nomVia ||
                        itemCandidato.nomvia ||
                        '';
                } else if (clave === 'idcalle') {
                    valor =
                        itemCandidato.idCalle || itemCandidato.idcalle || '';
                } else if (clave === 'nomvia') {
                    valor = itemCandidato.nomVia || itemCandidato.nomvia || '';
                } else if (clave === 'portal') {
                    valor =
                        itemCandidato.portalNumber ||
                        itemCandidato.portal ||
                        '';
                } else {
                    valor =
                        itemCandidato[clave] !== undefined
                            ? itemCandidato[clave]
                            : servicioConfig.parametros[clave] || '';
                }

                parametros.append(clave, valor);
            });
        }

        const urlBase = this.configApi['url-base'] || '';
        const baseClean = urlBase.endsWith('/')
            ? urlBase.slice(0, -1)
            : urlBase;

        const urlServicio = servicioConfig['url-servicio'] || '';
        const servicioClean = urlServicio.startsWith('/')
            ? urlServicio
            : '/' + urlServicio;

        const urlCompleta = `${baseClean}${servicioClean}?${parametros.toString()}`;

        const respuesta = await fetch(urlCompleta);
        if (!respuesta.ok) throw new Error(`HTTP status ${respuesta.status}`);

        const texto = await respuesta.text();
        if (!texto || texto.trim() === '') return null;

        const datos = JSON.parse(texto);
        return datos && datos.length > 0 ? datos[0] : null;
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
