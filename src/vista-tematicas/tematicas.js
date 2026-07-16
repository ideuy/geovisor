import { InterfazTematicas } from './interfaz-tematicas.js';

export class Tematicas {
    constructor(orquestador) {
        this.orquestador = orquestador;
        this.elementoRaiz = null;
    }

    async inicializar() {
        this.orquestador.registrarDebug(
            'Temáticas',
            'Cargando ejes temáticos y catálogos de tableros.'
        );

        try {
            const [resTematicas, resTableros] = await Promise.all([
                fetch('./config/tematicas.json'),
                fetch('./config/tableros.json'),
            ]);

            if (!resTematicas.ok || !resTableros.ok)
                throw new Error('Error al descargar configuraciones.');

            const configTemas = await resTematicas.json();
            const configTableros = await resTableros.json();
            const listaTableros = configTableros.tableros || [];

            this.elementoRaiz = InterfazTematicas.crearContenedorBase(
                configTemas.encabezado
            );
            const grilla = this.elementoRaiz.querySelector(
                '#grilla-tarjetas-tematicas'
            );

            if (configTemas.tematicas) {
                Object.entries(configTemas.tematicas).forEach(
                    ([nombreTematica, infoTematica]) => {
                        const tarjeta = InterfazTematicas.crearTarjetaTematica(
                            nombreTematica,
                            infoTematica
                        );
                        grilla.appendChild(tarjeta);
                    }
                );
            }

            this.vincularEventosAcciones(listaTableros);
        } catch (error) {
            console.error('[ERROR][Temáticas]', error);
            this.elementoRaiz = document.createElement('div');
            this.elementoRaiz.innerHTML = `<p class="error-msg">Error al inicializar.</p>`;
        }

        return this.elementoRaiz;
    }

    vincularEventosAcciones(listaTableros) {
        this.elementoRaiz.addEventListener('click', (evento) => {
            const boton = evento.target.closest('.btn-activar-grupo');
            if (!boton) return;

            const tarjeta = boton.closest('.tarjeta-tematica-item');
            const idTematica = tarjeta.dataset.id;
            const rutaDatos = tarjeta.dataset.ruta;
            const idGrupo = boton.dataset.grupoId;

            // Filtramos todos los tableros del grupo y los ordenamos por ordenVisual
            const tablerosDelGrupo = listaTableros
                .filter(
                    (t) => t.idTematica === idTematica && t.idGrupo === idGrupo
                )
                .sort((a, b) => a.ordenVisual - b.ordenVisual);

            if (tablerosDelGrupo.length === 0) {
                console.error(
                    `[ERROR] No hay tableros para el grupo: ${idGrupo}`
                );
                return;
            }

            this.orquestador.registrarDebug(
                'Temáticas',
                `Invocando grupo [${idGrupo}] con ${tablerosDelGrupo.length} tableros.`
            );

            // Notificamos al orquestador enviándole el primer tablero por defecto, pero adjuntando la lista completa del grupo
            this.orquestador.notificar('GRUPO_SELECCIONADO', {
                tableroActivo: tablerosDelGrupo[0],
                listaTableros: tablerosDelGrupo,
                rutaBase: rutaDatos,
            });
        });
    }

    destruir() {
        this.elementoRaiz = null;
    }
}
