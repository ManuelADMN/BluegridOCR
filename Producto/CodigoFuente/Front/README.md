# Bluegrid OCR Manager

Sistema de gestión y dashboard para la digitalización de planillas de acuicultura mediante OCR. Esta aplicación conecta con un backend en Google Colab expuesto vía Ngrok.

## Características

*   **Dashboard Gerencial**: Visualización de KPIs, gráficos de capturas y mapa interactivo de zonas.
*   **Módulo de Digitalización**: Subida de imágenes, procesamiento OCR y validación de matrices.
*   **Editor de Matriz**: Interfaz tipo Excel para corregir datos con validación visual.
*   **Mapa Interactivo**: Integración con OpenStreetMap y Leaflet.

## Prerrequisitos

*   [Node.js](https://nodejs.org/) (Versión 16 o superior)
*   Una URL activa de Ngrok apuntando al backend de Colab (para la funcionalidad de OCR).

## Instalación

1.  Asegúrate de que todos los archivos del proyecto estén en una carpeta.
2.  Abre tu terminal (Command Prompt / Terminal) en esa carpeta.
3.  Instala las dependencias ejecutando:

```bash
npm install
```

## Ejecución

Para iniciar el servidor de desarrollo local:

```bash
npm run dev
```

Esto abrirá la aplicación en tu navegador (usualmente en `http://localhost:5173`).

## Configuración Inicial

1.  Al abrir la app, verás un modal de configuración.
2.  Ingresa la **URL pública de Ngrok** proporcionada por el backend (ej: `https://xxxx-xx-xx.ngrok-free.app`).
3.  Haz clic en **Probar Conexión**. Si el backend está corriendo, verás un mensaje de éxito.
4.  Guarda la configuración para acceder al Dashboard.

## Estructura del Proyecto

*   `index.html`: Punto de entrada principal.
*   `App.tsx`: Componente raíz y enrutamiento.
*   `components/`: Componentes modulares (Dashboard, Matriz, Configuración).
*   `types.ts`: Definiciones de tipos TypeScript y Mock Data.
