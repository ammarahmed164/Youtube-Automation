from fastapi import APIRouter
from app.api.v1.endpoints import health, projects, scripts

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(scripts.router, prefix="/projects", tags=["Scripts"])
