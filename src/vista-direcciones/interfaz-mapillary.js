/**
 * interfaz-mapillary.js
 * Integración del visor interactivo de Mapillary leyendo window.mapillary
 */
export class InterfazMapillary {
    /**
     * @param {string} contenedorId
     * @param {Orquestador} orquestador
     * @param {Object} configuracion
     * @param {Function} [invalidarMapaCallback] Función sin argumentos que
     *   invalida el tamaño del mapa Leaflet activo, invocada al redimensionar
     *   el visor con el tirador de arrastre.
     */
    constructor(
        contenedorId,
        orquestador,
        configuracion,
        invalidarMapaCallback = null
    ) {
        this.contenedor = document.getElementById(contenedorId);
        this.orquestador = orquestador;
        this.invalidarMapaCallback = invalidarMapaCallback;

        // Carga de configuración desde aplicacion.json
        this.config = configuracion || {};
        this.accessToken = this.config.token;
        this.urlBase = this.config['url-base'] || 'https://graph.mapillary.com';
        this.radio = this.config.radio || 50;
        this.limite = this.config.limite || 10;

        this.activo = false;
        this.viewer = null;
        this.tirador = null;
        this.cuerpoContenido = null;
    }

    activar(puntoActual) {
        this.activo = true;
        if (!this.contenedor) return;

        this.contenedor.classList.add('direcciones-mapillary-flotante--activo');
        this.asegurarTirador();
        this.posicionarTirador();

        if (puntoActual) {
            this.renderizar(puntoActual);
        } else {
            this.mostrarContenido(`
                <div class="mapillary-mensaje">
                    Busca una dirección o usa la búsqueda inversa para ver el entorno.
                </div>`);
        }
    }

    desactivar() {
        this.activo = false;
        this.destruirVisor();
        if (this.contenedor) {
            this.contenedor.innerHTML = '';
            this.contenedor.classList.remove(
                'direcciones-mapillary-flotante--activo'
            );
        }
        if (this.tirador && this.tirador.parentElement) {
            this.tirador.remove();
        }
        this.tirador = null;
        this.cuerpoContenido = null;
    }

    destruirVisor() {
        if (this.viewer) {
            try {
                this.viewer.remove(); // Libera el contexto WebGL de la memoria
            } catch (error) {
                this.orquestador.warn(
                    'Mapillary',
                    'Error al remover la instancia del visor:',
                    error
                );
            }
            this.viewer = null;
        }
    }

    async renderizar(punto) {
        if (!this.contenedor) return;

        // Garantizar que exista la estructura del cuerpo y el tirador antes de consultar/renderizar
        this.asegurarTirador();

        // 1. Detectar la librería global window.mapillary
        const MapillaryLib =
            window.mapillary || window.mapillaryjs || window.Mapillary;

        if (!MapillaryLib || !MapillaryLib.Viewer) {
            this.orquestador.error(
                'Mapillary',
                'No se encontró el constructor Viewer en window.mapillary.'
            );
            this.destruirVisor();
            this.mostrarContenido(`
                <div class="mapillary-error-contenedor">
                    <p class="mapillary-error-titulo">Error de Librería</p>
                    <p class="mapillary-error-descripcion">No se pudo inicializar la librería de Mapillary.</p>
                </div>`);
            return;
        }

        this.activo = true;
        this.contenedor.classList.add('direcciones-mapillary-flotante--activo');
        this.posicionarTirador();

        const latVal = punto.lat ?? punto.y ?? punto.geometry?.coordinates[1];
        const lngVal = punto.lng ?? punto.x ?? punto.geometry?.coordinates[0];

        if (latVal === undefined || lngVal === undefined) {
            this.orquestador.error(
                'Mapillary',
                'Coordenadas no válidas recibidas en el renderizador.',
                punto
            );
            return;
        }

        const lngFija = parseFloat(lngVal).toFixed(6);
        const latFija = parseFloat(latVal).toFixed(6);

        // 2. Consulta a Mapillary Graph API (lat, lng, radius)
        const urlBusqueda = `${this.urlBase}/images?access_token=${this.accessToken}&fields=id,captured_at&lat=${latFija}&lng=${lngFija}&radius=${this.radio}&limit=${this.limite}`;

        try {
            const respuesta = await fetch(urlBusqueda);
            if (!respuesta.ok)
                this.orquestador.throwError(
                    'Mapillary',
                    `HTTP ${respuesta.status}`
                );
            const datos = await respuesta.json();

            if (datos.data && datos.data.length > 0) {
                // Ordenar por la captura más reciente
                const imagenesOrdenadas = datos.data.sort(
                    (a, b) => (b.captured_at || 0) - (a.captured_at || 0)
                );
                const idImagenReciente = imagenesOrdenadas[0].id;

                // 3. Instanciar o mover el visor WebGL dentro del cuerpo aislado
                if (!this.viewer) {
                    this.limpiarContenido();

                    this.viewer = new MapillaryLib.Viewer({
                        accessToken: this.accessToken,
                        container: this.cuerpoContenido,
                        imageId: idImagenReciente,
                        component: {
                            cover: false,
                            spatial: false,
                        },
                    });
                } else {
                    this.viewer.moveTo(idImagenReciente);
                }
            } else {
                this.destruirVisor();
                this.mostrarContenido(`
                    <div class="mapillary-mensaje">
                        No hay cobertura de fotos en esta ubicación.
                    </div>`);
            }
        } catch (error) {
            this.orquestador.error('Mapillary', 'Error: ', error);
            this.destruirVisor();
            this.mostrarContenido(`
                <div class="mapillary-error-contenedor">
                    <p class="mapillary-error-titulo">Error de Conexión</p>
                    <p class="mapillary-error-descripcion">No pudimos cargar las imágenes de Mapillary.</p>
                </div>`);
        }
    }

    posicionarTirador() {
        if (!this.tirador) return;
        this.tirador.classList.add('mapillary-tirador-ai--visible');
    }

    asegurarTirador() {
        if (!this.contenedor) return;

        if (!this.cuerpoContenido || !this.cuerpoContenido.isConnected) {
            this.cuerpoContenido = document.createElement('div');
            this.cuerpoContenido.className = 'mapillary-cuerpo-flotante';
            this.contenedor.appendChild(this.cuerpoContenido);
        }

        if (this.tirador && this.tirador.isConnected) {
            this.posicionarTirador();
            return;
        }

        this.tirador = document.createElement('div');
        this.tirador.className = 'mapillary-tirador-ai';
        this.tirador.setAttribute('aria-hidden', 'true');

        // Se inserta directamente dentro del contenedor principal
        this.contenedor.appendChild(this.tirador);
        this.posicionarTirador();

        let startY, startHeight;
        let startX, startWidth;

        const onMouseMove = (e) => {
            const deltaY = e.clientY - startY;
            const deltaX = e.clientX - startX;

            const nuevoAlto = Math.max(150, startHeight + deltaY);
            // Al estar anclado a la derecha (right: 50px), mover a la izquierda (-deltaX) aumenta el ancho
            const nuevoAncho = Math.max(240, startWidth - deltaX);

            this.contenedor.style.height = `${nuevoAlto}px`;
            this.contenedor.style.width = `${nuevoAncho}px`;

            if (this.viewer && typeof this.viewer.resize === 'function') {
                requestAnimationFrame(() => {
                    try {
                        this.viewer.resize();
                    } catch (error) {
                        this.orquestador.warn(
                            'Mapillary',
                            'No se pudo redimensionar el visor:',
                            error
                        );
                    }
                });
            }

            if (typeof this.invalidarMapaCallback === 'function') {
                this.invalidarMapaCallback();
            }
        };

        const onMouseUp = () => {
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this.tirador.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            startY = e.clientY;
            startX = e.clientX;
            document.body.style.userSelect = 'none';

            const rect = this.contenedor.getBoundingClientRect();
            startHeight = rect.height;
            startWidth = rect.width;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    mostrarContenido(html) {
        this.asegurarTirador();
        if (this.cuerpoContenido) {
            this.cuerpoContenido.innerHTML = html;
        }
    }

    limpiarContenido() {
        if (this.cuerpoContenido) {
            this.cuerpoContenido.innerHTML = '';
        }
    }
}
