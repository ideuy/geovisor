/**
 * interfaz-perfil-elevacion.js
 */
export class InterfazPerfilElevacion {
    constructor(orquestador) {
        this.orquestador = orquestador;
        this.panelDOM = null;
        this.grafico = null;
        this.onCerrar = null;
    }

    crearPanel() {
        if (this.panelDOM) return;

        this.panelDOM = document.createElement('div');
        this.panelDOM.className = 'panel-elevacion-contenedor';

        this.panelDOM.innerHTML = `
            <div class="cabecera-panel-elevacion">
                <h3>Perfil de Elevación (Alta Precisión)</h3>
                <button id="btn-cerrar-perfil">✖</button>
            </div>
            <div class="cuerpo-panel-elevacion">
                <div id="aviso-precision" class="aviso-precision">
                    ✓ Modo de máxima precisión MDTHC (32cm/px) <br>
                    ✓ Cálculo de cotas ortométricas basadas en el modelo geoidal EGM2008 EPSG:3855
                </div>
                <div class="contenedor-grafico-perfil">
                    <canvas id="grafico-elevacion"></canvas>
                </div>
                <div id="loader-elevacion" style="display:none; text-align: center; padding: 20px;">
                    Procesando MDTHC en memoria...
                </div>
            </div>
            <div class="tirador-redimensionar"></div>
        `;

        document
            .getElementById('mapa-cartografia-leaflet')
            ?.appendChild(this.panelDOM) ||
            document.body.appendChild(this.panelDOM);

        this.configurarInteractividad();
    }

    /**
     * Configura la interactividad de arrastre, cierre y redimensión del panel.
     * Optimizado con Pointer Events para soporte móvil/táctil nativo y cero fugas de memoria.
     */
    configurarInteractividad() {
        const cabecera = this.panelDOM.querySelector('.cabecera-panel-elevacion');
        const botonCerrar = this.panelDOM.querySelector('#btn-cerrar-perfil');
        const tirador = this.panelDOM.querySelector('.tirador-redimensionar');

        if (botonCerrar) {
            botonCerrar.addEventListener('click', () => {
                this.ocultarPanel();
                if (this.onCerrar) this.onCerrar();
            });
        } else {
            this.orquestador.warn(
                'Perfil Elevación',
                'Interfaz: No se encontró el botón de cierre para vincular eventos.'
            );
        }

        let xInicial, yInicial;
        let xOffset = 0,
            yOffset = 0;

        const arrastrar = (e) => {
            e.preventDefault();
            const nuevoX = e.clientX - xInicial;
            const nuevoY = e.clientY - yInicial;

            this.panelDOM.style.left = `${nuevoX}px`;
            this.panelDOM.style.top = `${nuevoY}px`;
        };

        const detenerArrastre = (e) => {
            cabecera.releasePointerCapture(e.pointerId);
            document.removeEventListener('pointermove', arrastrar);
            document.removeEventListener('pointerup', detenerArrastre);
        };

        cabecera.addEventListener('pointerdown', (e) => {
            if (e.target.id === 'btn-cerrar-perfil') return;

            if (xOffset === 0 && yOffset === 0) {
                const rect = this.panelDOM.getBoundingClientRect();
                this.panelDOM.style.transform = 'none';
                this.panelDOM.style.left = `${rect.left}px`;
                this.panelDOM.style.top = `${rect.top}px`;
                xOffset = 1;
                yOffset = 1;
            }

            xInicial = e.clientX - (parseFloat(this.panelDOM.style.left) || 0);
            yInicial = e.clientY - (parseFloat(this.panelDOM.style.top) || 0);

            cabecera.setPointerCapture(e.pointerId);

            document.addEventListener('pointermove', arrastrar);
            document.addEventListener('pointerup', detenerArrastre);
        });

        let anchoInicial, altoInicial;
        let xInicRes, yInicRes;

        const redimensionar = (e) => {
            const deltaX = e.clientX - xInicRes;
            const deltaY = e.clientY - yInicRes;

            const nuevoAncho = Math.max(300, anchoInicial + deltaX);
            const nuevoAlto = Math.max(200, altoInicial + deltaY);

            this.panelDOM.style.width = `${nuevoAncho}px`;
            this.panelDOM.style.height = `${nuevoAlto}px`;

            if (this.grafico) {
                this.grafico.resize();
            }
        };

        const detenerRedimensionado = (e) => {
            tirador.releasePointerCapture(e.pointerId);
            document.removeEventListener('pointermove', redimensionar);
            document.removeEventListener('pointerup', detenerRedimensionado);
        };

        tirador.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            anchoInicial = this.panelDOM.offsetWidth;
            altoInicial = this.panelDOM.offsetHeight;
            xInicRes = e.clientX;
            yInicRes = e.clientY;

            tirador.setPointerCapture(e.pointerId);

            document.addEventListener('pointermove', redimensionar);
            document.addEventListener('pointerup', detenerRedimensionado);
        });
    }

    mostrarCargando(esAltaPrecision) {
        if (!this.panelDOM) this.crearPanel();
        this.panelDOM.style.display = 'block';
        const aviso = this.panelDOM.querySelector('#aviso-precision');
        aviso.style.display = esAltaPrecision ? 'block' : 'none';
        this.panelDOM.querySelector('#loader-elevacion').style.display =
            'block';
        this.panelDOM.querySelector('#grafico-elevacion').style.display =
            'none';
    }

    renderizarGrafico(datos) {
        this.panelDOM.querySelector('#loader-elevacion').style.display = 'none';
        const canvas = this.panelDOM.querySelector('#grafico-elevacion');
        canvas.style.display = 'block';
        const ctx = canvas.getContext('2d');
        if (this.grafico) this.grafico.destroy();
        this.grafico = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datos.map((d) => `${d.distancia.toFixed(0)}m`),
                datasets: [
                    {
                        label: 'Elevación (msnm)',
                        data: datos.map((d) => d.elevacion),
                        borderColor: '#2980b9',
                        backgroundColor: 'rgba(41, 128, 185, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0,
                        pointRadius: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Distancia (m)' } },
                    y: { beginAtZero: false },
                },
            },
        });
    }

    ocultarPanel() {
        if (this.panelDOM) this.panelDOM.style.display = 'none';
    }
    destruir() {
        if (this.grafico) {
            this.grafico.destroy();
            this.grafico = null;
        }

        if (this.panelDOM && this.panelDOM.parentNode) {
            this.panelDOM.parentNode.removeChild(this.panelDOM);
            this.panelDOM = null;
        }

        this.datosOriginales = null;
    }
}
