# GeoVisor de Datos Abiertos de Uruguay

El GeoVisor es una plataforma web geoespacial interactiva desarrollada para la búsqueda, exploración, análisis estadístico y visualización cartográfica de capas operativas e indicadores de datos abiertos de Uruguay.

Construido completamente con software libre **JavaScript Vanilla**, HTML5, CSS3, Leaflet, el proyecto sigue una arquitectura desacoplada orientada a componentes donde las configuraciones se definen a través de archivos JSON dinámicos.

## Características Principales

### Módulo de Cartografía y Capas Operativas

* **Mapas Base Multifuente:** Soporte para múltiples proveedores de teselas configurables, incluyendo el Mapa Base Oficial de la IDE Uruguay (WMTS/WMS), Ortofotos Nacionales e Infrarrojas, Modelos Digitales de Terreno/Superficie (MDT/MDS), capas históricas (Nacional 1966), OpenStreetMap, Esri Satelital y CartoDB.

* **Control Avanzado de Capas:** Panel lateral interactivo con controles individuales de visibilidad, deslizadores dinámicos de opacidad y niveles de corte para capas vectoriales y ráster.

* **Herramientas Geográficas:**
* Medición interactiva de distancias y áreas con tooltips de métricas geométricas en tiempo real.
* Consulta e identificación de atributos de entidades en el mapa mediante tablas dinámicas.
* Módulo de **Perfil de Elevación** dinámico que genera un gráfico interactivo transversal de altitudes basado en muestras sobre modelos de elevación digitales (MDT).

### Módulo de Direcciones y Geocodificación Nacional

* **Buscador Flotante:** Barra de búsqueda integrada directamente con las APIs del **Sistema Único de Direcciones del Uruguay (SUDIR)** (`https://direcciones.ide.uy/`). Ofrece sugerencias automáticas de candidatos a medida que el usuario escribe.

* **Servicios Geoespaciales Integrados:**
* **Geocodificación Directa:** Localización precisa de calles, portales y localidades de todo el país.
* **Geocodificación Inversa:** Obtención de la dirección geográfica más cercana, coordenadas y datos detallados al hacer clic sobre cualquier punto del territorio nacional.
* **Direcciones en Área:** Extracción y listado automatizado de todos la direcciones válidas contenidas dentro de una zona delimitada por el usuario en el mapa.
* **Análisis Vía y Cruces:** Identificación de tramos de calles y cálculo automático de intersecciones viales (cruces) con trazados geométricos automáticos en el mapa.
* **Enriquecimiento Territorial:** Cruce en tiempo real para determinar la **Serie Electoral** correspondiente a la ubicación geográfica seleccionada.

* **Visor de Entorno Urbano (Mapillary):** Contenedor flotante interactivo, redimensionable y adaptable que consume la API de Mapillary para renderizar secuencias fotográficas de calles a nivel de suelo, sincronizado con la posición y dirección en el mapa.

### Explorador Temático y Tableros Estadísticos (Dashboards)

* **Estructura Basada en Datos Abiertos:** Interfaz dedicada a la exploración de series de datos públicos nacionales en formatos CSV y GeoJSON.
* **Visualización Geoespacial:** Renderizado automático de datos tabulares georreferenciados mediante mapas de calor o algoritmos de agrupación adaptativa de puntos.
* **Análisis Analítico en Tiempo Real:** Sincronización bidireccional entre el mapa, contadores globales de registros y componentes analíticos:
* **Cuadros de Mando Interactivos:** Incorporación de gráficos estadísticos dinámicos (barras y pastel) impulsados por `Chart.js` y tablas de datos ordenables con scroll optimizado y resaltado de filas.

---

## Estructura del Proyecto

El proyecto está diseñado bajo un estricto principio de modularidad y separación de responsabilidades:

```text
├── .github/workflows/        # Automatización de CI/CD (Despliegues con GitHub Actions)
├── config/                   # Archivos JSON de especificación y parametrización externa
│   ├── aplicacion.json       # Parámetros generales del visor, tokens (Mapillary) y logs
│   ├── capas-operativas.json # Registro de servicios WMS/WFS de la IDE, MTOP e Intendencias
│   ├── direcciones.json      # Configuración del mapa base y mapeo de endpoints de la API de Direcciones
│   ├── mapas-base.json       # Catálogo de proveedores de teselas base (WMTS/XYZ)
│   ├── tableros.json         # Estructura analítica de indicadores, campos CSV, CRS y agrupaciones
│   └── tematicas.json        # Clasificación conceptual y rutas de acceso de los datos abiertos
├── css/                      # Estilos CSS generales y de librerías externas
│   ├── estilos.css           # Hoja de estilos principal (Estructura BEM, Variables CSS y Responsive)
│   └── images/               # Activos visuales e íconos utilizados por Leaflet
├── datos/                    # Repositorio local de capas geográficas y series tabulares (.csv, .geojson)
│   ├── sinae/                # Datos tabulares históricos de incendios forestales
│   └── unasev/               # Histórico anual de personas fallecidas en siniestros de tránsito
├── fuentes/                  # Tipografías corporativas optimizadas cargadas localmente (DM Sans y DM Mono)
├── imagenes/                 # Iconografía del visor en formato vectorial SVG
├── librerias/                # Scripts de dependencias externas inyectadas localmente
│   ├── leaflet.js            # Motor cartográfico base
│   ├── chart.js              # Generación de gráficos estadísticos interactivos
│   ├── papaparse.min.js      # Parser ultrarrápido de archivos CSV de gran tamaño
│   ├── proj4.js              # Transformación y reproyección analítica de sistemas de coordenadas
│   ├── geotiff.js            # Lectura y procesamiento analítico de datos ráster GeoTIFF
│   └── ...                   # Plugins de Leaflet (Heatmap, MarkerCluster, Routing Machine, MiniMap)
├── index.html                # Estructura DOM principal y punto de orquestación de scripts
└── src/                      # Arquitectura lógica de la aplicación
    ├── main.js               # Punto de entrada inicial del ciclo de ejecución
    ├── orquestador.js        # Mediador central; gestiona el estado global y la conmutación de vistas
    ├── presentacion/         # Controladores de la interfaz de bienvenida e inicialización
    ├── vista-cartografia/    # Lógica del mapa general y herramientas de medición, atributos y elevación
    ├── vista-direcciones/    # Integración con la API de Direcciones, geocodificadores y Mapillary
    ├── vista-tableros/       # Controladores de analítica, procesadores de datos CSV y gráficos vinculados
    └── vista-tematicas/      # Vista del explorador y catálogo de temáticas públicas
```

---

## Tecnologías y Librerías Utilizadas

La aplicación se caracteriza por no requerir de herramientas de compilación pesadas ni frameworks complejos, logrando un rendimiento óptimo de carga mediante tecnologías estándar del navegador web:

* **HTML5 & CSS3:** Implementación de variables nativas CSS, metodologías estructuradas de diseño de layouts, aislamiento de scroll y **Responsive Web Design (RWD)** completo con soporte nativo de consultas de medios (`@media`) para un comportamiento impecable en teléfonos móviles y tablets.
* **JavaScript Vanilla (ES6+):** Programación orientada a objetos, uso estricto de módulos (`import/export`), asincronía avanzada (`async/await`, `fetch`) y manipulación eficiente del DOM.
* **Leaflet.js (v1.9):** Biblioteca de referencia para mapas interactivos optimizados para dispositivos móviles.
* **Chart.js:** Renderizado basado en HTML5 Canvas para visualizaciones estadísticas fluidas.
* **PapaParse:** Procesamiento y análisis rápido de cadenas de texto CSV directamente en el lado del cliente.
* **Proj4js:** Gestión precisa de transformaciones de coordenadas para compatibilidad con los sistemas cartográficos oficiales de Uruguay.

---

## Configuración y Personalización

El comportamiento del visor se gestiona centralizadamente desde la carpeta `/config`. A continuación, se detallan los aspectos clave de los principales archivos:

### Configuración General de la Aplicación (`config/aplicacion.json`)

Permite cambiar el nombre institucional, el título de la app, activar el logger de consola para auditorías en desarrollo, configurar el token de Mapillary y definir las muestras del perfil de elevación.

```json
{
    "aplicacion": {
        "institucion": "Infraestructura de Datos Espaciales",
        "titulo": "GeoVisor de Datos Abiertos de Uruguay",
        "logo": "./imagenes/logo-institucion.svg",
        "vista-inicial": "bienvenida",
        "logger": true
    },
    "mapillary": {
        "url-base": "https://graph.mapillary.com",
        "token": "__MAPILLARY_TOKEN__",
        "radio": 50,
        "limite": 10
    },
    "perfil-elevacion": {
        "muestras": 200
    }    
}
```

### Configuración de la API de Direcciones (`config/direcciones.json`)

Asigna las coordenadas del centro geográfico de visualización inicial para el buscador de direcciones y define los parámetros y rutas relativas de los servicios de geocodificación del portal oficial.

```json
{
    "mapaDirecciones": {
        "idMapaBase": "ide_mapa_base",
        "centro": [-32.522, -55.766],
        "zoomInicial": 7,
        "zoomBuscador": 16
    },
    "apiDirecciones": {
        "url-base": "https://direcciones.ide.uy/",
        "servicios": [
            { "idServicio": "candidates", "url-servicio": "api/v1/geocode/candidates" },
            { "idServicio": "reverse", "url-servicio": "/api/v1/geocode/reverse" }
            ...
        ]
    }
}
```

---

## Recursos y fuente de datos

Este GeoVisor integra recursos, capas y servicios de libre acceso provistos por Instituciones públicas del Estado uruguayo:

* **Presidencia de la República** - Infraestructura de Datos Espaciales (IDE Uruguay) - Ortofotografías de alta precisión.
* **Corte Electoral** - Cartografía de Series Electorales Nacionales.
* **Ministerio de Transporte y Obras Públicas (MTOP)** - Red de Caminería Nacional.
* **AGESIC** - Catálogo de Datos Abiertos del Estado Uruguayo.
* **Unidad Nacional de Seguridad Vial (UNASEV)** - Estadísticas e Indicadores de Siniestralidad.
* **Sistema Nacional de Emergencias (SINAE)** - Registro Histórico de Eventos Adversos.
* **Intendencia Departamentales** de Montevideo y del Interior del país - Direcciones Geográficas.
