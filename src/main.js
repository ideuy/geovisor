/**
 * main.js
 * Punto de entrada inicial del ciclo de ejecución.
 * Se encarga de instanciar e inicializar el Orquestador central del Geovisor.
 */

import { Orquestador } from './orquestador.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const geovisorApp = new Orquestador();
        await geovisorApp.inicializar();
    } catch (error) {
        console.error('[Main] No se pudo arrancar la aplicación.', error);
    }
});
