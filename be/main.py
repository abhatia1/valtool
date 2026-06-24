"""
Valtool Backend - FastAPI Application

Main application entry point for the AutoML platform.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from core.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Handles startup and shutdown events.
    """
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown: Cleanup if needed


# Initialize FastAPI app
app = FastAPI(
    title="Valtool AutoML API",
    description="Production-grade MLOps backend for automated machine learning",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint - API health check"""
    return {
        "message": "Valtool AutoML API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected"
    }


# Import and include routers
from api import upload, eda, configuration, training, testing, monitoring, mlflow, benchmarking, experiments
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(eda.router, prefix="/api/eda", tags=["eda"])
app.include_router(configuration.router, prefix="/api/config", tags=["configuration"])
app.include_router(training.router, prefix="/api/training", tags=["training"])
app.include_router(testing.router, prefix="/api/testing", tags=["testing"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["monitoring"])
app.include_router(mlflow.router)  # MLflow router has its own prefix
app.include_router(benchmarking.router, prefix="/api/benchmarking", tags=["benchmarking"])
app.include_router(experiments.router, prefix="/api/experiments", tags=["experiments"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
