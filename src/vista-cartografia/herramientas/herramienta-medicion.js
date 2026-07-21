/**
 * herramienta-medicion.js
 * Módulo de Análisis Espacial: Medición Lineal.
 * Se encarga exclusivamente de la lógica geométrica y del cálculo de distancias.
 */
export class HerramientaMedicion {
    /**
     * @param {L.Map} instanciaMapa Instancia activa de Leaflet.
     * @param {Orquestador} orquestador Instancia del mediador central.
     */
    constructor(instanciaMapa, orquestador) {
        this.mapa = instanciaMapa;
        this.orquestador = orquestador;
        this.activo = false;
        this.puntos = [];
        this.capaPolilinea = null;
        this.capasMarcadores = [];
        this.manejadorClickMapa = this.alHacerClickMapa.bind(this);
    }

    /**
     * Activa la herramienta y cambia el cursor del mapa.
     */
    activar() {
        if (this.activo) return;
        this.activo = true;
        this.orquestador.info(
            'Herramienta Medición',
            'Herramienta de medición lineal ACTIVADA.'
        );

        this.mapa.getContainer().style.cursor = 'crosshair';
        this.mapa.on('click', this.manejadorClickMapa);
    }

    /**
     * Captura las coordenadas del clic, dibuja el segmento geométrico y calcula la distancia.
     */
    alHacerClickMapa(evento) {
        const coordenada = evento.latlng;
        this.puntos.push(coordenada);

        this.orquestador.debug(
            'Herramienta Medición',
            `Punto registrado: Lat: ${coordenada.lat.toFixed(4)}, Lng: ${coordenada.lng.toFixed(4)}`
        );

        if (!this.capaPolilinea) {
            this.capaPolilinea = L.polyline(this.puntos, {
                color: '#55B5E5',
                weight: 4,
                dashArray: '5, 10',
            }).addTo(this.mapa);
        } else {
            this.capaPolilinea.setLatLngs(this.puntos);
        }

        const indiceVertice = this.puntos.length - 1;

        const iconoVertice = L.divIcon({
            className: 'marcador-medicion-lineal',
            html: '<div style="width: 10px; height: 10px; background-color: #d4e6f1; border: 2.5px solid #1a6a9a; border-radius: 50%;"></div>',
            iconSize: [10, 10],
            iconAnchor: [5, 5]
        });

        const marcador = L.marker(coordenada, {
            icon: iconoVertice,
            draggable: true
        }).addTo(this.mapa);

        marcador.on('drag', (e) => {
            const nuevaPosicion = e.latlng;
            this.puntos[indiceVertice] = nuevaPosicion;
            this.capaPolilinea.setLatLngs(this.puntos);
            this.actualizarPopupsDistancia();
        });

        this.capasMarcadores.push(marcador);
        this.actualizarPopupsDistancia();
    }

    /**
     * Calcula la distancia acumulada y actualiza el contenido de los popups dinámicamente sin duplicarlos
     */
    actualizarPopupsDistancia() {
        if (this.puntos.length === 0) return;

        let distanciaTotalMetros = 0;

        for (let i = 0; i < this.puntos.length - 1; i++) {
            distanciaTotalMetros += this.puntos[i].distanceTo(this.puntos[i + 1]);
        }

        const textoDistancia =
            distanciaTotalMetros > 1000
                ? `${(distanciaTotalMetros / 1000).toFixed(2)} km`
                : `${distanciaTotalMetros.toFixed(0)} m`;

        this.capasMarcadores.forEach((marcador, index) => {
            let nuevoContenido = '';
            
            if (index === 0) {
                nuevoContenido = '<span class="mensaje__titulo">Inicio</span>';
            } else if (index === this.capasMarcadores.length - 1) {
                nuevoContenido = `<span class="mensaje__titulo">Distancia acumulada:</span><br><strong>${textoDistancia}</strong>`;
            } else {
                return; 
            }

            const popupExistente = marcador.getPopup();

            if (!popupExistente) {
                marcador.bindPopup(nuevoContenido, {
                    closeButton: true,
                    autoClose: false,
                    className: 'popup-medicion-lineal', 
                });

                if (index === 0 || index === this.capasMarcadores.length - 1) {
                    marcador.openPopup();
                }
            } else {
                popupExistente.setContent(nuevoContenido);
                
                if (index === this.capasMarcadores.length - 1 && !this.mapa.hasLayer(popupExistente)) {
                    marcador.openPopup();
                }
            }
        });
    }

    /**
     * Desactiva la herramienta, remueve los listeners y limpia el mapa de geometrías temporales.
     */
    desactivar() {
        if (!this.activo) return;
        this.activo = false;
        this.orquestador.debug(
            'Herramienta Medición',
            'Herramienta de medición lineal DESACTIVADA. Limpiando geometrías.'
        );

        this.mapa.getContainer().style.cursor = '';
        this.mapa.off('click', this.manejadorClickMapa);

        if (this.capaPolilinea) {
            this.mapa.removeLayer(this.capaPolilinea);
            this.capaPolilinea = null;
        }

        this.capasMarcadores.forEach((marcador) =>
            this.mapa.removeLayer(marcador)
        );
        this.capasMarcadores = [];
        this.puntos = [];
    }
}