/**
 * serie-electoral.js
 * Gestiona la consulta espacial y muestra únicamente el polígono encontrado.
 */
export class SerieElectoral {
    constructor(mapa, servicioConfig, orquestador, parent) {
        this.mapa = mapa;
        this.servicioConfig = servicioConfig;
        this.orquestador = orquestador;
        this.parent = parent;
        this.activo = false;
    }

    activar() {
        this.activo = true;
        this.limpiarTodo();
        this.orquestador.info(
            'Serie Electoral',
            'Herramienta ACTIVADA.'
        );
        this.mapa.on('popupopen', this.manejarPopupOpen, this);
        this.mapa.on('popupclose', this.manejarPopupClose, this);

        if (this.parent.candidatoActual && this.parent.candidatoActual.punto) {
            const { lat, lng } = this.parent.candidatoActual.punto;
            this.orquestador.debug(
                'Serie Electoral',
                `Punto previo detectado (${lat}, ${lng}). Consultando automáticamente.`
            );
            this.procesarFoco(lat, lng);
        }
    }

    async procesarFoco(lat, lng) {
        if (!this.activo) return;

        this.orquestador.debug(
            'Serie Electoral',
            `Consultando serie en: ${lat}, ${lng}`
        );

        try {
            const geojson =
                await this.parent.servicio.obtenerPoligonoSerieElectoral(
                    lat,
                    lng,
                    this.servicioConfig
                );

            if (geojson && geojson.features && geojson.features.length > 0) {
                const feature = geojson.features[0];
                const serie = feature.properties.serie || 'N/A';

                this.orquestador.debug(
                    'SerieElectoral',
                    `Serie encontrada: ${serie}`
                );
                this.parent.gestorMapa.dibujarPoligonoConEtiqueta(
                    feature,
                    `Serie: ${serie}`
                );

                if (
                    this.parent.candidatoActual &&
                    this.parent.candidatoActual.datos
                ) {
                    const nuevoContenido = this.parent.crearContenidoPopup(
                        this.parent.candidatoActual.datos,
                        serie
                    );
                    this.parent.gestorMapa.actualizarPopupMarcador(
                        nuevoContenido
                    );
                }
            } else {
                this.orquestador.warn(
                    'Serie Electoral',
                    `No se encontró Serie Electoral en éste punto: ${lat}, ${lng}`
                );
                this.parent.gestorMapa.limpiarCapaPoligonos();
            }
        } catch (error) {
            this.orquestador.error(
                'Serie Electoral', 'Error al consultar el servicio web:',
                error
            );
        }
    }

    manejarPopupOpen(e) {
        if (!this.activo) return;
        const latlng = e.popup.getLatLng();
        if (latlng) this.procesarFoco(latlng.lat, latlng.lng);
    }

    manejarPopupClose() {
        if (!this.activo) return;
        this.parent.gestorMapa.limpiarCapaPoligonos();
    }

    desactivar() {
        this.activo = false;
        this.limpiarTodo();

        if (this.parent.candidatoActual && this.parent.candidatoActual.datos) {
            const contenidoSinSerie = this.parent.crearContenidoPopup(
                this.parent.candidatoActual.datos
            );
            this.parent.gestorMapa.actualizarPopupMarcador(contenidoSinSerie);
        }
    }

    limpiarTodo() {
        this.mapa.off('popupopen', this.manejarPopupOpen, this);
        this.mapa.off('popupclose', this.manejarPopupClose, this);
        this.parent.gestorMapa.limpiarCapaPoligonos();
    }
}