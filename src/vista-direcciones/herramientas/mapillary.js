/**
 * mapillary.js
 * Gestiona el visor de entorno urbano e integración con la API de Mapillary.
 */
export class MapillaryHerramienta {
    constructor(mapa, servicioConfig, orquestador, parent) {
        this.mapa = mapa;
        this.servicioConfig = servicioConfig;
        this.orquestador = orquestador;
        this.parent = parent;

        this.activo = false;
        this.layerGroup = L.layerGroup();
        this.layerGroup.addTo(this.mapa);

        this.urlBase = this.servicioConfig['url-base'];
        this.token = this.servicioConfig.token;
        this.radio = this.servicioConfig.radio;
        this.limite = this.servicioConfig.limite;
    }

    activar() {
        this.activo = true;
        this.limpiarTodo();
        this.orquestador?.registrarDebug(
            'Mapillary',
            'Modo entorno urbano activado.'
        );

        this.mapa.on('popupopen', this.manejarPopupOpen, this);
        this.mapa.on('popupclose', this.manejarPopupClose, this);

        if (this.parent.candidatoActual && this.parent.candidatoActual.punto) {
            const { lat, lng } = this.parent.candidatoActual.punto;
            this.mostrarEntorno(lat, lng);
        }
    }

    manejarPopupOpen(e) {
        if (!this.activo) return;
        const latlng = e.popup.getLatLng();
        if (latlng) this.mostrarEntorno(latlng.lat, latlng.lng);
    }

    manejarPopupClose() {
        if (!this.activo) return;
        this.ocultarEntorno();
    }

    mostrarEntorno(lat, lng) {
        this.orquestador?.registrarDebug(
            'Mapillary',
            `Buscando imagen cercana a: ${lat}, ${lng}`
        );

        const visor = document.getElementById('contenedor-mapillary');
        if (visor) visor.style.display = 'block';

        const datosCandidato = this.parent.candidatoActual?.datos || { lat, lng };

        if (this.parent.mapillaryComponent) {
            if (typeof this.parent.mapillaryComponent.renderizar === 'function') {
                this.parent.mapillaryComponent.renderizar(datosCandidato);
            } else if (typeof this.parent.mapillaryComponent.actualizarUbicacion === 'function') {
                this.parent.mapillaryComponent.actualizarUbicacion(lat, lng);
            } else if (typeof this.parent.mapillaryComponent.activar === 'function') {
                this.parent.mapillaryComponent.activar();
            }
        }
    }

    ocultarEntorno() {
        const visor = document.getElementById('contenedor-mapillary');
        if (visor) visor.style.display = 'none';
    }

    desactivar() {
        this.activo = false;
        this.limpiarTodo();
    }

    limpiarTodo() {
        this.mapa.off('popupopen', this.manejarPopupOpen, this);
        this.mapa.off('popupclose', this.manejarPopupClose, this);
        if (this.layerGroup) this.layerGroup.clearLayers();
        this.ocultarEntorno();
    }
}