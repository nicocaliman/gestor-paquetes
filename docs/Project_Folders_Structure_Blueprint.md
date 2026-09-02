# Project Folders Structure Blueprint

Este documento sirve como la guía definitiva de la estructura de carpetas y convenciones organizativas para la aplicación **NC Caliman — Gestor de Paquetes**.

## 1. Visión General de la Estructura

El proyecto está construido como una aplicación web nativa en **JavaScript (Vanilla)** utilizando HTML, CSS integrado, y dependencias administradas mediante CDN y librerías externas (Puppeteer, Marked). 

El principio fundamental es la separación de responsabilidades a nivel de cliente. A pesar de no usar frameworks de frontend pesados, el código fuente (`src/`) implementa una arquitectura modular (MVC extendido / Servicios-Repositorios) para garantizar su mantenibilidad.

## 2. Visualización del Directorio

```text
📦 NC-Caliman-Gestor
 ┣ 📂 .agents/             # [Generado] Skills y personalizaciones de IA
 ┣ 📂 assets/              # Archivos estáticos de la aplicación (imágenes)
 ┣ 📂 docs/                # Documentación del proyecto
 ┃ ┣ 📜 manual_sistema.html
 ┃ ┗ 📜 manual_tecnico.html
 ┣ 📂 src/                 # Código fuente principal
 ┃ ┣ 📂 controllers/       # Lógica de coordinación entre vistas y repositorios
 ┃ ┣ 📂 css/               # Estilos globales y específicos
 ┃ ┃ ┗ 📜 main.css
 ┃ ┣ 📂 models/            # Entidades y tipos de datos de negocio
 ┃ ┣ 📂 repositories/      # Capa de persistencia (Local Storage / Supabase)
 ┃ ┣ 📂 services/          # Lógica de negocio (Búsqueda, Validaciones)
 ┃ ┣ 📂 utils/             # Helpers y funciones utilitarias
 ┃ ┣ 📂 views/             # Componentes de la Interfaz de Usuario
 ┃ ┗ 📜 app.js             # Punto de entrada principal (Composición raíz)
 ┣ 📜 index.html           # Interfaz principal de la aplicación y layout
 ┣ 📜 package.json         # Dependencias (Puppeteer, Marked, etc.)
 ┣ 📜 package-lock.json
 ┗ 📜 Project_Folders_Structure_Blueprint.md # Esta guía
```

## 3. Análisis de Directorios Clave

#### `src/` (Código Fuente Frontend)
La aplicación implementa Inyección de Dependencias manual en `app.js`.

- **`controllers/`**: Orquestadores. Reciben instancias de Repositorios y Vistas. Manejan la navegación, validación y sincronización de datos con la UI.
- **`services/`**: Manejan la lógica empresarial sin estado, por ejemplo:
  - `StorageService.js`: Manejo genérico de almacenamiento en el cliente.
  - `ValidationService.js`: Reglas estrictas sobre códigos de barras y paquetes.
- **`repositories/`**: Acceso estructurado a los datos (usan `StorageService`). Encapsulan el origen de datos.
- **`views/`**: Encargadas de renderizar el HTML dinámico y lanzar eventos que los controladores escuchan (Patrón Observable o Callbacks).

#### Raíz
- **`index.html`**: Dado que no existe servidor de desarrollo, el index se sirve estáticamente desde la raíz para evitar problemas de rutas relativas con el navegador.

## 4. Patrones de Colocación de Archivos

- **Componentes de Interfaz**: Deben crearse como clases dentro de `src/views/` y luego inicializarse en `app.js`.
- **Nuevas Reglas de Negocio**: Deben encapsularse en un nuevo servicio dentro de `src/services/`.
- **Consultas a API/Base de datos**: Añadir repositorios dentro de `src/repositories/`. Nunca realizar peticiones directamente desde los controladores o vistas.
- **Estilos**: Los estilos centrales están embebidos en el tag `<style>` de `index.html` para la carga rápida, y los estilos secundarios pueden ir en `src/css/`.

## 5. Convenciones de Nomenclatura

- **Archivos JavaScript**: Usan **PascalCase** para clases (ej. `DashboardController.js`, `PackageRepository.js`) y **camelCase** para utilidades o el archivo de entrada (`app.js`).
- **Archivos HTML y CSS**: Usan **kebab-case** o **snake_case** según el contexto (ej. `manual_tecnico.html`).

## 6. Flujo de Desarrollo

1. **Nuevo Módulo Visual**:
   - Crear la vista en `src/views/MyNewView.js`.
   - Modificar el HTML y CSS en `index.html` si es un elemento global.
   - Instanciar la vista en `src/app.js` e inyectarla en su controlador respectivo.

2. **Nuevos Datos**:
   - Crear modelo/formato en `src/models/`.
   - Crear repositorio en `src/repositories/`.

*(Generado usando la skill `folder-structure-blueprint-generator`)*
