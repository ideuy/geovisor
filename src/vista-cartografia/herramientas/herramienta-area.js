/**
 * herramienta-area.js
 * Módulo de Análisis Espacial: Medición de Superficies (Áreas).
 * Permite trazar polígonos sobre el mapa y calcula su área real en Hectáreas o Km².
 */
export class HerramientaArea {
    /**
     * @param {L.Map} instanciaMapa Instancia activa de Leaflet.
     * @param {Orquestador} orquestador Instancia del mediador central.
     */
    constructor(instanciaMapa, orquestador) {
        this.mapa = instanciaMapa;
        this.orquestador = orquestador;
        this.activo = false;

        this.puntos = [];
        this.capaPoligono = null;
        this.capasMarcadores = [];
        this.marcadorCentroidePopup = null; // Un único popup flotante en el centro del polígono

        this.manejadorClickMapa = this.alHacerClickMapa.bind(this);
    }

    /**
     * Activa la herramienta y prepara el cursor de precisión.
     */
    activar() {
        if (this.activo) return;
        this.activo = true;
        this.orquestador.registrarDebug(
            'Área',
            'Herramienta de medición de área ACTIVADA.'
        );

        this.mapa.getContainer().style.cursor = 'crosshair';
        this.mapa.on('click', this.manejadorClickMapa);
    }

    /**
     * Captura vértices del polígono y actualiza los cálculos de superficie.
     */
    alHacerClickMapa(evento) {
        const coordenada = evento.latlng;
        this.puntos.push(coordenada);

        this.orquestador.registrarDebug(
            'Área',
            `Vértice añadido: Lat: ${coordenada.lat.toFixed(4)}, Lng: ${coordenada.lng.toFixed(4)}`
        );

        if (!this.capaPoligono) {
            this.capaPoligono = L.polygon(this.puntos, {
                color: '#55B5E5',
                fillColor: '#d4e6f1',
                fillOpacity: 0.3,
                weight: 3,
            }).addTo(this.mapa);
        } else {
            this.capaPoligono.setLatLngs(this.puntos);
        }

        const indiceVertice = this.puntos.length - 1;
        const iconoVertice = L.divIcon({
            className: 'marcador-vertice-custom',
            html: '<div style="width: 8px; height: 8px; background-color: #f0f5fa; border: 2px solid #1a6a9a; border-radius: 50%;"></div>',
            iconSize: [8, 8],
            iconAnchor: [4, 4],
        });

        const marcadorVertice = L.marker(coordenada, {
            icon: iconoVertice,
            draggable: true,
        }).addTo(this.mapa);

        marcadorVertice.on('drag', (e) => {
            const nuevaPosicion = e.latlng;

            this.puntos[indiceVertice] = nuevaPosicion;
            this.capaPoligono.setLatLngs(this.puntos);
            this.actualizarPopupArea();
        });

        this.capasMarcadores.push(marcadorVertice);

        if (this.puntos.length >= 3) {
            this.actualizarPopupArea();
        }
    }

    /**
     * Actualiza el popup del área de forma óptima sin crear múltiples instancias.
     */
    actualizarPopupArea() {
        if (this.puntos.length < 3) return;

        const areaMetrosCuadrados = this.calcularAreaPlanar(this.puntos);
        let textoArea = '';

        if (areaMetrosCuadrados >= 1000000) {
            textoArea = `${(areaMetrosCuadrados / 1000000).toFixed(2)} km²`;
        } else {
            textoArea = `${(areaMetrosCuadrados / 10000).toFixed(2)} ha (Hectáreas)`;
        }

        const centroide = this.capaPoligono.getBounds().getCenter();
        const nuevoContenido = `<span class="mensaje__titulo">Superficie estimada:</span><br><strong>${textoArea}</strong>`;

        const popupExistente = this.capaPoligono.getPopup();

        if (!popupExistente) {
            this.capaPoligono.bindPopup(nuevoContenido, {
                closeButton: true,
                autoClose: false,
                className: 'popup-medicion-area',
            });
            this.capaPoligono.openPopup(centroide);
        } else {
            popupExistente.setContent(nuevoContenido);
            popupExistente.setLatLng(centroide);

            if (!this.mapa.hasLayer(popupExistente)) {
                this.capaPoligono.openPopup(centroide);
            }
        }
    }

    /**
     * Aplica la fórmula matemática del área de Gauss (Algoritmo de la Lazada / Shoelace formula)
     * adaptada a metros aproximados proyectados en el ecuador (aproximación planar rápida).
     */
    calcularAreaPlanar(coordenadas) {
        let area = 0;
        const j = coordenadas.length;
        const factorM = 111320;

        for (let i = 0; i < j; i++) {
            const p1 = {
                lat: parseFloat(coordenadas[i].lat),
                lng: parseFloat(coordenadas[i].lng),
            };
            const p2 = {
                lat: parseFloat(coordenadas[(i + 1) % j].lat),
                lng: parseFloat(coordenadas[(i + 1) % j].lng),
            };

            if (
                isNaN(p1.lat) ||
                isNaN(p1.lng) ||
                isNaN(p2.lat) ||
                isNaN(p2.lng)
            ) {
                console.warn(
                    'Dato inválido detectado en cálculo de área, omitiendo segmento.'
                );
                continue;
            }

            const x1 = p1.lng * factorM * Math.cos((p1.lat * Math.PI) / 180);
            const y1 = p1.lat * factorM;
            const x2 = p2.lng * factorM * Math.cos((p2.lat * Math.PI) / 180);
            const y2 = p2.lat * factorM;

            area += x1 * y2 - x2 * y1;
        }

        return Math.abs(area / 2);
    }

    /**
     * Desactiva la herramienta limpiando todo rastro de capas del mapa.
     */
    desactivar() {
        if (!this.activo) return;
        this.activo = false;
        this.orquestador.registrarDebug(
            'Área',
            'Herramienta de área DESACTIVADA. Purgando polígonos y popups.'
        );

        this.mapa.getContainer().style.cursor = '';
        this.mapa.off('click', this.manejadorClickMapa);

        // Desvincular y cerrar el popup del polígono antes de destruirlo
        if (this.capaPoligono) {
            this.capaPoligono.closePopup();
            this.capaPoligono.unbindPopup();
            this.mapa.removeLayer(this.capaPoligono);
            this.capaPoligono = null;
        }

        // Limpiar la referencia por si acaso se usó en otra parte
        if (this.marcadorCentroidePopup) {
            this.mapa.closePopup(this.marcadorCentroidePopup);
            this.marcadorCentroidePopup = null;
        }

        // Quitar todos los vértices arrastrables del mapa
        this.capasMarcadores.forEach((m) => this.mapa.removeLayer(m));
        this.capasMarcadores = [];
        this.puntos = [];
    }
}