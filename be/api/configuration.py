"""
Configuration API Endpoints

Endpoints for managing AutoML training configurations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from services.config_manager import ConfigManager
from models.database import Dataset, TrainingConfig
from models.schemas import (
    ConfigTemplatesResponse,
    EstimatorsResponse,
    TrainingConfigCreate,
    TrainingConfigResponse,
    ValidatePreprocessingRequest,
    ValidationResponse
)
import pandas as pd
import uuid


router = APIRouter()
config_manager = ConfigManager()


@router.get("/templates", response_model=ConfigTemplatesResponse)
async def get_templates():
    """
    Get all configuration templates

    Returns predefined configuration templates (Quick Start, Standard, Deep Search)
    that can be used as starting points for training configuration.
    """
    templates = config_manager.get_templates()
    return ConfigTemplatesResponse(templates=templates)


@router.get("/estimators/{task_type}", response_model=EstimatorsResponse)
async def get_estimators(task_type: str):
    """
    Get available estimators for a task type

    Args:
        task_type: The ML task type (classification, regression, timeseries)

    Returns:
        List of available estimators with their parameters and tunable ranges
    """
    if task_type not in ["classification", "regression", "timeseries"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task type. Choose from: classification, regression, timeseries"
        )

    estimators = config_manager.get_estimators_for_task(task_type)
    return EstimatorsResponse(task_type=task_type, estimators=estimators)


@router.get("/metrics/{task_type}")
async def get_valid_metrics(task_type: str):
    """
    Get valid scoring metrics for a task type
    
    Args:
        task_type: The ML task type (classification, regression)
    
    Returns:
        List of valid scoring metrics with descriptions
    """
    if task_type == "classification":
        from services.automl_classification import VALID_CLASSIFICATION_METRICS, DEFAULT_CLASSIFICATION_METRIC
        return {
            "task_type": task_type,
            "default_metric": DEFAULT_CLASSIFICATION_METRIC,
            "metrics": VALID_CLASSIFICATION_METRICS
        }
    elif task_type == "regression":
        from services.automl_regression import VALID_REGRESSION_METRICS, DEFAULT_REGRESSION_METRIC
        return {
            "task_type": task_type,
            "default_metric": DEFAULT_REGRESSION_METRIC,
            "metrics": VALID_REGRESSION_METRICS
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task type. Choose from: classification, regression"
        )


@router.post("/create", response_model=TrainingConfigResponse)
async def create_config(
    request: TrainingConfigCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new training configuration

    Validates the configuration against the dataset and saves it to the database.
    Returns validation warnings and estimated training time.

    Args:
        request: Training configuration creation request
        db: Database session

    Returns:
        Created configuration with validation results
    """

    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.dataset_id == request.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Load data for validation
    try:
        df = pd.read_csv(dataset.file_path)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load dataset: {str(e)}"
        )

    # Convert request to dict for validation
    config_dict = {
        "target_column": request.target_column,
        "task_type": request.task_type,
        "preprocessing": request.preprocessing.model_dump(),
        "feature_engineering": request.feature_engineering.model_dump(),
        "model_selection": request.model_selection.model_dump(),
        "hyperparameter_tuning": request.hyperparameter_tuning.model_dump(),
        "mlflow": request.mlflow.model_dump()
    }

    # Validate configuration
    is_valid, errors, warnings = config_manager.validate_config(config_dict, df)

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Configuration validation failed",
                "errors": errors,
                "warnings": warnings
            }
        )

    # Estimate training time
    estimated_time = config_manager.estimate_training_time(
        config_dict,
        dataset.rows,
        dataset.columns
    )

    # Save configuration
    config_id = str(uuid.uuid4())
    training_config = TrainingConfig(
        config_id=config_id,
        dataset_id=request.dataset_id,
        target_column=request.target_column,
        task_type=request.task_type,
        preprocessing=request.preprocessing.model_dump(),
        feature_engineering=request.feature_engineering.model_dump(),
        model_selection=request.model_selection.model_dump(),
        hyperparameter_tuning=request.hyperparameter_tuning.model_dump(),
        mlflow_config=request.mlflow.model_dump(),
        validated=True,
        warnings=warnings,
        estimated_training_time=estimated_time
    )

    db.add(training_config)
    db.commit()
    db.refresh(training_config)

    return TrainingConfigResponse(
        config_id=training_config.config_id,
        dataset_id=training_config.dataset_id,
        task_type=training_config.task_type,
        validated=training_config.validated,
        warnings=training_config.warnings or [],
        estimated_training_time=training_config.estimated_training_time,
        created_at=training_config.created_at
    )


@router.post("/validate-preprocessing", response_model=ValidationResponse)
async def validate_preprocessing(
    request: ValidatePreprocessingRequest,
    db: Session = Depends(get_db)
):
    """
    Validate preprocessing configuration

    Checks if the preprocessing configuration is valid for the given dataset
    and provides suggestions for improvement.

    Args:
        request: Preprocessing validation request
        db: Database session

    Returns:
        Validation results with errors, warnings, and suggestions
    """

    dataset = db.query(Dataset).filter(Dataset.dataset_id == request.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = pd.read_csv(dataset.file_path)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load dataset: {str(e)}"
        )

    is_valid, errors, warnings, suggestions = config_manager.validate_preprocessing(
        request.preprocessing.model_dump(),
        df
    )

    return ValidationResponse(
        valid=is_valid,
        errors=errors,
        warnings=warnings,
        suggestions=suggestions
    )


@router.get("/config/{config_id}", response_model=TrainingConfigResponse)
async def get_config(config_id: str, db: Session = Depends(get_db)):
    """
    Get a training configuration by ID

    Args:
        config_id: Configuration ID
        db: Database session

    Returns:
        Training configuration details
    """
    config = db.query(TrainingConfig).filter(TrainingConfig.config_id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return TrainingConfigResponse(
        config_id=config.config_id,
        dataset_id=config.dataset_id,
        task_type=config.task_type,
        validated=config.validated,
        warnings=config.warnings or [],
        estimated_training_time=config.estimated_training_time,
        created_at=config.created_at
    )


@router.delete("/config/{config_id}")
async def delete_config(config_id: str, db: Session = Depends(get_db)):
    """
    Delete a training configuration

    Args:
        config_id: Configuration ID
        db: Database session

    Returns:
        Deletion confirmation
    """
    config = db.query(TrainingConfig).filter(TrainingConfig.config_id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    db.delete(config)
    db.commit()

    return {
        "message": "Configuration deleted successfully",
        "deleted_config_id": config_id
    }
