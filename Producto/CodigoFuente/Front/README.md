# Bluegrid OCR Manager

Sistema de gestion y dashboard para la digitalizacion de planillas de acuicultura mediante OCR.

## Caracteristicas

*   **Dashboard Gerencial**: visualizacion de KPIs, graficos de capturas y mapa interactivo de zonas.
*   **Modulo de Digitalizacion**: subida de imagenes, procesamiento OCR y validacion de matrices.
*   **Editor de Matriz**: interfaz tipo Excel para corregir datos con validacion visual.
*   **Mapa Interactivo**: integracion con OpenStreetMap y Leaflet.

## Prerrequisitos

*   Node.js 18 o superior.
*   Backend BluegridOCR activo.

## Instalacion

```bash
npm install
```

## Ejecucion

Para iniciar el servidor de desarrollo local:

```bash
npm run dev
```

La aplicacion queda disponible usualmente en `http://localhost:5173`.

## Testing con Jasmine y Karma

El frontend incluye una suite de unit tests en navegador con Jasmine + Karma.
Las pruebas cubren las funciones compartidas de autenticacion del cliente y la matriz de permisos del sistema.

Comandos disponibles:

```bash
npm run test:karma
npm test
```

Para modo observador durante desarrollo:

```bash
npm run test:karma:watch
```

El testing esta separado del codigo de aplicacion en `testing/`:

```txt
testing/
  karma.conf.cjs
  specs/
    apiClient.spec.ts
    types.spec.ts
```

La configuracion vive en `testing/karma.conf.cjs`. En Windows, si Chrome no esta instalado,
Karma usa Microsoft Edge Headless como binario compatible.

Cobertura actual:

*   `services/apiClient.ts`: lectura y limpieza del token, headers `Authorization` y `ngrok-skip-browser-warning`.
*   `types.ts`: permisos por rol (`admin`, `supervisor`, `buzo`), zonas iniciales y contrato inicial del dashboard (`context`, `summary`, `kpis`, `barData`, `lineData`, `mapData`).

Ejecucion validada:

```txt
TOTAL: 21 SUCCESS
```

## Configuracion Inicial

El frontend usa `VITE_API_BASE_URL` cuando existe. Si no se define, usa `http://localhost:8000`.

Ejemplo de `Front/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_MOCK_DATA=false
```

## Estructura del Proyecto

*   `index.html`: punto de entrada principal.
*   `App.tsx`: componente raiz y enrutamiento.
*   `components/`: componentes modulares.
*   `services/apiClient.ts`: cliente HTTP autenticado.
*   `types.ts`: definiciones TypeScript y datos iniciales.
