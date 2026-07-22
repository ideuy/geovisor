/**
 * interfaz-mapillary.js
 * Integración del visor interactivo de Mapillary leyendo window.mapillary
 */
export class InterfazMapillary {
    constructor(contenedorId, orquestador, configuracion) {
        this.contenedor = document.getElementById(contenedorId);
        this.orquestador = orquestador;

        // Carga de configuración desde aplicacion.json
        this.config = configuracion || {};
        this.accessToken = this.config.token;
        this.urlBase = this.config['url-base'] || 'https://graph.mapillary.com';
        this.radio = this.config.radio || 50;
        this.limite = this.config.limite || 10;

        this.activo = false;
        this.viewer = null;
    }

    activar(puntoActual) {
        this.activo = true;
        if (!this.contenedor) return;

        this.contenedor.style.display = 'block';
        if (puntoActual) {
            this.renderizar(puntoActual);
        } else {
            this.contenedor.innerHTML = `
                <div class="mapillary-mensaje">
                    Busca una dirección o usa la búsqueda inversa para ver el entorno.
                </div>`;
            this.asegurarTirador();
        }
    }

    desactivar() {
        this.activo = false;
        this.destruirVisor();
        if (this.contenedor) {
            this.contenedor.innerHTML = '';
            this.contenedor.style.display = 'none';
        }
    }

    destruirVisor() {
        if (this.viewer) {
            try {
                this.viewer.remove(); // Libera el contexto WebGL de la memoria
            } catch (error) {
                this.orquestador.warn(
                    'Mapillary', 'Error al remover la instancia del visor:',
                    error
                );
            }
            this.viewer = null;
        }
    }

    async renderizar(punto) {
        if (!this.contenedor) return;

        // 1. Detectar la librería global window.mapillary
        const MapillaryLib =
            window.mapillary || window.mapillaryjs || window.Mapillary;

        if (!MapillaryLib || !MapillaryLib.Viewer) {
            this.orquestador.error(
                'Mapillary','No se encontró el constructor Viewer en window.mapillary.'
            );
            this.destruirVisor();
            this.contenedor.innerHTML = `
                <div class="mapillary-error-contenedor">
                    <p class="mapillary-error-titulo">Error de Librería</p>
                    <p class="mapillary-error-descripcion">No se pudo inicializar la librería de Mapillary.</p>
                </div>`;
            this.asegurarTirador();
            return;
        }

        this.activo = true;
        this.contenedor.style.display = 'block';

        const lngFija = parseFloat(punto.lng).toFixed(6);
        const latFija = parseFloat(punto.lat).toFixed(6);

        // 2. Consulta a Mapillary Graph API (lat, lng, radius)
        const urlBusqueda = `${this.urlBase}/images?access_token=${this.accessToken}&fields=id,captured_at&lat=${latFija}&lng=${lngFija}&radius=${this.radio}&limit=${this.limite}`;

        try {
            const respuesta = await fetch(urlBusqueda);
            if (!respuesta.ok) this.orquestador.throwError('Mapillary', `HTTP ${respuesta.status}`);
            const datos = await respuesta.json();

            if (datos.data && datos.data.length > 0) {
                // Ordenar por la captura más reciente
                const imagenesOrdenadas = datos.data.sort(
                    (a, b) => (b.captured_at || 0) - (a.captured_at || 0)
                );
                const idImagenReciente = imagenesOrdenadas[0].id;

                // 3. Instanciar o mover el visor WebGL
                if (!this.viewer) {
                    this.contenedor.innerHTML = ''; // Limpiar mensajes de texto previos

                    this.viewer = new MapillaryLib.Viewer({
                        accessToken: this.accessToken,
                        container: this.contenedor,
                        imageId: idImagenReciente,
                        component: {
                            cover: false, // Inicia la imagen directamente sin pantalla de portada
                        },
                    });
                } else {
                    this.viewer.moveTo(idImagenReciente);
                }

                this.asegurarTirador();
            } else {
                this.destruirVisor();
                this.contenedor.innerHTML = `
                    <div class="mapillary-mensaje">
                        No hay cobertura de fotos en esta ubicación.
                    </div>`;
                this.asegurarTirador();
            }
        } catch (error) {
            this.orquestador.error('Mapillary', 'Error: ', error);
            this.destruirVisor();
            this.contenedor.innerHTML = `
                <div class="mapillary-error-contenedor">
                    <p class="mapillary-error-titulo">Error de Conexión</p>
                    <p class="mapillary-error-descripcion">No pudimos cargar las imágenes de Mapillary.</p>
                </div>`;
            this.asegurarTirador();
        }
    }

    asegurarTirador() {
        let tirador = this.contenedor.querySelector('.mapillary-tirador-ai');
        if (!tirador) {
            tirador = document.createElement('div');
            tirador.className = 'mapillary-tirador-ai';
            this.contenedor.appendChild(tirador);

            let startY, startHeight;
            let startX, startWidth;

            const onMouseMove = (e) => {
                const deltaY = e.clientY - startY;
                const deltaX = startX - e.clientX;

                const nuevoAlto = Math.max(150, startHeight + deltaY);
                const nuevoAncho = Math.max(240, startWidth + deltaX);

                this.contenedor.style.height = `${nuevoAlto}px`;
                this.contenedor.style.width = `${nuevoAncho}px`;

                // Reajustar el canvas WebGL al redimensionar la ventana flotante
                if (this.viewer && typeof this.viewer.resize === 'function') {
                    this.viewer.resize();
                }

                if (this.orquestador && this.orquestador.mapaDirecciones) {
                    this.orquestador.mapaDirecciones.invalidateSize();
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            tirador.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                startY = e.clientY;
                startX = e.clientX;

                const rect = this.contenedor.getBoundingClientRect();
                startHeight = rect.height;
                startWidth = rect.width;

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }
    }
}
