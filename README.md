# BluegridOCR

Repositorio de entrega del proyecto BluegridOCR.

BluegridOCR es un sistema web para digitalizar planillas acuicolas mediante vision artificial. Permite subir imagenes de tablillas de campo, procesarlas con Claude Vision, extraer una matriz estructurada de datos, corregirla manualmente cuando sea necesario y guardar los registros en PostgreSQL/Supabase para trazabilidad, dashboard operativo y analisis por usuario.

## Estructura del repositorio

```txt
BluegridOCR/
├── Documentacion/
│   ├── Informe/
│   ├── UML/
│   ├── Wireframe/
│   ├── MER/
│   └── Gantt/
│
├── Producto/
│   ├── CodigoFuente/
│   │   ├── Front/
│   │   ├── Deploy/
│   │   ├── run.py
│   │   ├── docker-compose.prod.yml
│   │   └── README_TECNICO.md
│   │
│   ├── Scripts_BD/
│   ├── Librerias/
│   └── Datos_Prueba/
│
└── Gestion/
    ├── Integrantes.txt
    └── README_Gestion.md
```

## Documentacion

Contiene toda la documentacion solicitada para el proyecto:

- Informe.
- Diagramas UML.
- Wireframes.
- MER.
- Carta Gantt.
- Otros recursos usados para gestion, diseno y QA del producto.

## Producto

Contiene los elementos tecnicos del sistema:

- Codigo fuente.
- Backend FastAPI.
- Frontend React + Vite + TypeScript.
- Scripts de base de datos.
- Librerias.
- Datos de prueba.

El codigo fuente principal se encuentra en:

```txt
Producto/CodigoFuente/
```

## Gestion

Contiene documentos administrativos del proyecto:

- Documento de registro de definicion e identificacion del proyecto.
- Archivo con integrantes del equipo.

## Ejecucion del producto

Ingresar a la carpeta del codigo fuente:

```bash
cd Producto/CodigoFuente
```

Instalar dependencias del backend:

```bash
pip install -r Deploy/backend_api/requirements.txt
```

Instalar dependencias del frontend:

```bash
cd Front
npm install
cd ..
```

Ejecutar el sistema:

```bash
python run.py
```

## Tecnologias principales

- Python
- FastAPI
- React
- Vite
- TypeScript
- PostgreSQL / Supabase
- Claude Vision
