from fastapi import APIRouter
from app.api.v1.endpoints import health, projects, scripts, voices, visuals, videos

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(scripts.router, prefix="/projects", tags=["Scripts"])
api_router.include_router(voices.router, prefix="/projects", tags=["Voice Agent"])
api_router.include_router(visuals.router, prefix="/projects", tags=["Visual Asset Engine"])
api_router.include_router(videos.router, prefix="/projects", tags=["Video Rendering Engine"])
