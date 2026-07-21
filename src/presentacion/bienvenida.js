/**
 * bienvenida.js
 * Vista de presentación. 
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
        this.orquestador.info(
            'Bienvenida',
            'Inicializando lógica de la vista bienvenida.'
        );

        this.elementoRaiz = InterfazPresentacion.crearContenedorBienvenida();

        const botonIniciar = this.elementoRaiz.querySelector('#btn-iniciar');
        if (botonIniciar) {
            botonIniciar.addEventListener('click', () =>
                this.manejarClickComenzar()
            );
        }

        return this.elementoRaiz;
    }

    manejarClickComenzar() {
        this.orquestador.debug(
            'Bienvenida',
            'Botón Ingresar GeoVisor fue presionado. Solicitando cambio de vista.'
        );

        this.orquestador.enrutarA('cartografia');
    }

    destruir() {
        this.orquestador.debug(
            'Bienvenida',
            'Limpiando los eventos de bienvenida.'
        );
        
        this.elementoRaiz = null;
    }
}
