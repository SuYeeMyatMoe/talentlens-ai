from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.config import settings
from app.database import init_db
from app.routers.auth import router as auth_router
from app.routers.jobs import router as jobs_router
from app.routers.applications import router as applications_router
from app.routers.ai_analysis import router as ai_analysis_router
from app.routers.notifications import router as notifications_router
from app.routers.interviews import router as interviews_router

app = FastAPI(
    title="TalentLens AI",
    description="AI-powered hiring platform with blockchain verification",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — explicit direct imports prevent any __init__.py resolution issues
app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(ai_analysis_router)
app.include_router(notifications_router)
app.include_router(interviews_router)

# Serve uploaded files
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/")
async def root():
    return {"message": "TalentLens AI API", "version": "1.0.0", "status": "operational"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
