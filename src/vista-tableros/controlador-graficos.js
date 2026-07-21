/**
 * Controlador de Gráficos (40% Analítico de la Vista)
 * Centraliza la creación, destrucción y actualización de las instancias de Chart.js.
 */
export class ControladorGraficos {
    constructor(idCanvasBarras, idCanvasPastel) {
        this.idCanvasBarras = idCanvasBarras;
        this.idCanvasPastel = idCanvasPastel;

        this.instanciaBarras = null;
        this.instanciaPastel = null;

        this.paletaColores = [
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(201, 203, 207, 0.7)',
        ];

        this.paletaBordes = this.paletaColores.map((c) =>
            c.replace('0.7', '1')
        );
    }

    actualizarGraficos(distribucion, etiquetaDimension) {
        const dataClasificada = distribucion || [];
        const topDatos = dataClasificada.slice(0, 7);

        const labels = topDatos.map((item) => item.categoria);
        const data = topDatos.map((item) => item.casos);

        this.renderizarGraficoBarras(labels, data, etiquetaDimension);
        this.renderizarGraficoPastel(labels, data);
    }

    /**
     * Dibuja o actualiza el gráfico de barras.
     */
    renderizarGraficoBarras(labels, data, etiquetaDimension) {
        if (this.instanciaBarras) {
            this.instanciaBarras.data.labels = labels;
            this.instanciaBarras.data.datasets[0].data = data;
            this.instanciaBarras.data.datasets[0].label = `Casos por ${etiquetaDimension}`;
            this.instanciaBarras.update('none'); // 'none' evita la animación o quitar el parámetro para animar
            return;
        }

        const ctx = document
            .getElementById(this.idCanvasBarras)
            .getContext('2d');
        this.instanciaBarras = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `Casos por ${etiquetaDimension}`,
                        data: data,
                        backgroundColor: this.paletaColores,
                        borderColor: this.paletaBordes,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 0,
                        },
                    },
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                },
            },
        });
    }

    /**
     * Dibuja o actualiza el gráfico de pastel.
     */
    renderizarGraficoPastel(labels, data) {
        if (this.instanciaPastel) {
            this.instanciaPastel.data.labels = labels;
            this.instanciaPastel.data.datasets[0].data = data;
            this.instanciaPastel.update('none');
            return;
        }

        const ctx = document
            .getElementById(this.idCanvasPastel)
            .getContext('2d');
        this.instanciaPastel = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [
                    {
                        data: data,
                        backgroundColor: this.paletaColores,
                        borderColor: this.paletaBordes,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 11 } },
                    },
                },
            },
        });
    }

    destruir() {
        if (this.instanciaBarras) this.instanciaBarras.destroy();
        if (this.instanciaPastel) this.instanciaPastel.destroy();
    }
}
