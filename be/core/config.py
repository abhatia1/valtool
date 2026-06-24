"""
Application Configuration

Manages environment variables and application settings using Pydantic.
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "Valtool AutoML"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # API
    API_V1_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite:///./valtool.db"

    # Storage paths
    BASE_STORAGE_PATH: str = "./storage"
    DATASETS_PATH: str = "./storage/datasets"
    MODELS_PATH: str = "./storage/models"
    ARTIFACTS_PATH: str = "./storage/artifacts"
    MLRUNS_PATH: str = "./storage/mlruns"
    EXTERNAL_MODELS_PATH: str = "./storage/external_models"
    BENCHMARKS_PATH: str = "./storage/benchmarks"

    # File upload settings
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB in bytes
    ALLOWED_EXTENSIONS: List[str] = [".csv"]

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]

    # MLflow
    MLFLOW_TRACKING_URI: str = "http://localhost:5000"
    MLFLOW_ENABLED: bool = False

    # Training
    DEFAULT_CV_FOLDS: int = 5
    DEFAULT_N_JOBS: int = -1  # Use all CPU cores
    TRAINING_TIMEOUT: int = 3600  # 1 hour in seconds

    # Monitoring
    DRIFT_THRESHOLD: float = 0.05

    # Benchmarking - Container settings
    DEFAULT_CONTAINER_CPU_LIMIT: str = "1.0"  # CPU cores
    DEFAULT_CONTAINER_MEMORY_LIMIT: str = "2g"  # Memory limit
    DEFAULT_CONTAINER_TIMEOUT: int = 300  # 5 minutes for predictions
    DEFAULT_IDLE_TIMEOUT: int = 600  # 10 minutes idle before auto-stop
    CONTAINER_PORT_RANGE_START: int = 9000
    CONTAINER_PORT_RANGE_END: int = 9100

    # Benchmarking - Security settings
    MAX_CRITICAL_VULNERABILITIES: int = 0  # No critical vulns allowed
    MAX_HIGH_VULNERABILITIES: int = 3  # Max 3 high severity vulns

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Initialize settings
settings = Settings()


# Create storage directories if they don't exist
def init_storage():
    """Create necessary storage directories"""
    os.makedirs(settings.DATASETS_PATH, exist_ok=True)
    os.makedirs(settings.MODELS_PATH, exist_ok=True)
    os.makedirs(settings.ARTIFACTS_PATH, exist_ok=True)
    os.makedirs(settings.MLRUNS_PATH, exist_ok=True)


# Initialize storage on import
init_storage()
