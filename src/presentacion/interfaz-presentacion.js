export class InterfazPresentacion {
    static crearContenedorBienvenida() {
        const contenedor = document.createElement('div');
        
        contenedor.className = 'vista-bienvenida-contenedor'; 

        contenedor.innerHTML = `
            <section id="vista-presentacion" class="tarjeta tarjeta--bienvenida">
                <h2 class="tarjeta__titulo">GeoVisor de Datos Abiertos — Prototipo</h2>
                
                <p class="tarjeta__texto">Este prototipo de GeoVisor de Datos Abiertos ofrece un entorno para la visualización y el acceso a información geográfica pública de Uruguay.</p>

                <p class="tarjeta__texto">Desarrollado con software libre por el Equipo de IDEuy, presenta el concepto, la organización de contenidos y una propuesta de diseño orientada a facilitar la consulta de recursos y datos geoespaciales.</p>

                <p class="alerta__construccion">Al encontrarse en fase de prototipo, algunas funcionalidades pueden cambiar entre visitas, como parte del proceso de validación y mejora continua.</p>
                    
                <button id="btn-iniciar" class="boton boton--iniciar">Ingresar al GeoVisor</button>
            </section>
        `;
        return contenedor;
    }
}