export class InterfazPresentacion {
    static crearContenedorBienvenida() {
        const contenedor = document.createElement('div');
        contenedor.className = 'vista-bienvenida-contenedor';

        const section = document.createElement('section');
        section.id = 'vista-presentacion';
        section.className = 'tarjeta tarjeta--bienvenida';

        const titulo = document.createElement('h2');
        titulo.className = 'tarjeta__titulo';
        titulo.textContent = 'GeoVisor de Datos Abiertos — Prototipo';

        const p1 = document.createElement('p');
        p1.className = 'tarjeta__texto';
        p1.textContent =
            'Este prototipo de GeoVisor de Datos Abiertos ofrece un entorno para la visualización y el acceso a información geográfica pública de Uruguay.';

        const p2 = document.createElement('p');
        p2.className = 'tarjeta__texto';
        p2.textContent =
            'Desarrollado con software libre por el Equipo de IDEuy, presenta el concepto, la organización de contenidos y una propuesta de diseño orientada a facilitar la consulta de recursos y datos geoespaciales.';

        const p3 = document.createElement('p');
        p3.className = 'alerta__construccion';
        p3.textContent =
            'Al encontrarse en fase de prototipo, algunas funcionalidades pueden cambiar entre visitas, como parte del proceso de validación y mejora continua.';

        const boton = document.createElement('button');
        boton.id = 'btn-iniciar';
        boton.className = 'boton boton--iniciar';
        boton.textContent = 'Ingresar al GeoVisor';

        section.append(titulo, p1, p2, p3, boton);
        contenedor.appendChild(section);

        return contenedor;
    }
}