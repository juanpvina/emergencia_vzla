import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando Emergencia Venezuela API v2.0 (Firestore)...")
    logger.info("Firestore se inicializará en la primera petición")
    yield
    logger.info("Apagando aplicación...")


app = FastAPI(
    title="Emergencia Venezuela - Pacientes API",
    description=(
        "API para centralizar listados hospitalarios durante emergencias. "
        "Permite subir imágenes de listados, extraer datos con VLM (Gemini), "
        "cargar archivos Excel, buscar pacientes y verificar información comunitariamente."
    ),
    version="0.2.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import admin, busqueda, extraccion, pacientes, verificaciones

app.include_router(pacientes.router)
app.include_router(extraccion.router)
app.include_router(busqueda.router)
app.include_router(verificaciones.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {
        "app": "Emergencia Venezuela - Pacientes API",
        "version": "0.2.0",
        "docs": "/docs",
        "database": "Firestore",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "database": "firestore"}
