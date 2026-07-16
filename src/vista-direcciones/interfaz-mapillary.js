/**
 * interfaz-mapillary.js
 * Gestiona el visor de Mapillary
 */
export class InterfazMapillary {
    constructor(contenedorId, orquestador, configuracion) {
        this.contenedor = document.getElementById(contenedorId);
        this.orquestador = orquestador;

        this.config = configuracion;
        this.accessToken = this.config.token;
        this.urlBase = this.config['url-base'];
        this.radio = this.config.radio;
        this.limite = this.config.limite;

        this.activo = false;
        this.imagenes = [];
        this.indiceActual = 0;
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
        if (this.contenedor) {
            this.contenedor.innerHTML = '';
            this.contenedor.style.display = 'none';
        }
    }

    async renderizar(punto) {
        if (!this.contenedor) return;

        this.activo = true;
        this.contenedor.style.display = 'block';

        const lngFija = parseFloat(punto.lng).toFixed(6);
        const latFija = parseFloat(punto.lat).toFixed(6);

        const urlBusqueda = `${this.urlBase}/images?access_token=${this.accessToken}&fields=id,captured_at,thumb_1024_url&lat=${latFija}&lng=${lngFija}&radius=${this.radio}&limit=${this.limite}`;

        try {
            const respuesta = await fetch(urlBusqueda);
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            const datos = await respuesta.json();

            if (datos.data && datos.data.length > 0) {
                this.imagenes = datos.data.sort((a, b) => b.captured_at - a.captured_at);
                this.indiceActual = 0;

                this.mostrarImagenActual();
            } else {
                this.contenedor.innerHTML = `
                    <div class="mapillary-mensaje">
                        No hay cobertura de fotos en esta ubicación.
                    </div>`;
                this.asegurarTirador();
            }
        } catch (error) {
            console.error('[Mapillary Error]:', error);
            this.contenedor.innerHTML = `
                <div class="mapillary-error-contenedor">
                    <p class="mapillary-error-titulo">Error de Conexión</p>
                    <p class="mapillary-error-descripcion">No pudimos cargar las imágenes de Mapillary.</p>
                </div>`;
            this.asegurarTirador();
        }
    }

    mostrarImagenActual() {
        if (!this.imagenes || this.imagenes.length === 0) return;

        const img = this.imagenes[this.indiceActual];

        let fechaFormateada = 'N/A';
        if (img.captured_at) {
            const fechaObj = new Date(img.captured_at);
            const meses = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            const mesNombre = meses[fechaObj.getMonth()];
            const anioFull = fechaObj.getFullYear();
            fechaFormateada = `${mesNombre} ${anioFull}`;
        }

        const total = this.imagenes.length;
        const actual = this.indiceActual + 1;

        this.contenedor.innerHTML = `
            <div class="mapillary-cuerpo-flotante">
                <div class="mapillary-contenedor-imagen">
                    <img src="${img.thumb_1024_url}" class="mapillary-imagen" alt="Vista de calle de Mapillary">
                </div>

                <div class="mapillary-etiqueta-fecha">${fechaFormateada}</div>
                <div class="mapillary-etiqueta-contador">${actual} de ${total}</div>

                ${total > 1 ? `
                    <button id="mapillary-boton-anterior" class="mapillary-flecha mapillary-flecha--izquierda" title="Foto anterior">
                        &#10094;
                    </button>
                    <button id="mapillary-boton-siguiente" class="mapillary-flecha mapillary-flecha--derecha" title="Foto siguiente">
                        &#10095;
                    </button>
                ` : ''}
            </div>
        `;

        if (total > 1) {
            const btnPrev = this.contenedor.querySelector('#mapillary-boton-anterior');
            const btnNext = this.contenedor.querySelector('#mapillary-boton-siguiente');

            if (btnPrev) {
                btnPrev.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.indiceActual = (this.indiceActual - 1 + total) % total;
                    this.mostrarImagenActual();
                });
            }

            if (btnNext) {
                btnNext.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.indiceActual = (this.indiceActual + 1) % total;
                    this.mostrarImagenActual();
                });
            }
        }

        this.asegurarTirador();
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