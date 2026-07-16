# Geovisor de Datos Públicos Abiertos

Estructura modular orientada al despliegue ágil de capas de información geoespacial y tableros analíticos interactivos empleando el stack nativo **HTML5, CSS3, JavaScript (ES6)** y la librería cartográfica **Leaflet**.

## 🛠️ Instalación y Entorno Local

Al estar construido sobre módulos nativos de JavaScript, no requiere de compiladores pesados para su ejecución en desarrollo.

1. Clona el repositorio en tu máquina local.
2. Abre la carpeta del proyecto en tu servidor web local de preferencia (ej. extensión *Live Server* en VSCode).
> **Importante:** Debido a las restricciones de seguridad de la política de origen de los módulos de JavaScript (`CORS`), el proyecto **no** debe abrirse haciendo doble clic directamente sobre el archivo `index.html`. Debe servirse siempre mediante protocolo `http://` o `https://`.

## 🚀 Despliegue en GitHub Pages

Este proyecto está optimizado para publicarse directamente desde un repositorio de GitHub de forma estática:

1. Sube los archivos a un repositorio en tu cuenta de GitHub.
2. Dirígete a **Settings** (Configuración) > **Pages**.
3. En la sección **Build and deployment**, selecciona la rama principal (`main` o `master`) y la carpeta `/` (raíz).
4. Guarda los cambios. En pocos minutos la aplicación estará en línea en la URL provista por GitHub.