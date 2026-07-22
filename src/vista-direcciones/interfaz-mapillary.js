/**
 * interfaz-mapillary.js
 * Gestiona el visor oficial de Mapillary usando mapillary-js (v4)
 */
export class InterfazMapillary {
    constructor(contenedorId, orquestador, configuracion) {
        this.contenedor = document.getElementById(contenedorId);
        this.orquestador = orquestador;

        this.config = configuracion;
        this.accessToken = this.config.token;
        this.urlBase = this.config['url-base'] || 'https://graph.mapillary.com';

        this.activo = false;
        this.viewer = null; // Instancia del visor Mapillary
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
                this.viewer.remove(); // Libera los recursos WebGL y listeners
            } catch (e) {
                this.orquestador.warn('Mapillary','Error al remover el visor:', e);
            }
            this.viewer = null;
        }
    }

    async renderizar(punto) {
        if (!this.contenedor) return;

        this.activo = true;
        this.contenedor.style.display = 'block';

        const lat = parseFloat(punto.lat).toFixed(6);
        const lng = parseFloat(punto.lng).toFixed(6);

        // Consultamos la API de Mapillary usando 'near' para obtener el ID de la imagen cercana
        const urlBusqueda = `${this.urlBase}/images?access_token=${this.accessToken}&fields=id&near=${lng},${lat}&limit=1`;

        try {
            const respuesta = await fetch(urlBusqueda);
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            const datos = await respuesta.json();

            if (datos.data && datos.data.length > 0) {
                const idImagen = datos.data[0].id;

                // Si el visor no existe, lo instanciamos
                if (!this.viewer) {
                    this.contenedor.innerHTML = ''; // Limpiamos mensajes previos

                    this.viewer = new mapillaryjs.Viewer({
                        accessToken: this.accessToken,
                        container: this.contenedor,
                        imageId: idImagen,
                    });
                } else {
                    // Si ya existe la instancia, solo nos desplazamos a la nueva imagen
                    this.viewer.moveTo(idImagen);
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
                    <p class="mapillary-error-descripcion">No pudimos cargar el visor de Mapillary.</p>
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

                // Cuando se redimensiona el contenedor, mapillary-js requiere recalculado de canvas
                if (this.viewer) {
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
