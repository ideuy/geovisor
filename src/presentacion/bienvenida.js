/**
 * bienvenida.js
 * Lógica de negocio de la vista de presentación.
 * Vincula la interfaz con las acciones de control.
 */
import { InterfazPresentacion } from './interfaz-presentacion.js';

export class Bienvenida {
    constructor(orquestador) {
        this.orquestador = orquestador;
        this.elementoRaiz = null;
    }

    /**
     * Inicializa la vista y asocia sus eventos.
     * @returns {HTMLElement} Vista lista para ser insertada en el DOM principal.
     */
    inicializar() {
        this.orquestador.registrarDebug(
            'Bienvenida',
            'Inicializando lógica de vista bienvenida.'
        );

        // 1. Obtener la interfaz pura
        this.elementoRaiz = InterfazPresentacion.crearContenedorBienvenida();

        // 2. Vincular eventos de la lógica de negocio (usando el DOM generado)
        const botonIniciar = this.elementoRaiz.querySelector('#btn-iniciar');
        if (botonIniciar) {
            botonIniciar.addEventListener('click', () =>
                this.manejarClickComenzar()
            );
        }

        return this.elementoRaiz;
    }

    manejarClickComenzar() {
        this.orquestador.registrarDebug(
            'Bienvenida',
            'Botón Ingresar GeoVisor fue presionado. Solicitando cambio de ruta.'
        );
        // Delegar el cambio de vista al orquestador global
        this.orquestador.enrutarA('cartografia');
    }

    /**
     * Método de limpieza para evitar fugas de memoria (Memory Leaks)
     */
    destruir() {
        this.orquestador.registrarDebug(
            'Bienvenida',
            'Destruyendo los eventos de bienvenida.'
        );
        // Aquí removeríamos listeners si mantuviéramos referencias globales.
        this.elementoRaiz = null;
    }
}
