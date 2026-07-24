/**
 * gestor-mapa.js
 * Módulo encargado exclusivamente de la manipulación de la API de Leaflet.
 */
export class GestorMapa {
    constructor(orquestador) {
        this.orquestador = orquestador;
        this.mapa = null;
        this.controlMinimapa = null;
        this.controlEscala = null;
        this.controlZoom = null;
        this.capaBaseActual = null;
        this.capaBusqueda = null;
        this.capaPoligonoElectoral = null;
        this.capasOperativasActivas = {};
        this.marcadorActivo = null;
    }

    inicializar(idContenedor, parametros, proveedor) {
        this.orquestador.debug(
            'Gestor Mapa',
            `Inicializando mapa Leaflet en el contenedor #${idContenedor}.`
        );

        const opcionesDeMapa = {
            zoomControl: false,
            attributionControl: false,
            ...parametros.opcionesDefault,
        };

        this.mapa = L.map(idContenedor, opcionesDeMapa).setView(
            parametros.centro,
            parametros.zoomInicial
        );

        this.capaBaseActual = L.tileLayer(proveedor.url, {
            ...proveedor.opciones,
        }).addTo(this.mapa);

        this.capaBusqueda = L.featureGroup().addTo(this.mapa);
        this.capaPoligonoElectoral = L.featureGroup().addTo(this.mapa);

        this.controlZoom = L.control
            .zoom({ position: 'topright' })
            .addTo(this.mapa);
        this.controlEscala = L.control
            .scale({ imperial: false, position: 'bottomleft' })
            .addTo(this.mapa);

        const capaMinimapa = L.tileLayer(proveedor.url, {
            ...proveedor.opciones,
        });
        this.controlMinimapa = new L.Control.MiniMap(capaMinimapa, {
            position: 'bottomright',
            width: 150,
            height: 150,
            zoomLevelOffset: -6,
            aimingRectOptions: { color: '#ff7800', weight: 2 },
            toggleDisplay: true,
            minimized: false,
            autoToggleDisplay: false,
        }).addTo(this.mapa);

        setTimeout(() => {
            if (this.mapa) this.mapa.invalidateSize();
            this.orquestador.debug(
                'Gestor Mapa',
                'Tamaño del mapa ajustado correctamente.'
            );
        }, 150);
    }

    cambiarMapaBase(nuevoProveedor) {
        this.orquestador.debug(
            'Gestor Mapa',
            `Cambiando mapa base a: ${nuevoProveedor.nombre}`
        );
        if (!this.mapa) return;

        if (this.capaBaseActual) {
            this.mapa.removeLayer(this.capaBaseActual);
        }

        this.capaBaseActual = L.tileLayer(nuevoProveedor.url, {
            ...nuevoProveedor.opciones,
        }).addTo(this.mapa);

        this.traerCapasSuperioresAlFrente();
    }

    manejarCapaOperativa(capaConfig, activa) {
        this.orquestador.debug(
            'Gestor Mapa',
            `Capa Operativa WMS: ${capaConfig.nombre} -> ${activa ? 'ON' : 'OFF'}`
        );
        if (!this.mapa) return;

        if (activa) {
            const nuevaCapa = L.tileLayer.wms(capaConfig.url, {
                layers: capaConfig.capa,
                format: 'image/png',
                transparent: true,
                version: capaConfig.version || '1.3.0',
                attribution: capaConfig.atribucion || '',
                zIndex: 100,
            });

            nuevaCapa.addTo(this.mapa);
            this.capasOperativasActivas[capaConfig.id] = nuevaCapa;

            this.traerCapasSuperioresAlFrente();
        } else {
            const capaActiva = this.capasOperativasActivas[capaConfig.id];
            if (capaActiva) {
                this.mapa.removeLayer(capaActiva);
                delete this.capasOperativasActivas[capaConfig.id];
            }
        }
    }

    graficarMarcador(coordenadas, htmlPopup, nivelZoom = 17) {
        this.orquestador.debug(
            'Gestor Mapa',
            `Graficando marcador en lat/lng: ${coordenadas[0]}, ${coordenadas[1]}`
        );
        this.limpiarCapaBusqueda();

        const marcador = L.marker(coordenadas).bindPopup(htmlPopup, {
            maxWidth: 300,
            className: 'direcciones-custom-popup',
        });

        this.capaBusqueda.addLayer(marcador);
        this.marcadorActivo = marcador;

        this.mapa.setView(coordenadas, nivelZoom);
        marcador.openPopup();
    }

    dibujarPoligonoConEtiqueta(featureGeoJSON, textoEtiqueta) {
        this.orquestador.debug(
            'Gestor Mapa',
            `Dibujando polígono GeoJSON y etiqueta centrada: "${textoEtiqueta}"`
        );
        this.limpiarCapaPoligonos();

        const capaPoligono = L.geoJSON(featureGeoJSON, {
            style: {
                color: '#5a7d94',
                weight: 3,
                fillColor: '#5a7d94',
                fillOpacity: 0.25,
            },
        });

        this.capaPoligonoElectoral.addLayer(capaPoligono);

        const bounds = capaPoligono.getBounds();
        const centroPoligono = bounds.getCenter();

        const labelIcono = L.divIcon({
            className: 'direcciones-label-serie-electoral',
            html: textoEtiqueta,
            iconSize: [80, 25],
            iconAnchor: [40, 12.5],
        });

        const marcadorLabel = L.marker(centroPoligono, { icon: labelIcono });
        this.capaPoligonoElectoral.addLayer(marcadorLabel);
    }

    /**
     * Actualiza el contenido HTML del Popup del marcador de búsqueda activo.
     * @param {string} nuevoHtmlPopup - Nueva cadena HTML para el popup.
     */
    actualizarPopupMarcador(nuevoHtmlPopup) {
        this.orquestador.debug(
            'Gestor Mapa',
            'Actualizando contenido del Popup actual.'
        );

        if (!this.marcadorActivo) return;

        this.marcadorActivo.setPopupContent(nuevoHtmlPopup);

        const popup = this.marcadorActivo.getPopup();
        if (popup && popup.isOpen()) {
            popup.update();
        }
    }

    limpiarCapaBusqueda() {
        if (this.capaBusqueda) this.capaBusqueda.clearLayers();
        this.marcadorActivo = null;
    }

    limpiarCapaPoligonos() {
        if (this.capaPoligonoElectoral)
            this.capaPoligonoElectoral.clearLayers();
    }

    traerCapasSuperioresAlFrente() {
        if (this.capaBusqueda) this.capaBusqueda.bringToFront();
        if (this.capaPoligonoElectoral)
            this.capaPoligonoElectoral.bringToFront();
    }

    destruir() {
        this.orquestador.debug(
            'Gestor Mapa',
            'Destruyendo instancia Leaflet y limpiando memoria.'
        );
        if (this.controlMinimapa) this.controlMinimapa.remove();
        this.limpiarCapaBusqueda();
        this.limpiarCapaPoligonos();

        if (this.mapa) {
            this.mapa.remove();
            this.mapa = null;
        }
    }
}