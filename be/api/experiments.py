"""
Experiments API Endpoints

Handles experiment CRUD operations for the experiments dashboard.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import datetime

from core.database import get_db
from models.database import Experiment, Dataset, TrainingConfig, TrainingJob
from models.schemas import (
    ExperimentCreate,
    ExperimentUpdate,
    ExperimentResponse,
    ExperimentListItem,
    ExperimentListResponse,
    SaveModelsRequest,
)


router = APIRouter()


@router.post("", response_model=ExperimentResponse)
async def create_experiment(
    experiment_data: ExperimentCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new experiment.

    Called from ConfigureStage when user chooses to save the experiment.

    Returns:
        ExperimentResponse: Created experiment metadata
    """
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.dataset_id == experiment_data.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Validate task_type
    if experiment_data.task_type not in ["classification", "regression", "timeseries"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid task_type. Must be one of: classification, regression, timeseries"
        )

    # Create experiment
    experiment = Experiment(
        name=experiment_data.name,
        description=experiment_data.description,
        dataset_id=experiment_data.dataset_id,
        task_type=experiment_data.task_type,
        target_column=experiment_data.target_column,
        status="in_progress"
    )

    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    return ExperimentResponse.model_validate(experiment)


@router.get("", response_model=ExperimentListResponse)
async def list_experiments(
    status: Optional[str] = Query(None, description="Filter by status: in_progress, completed, archived"),
    task_type: Optional[str] = Query(None, description="Filter by task type: classification, regression, timeseries"),
    search: Optional[str] = Query(None, description="Search by experiment name"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of experiments to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db)
):
    """
    List all experiments with optional filters.

    Used by the experiments dashboard to display experiment cards.

    Returns:
        ExperimentListResponse: List of experiments and total count
    """
    query = db.query(Experiment)

    # Apply filters
    if status:
        query = query.filter(Experiment.status == status)
    if task_type:
        query = query.filter(Experiment.task_type == task_type)
    if search:
        query = query.filter(Experiment.name.ilike(f"%{search}%"))

    # Get total count before pagination
    total = query.count()

    # Order by updated_at descending and apply pagination
    experiments = query.order_by(desc(Experiment.updated_at)).offset(offset).limit(limit).all()

    return ExperimentListResponse(
        experiments=[ExperimentListItem.model_validate(exp) for exp in experiments],
        total=total
    )


@router.get("/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(
    experiment_id: str,
    db: Session = Depends(get_db)
):
    """
    Get a single experiment by ID.

    Returns detailed experiment information including linked records.

    Returns:
        ExperimentResponse: Experiment details
    """
    experiment = db.query(Experiment).filter(Experiment.experiment_id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    return ExperimentResponse.model_validate(experiment)


@router.patch("/{experiment_id}", response_model=ExperimentResponse)
async def update_experiment(
    experiment_id: str,
    update_data: ExperimentUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an experiment.

    Allows updating experiment name, description, status, and linked records.

    Returns:
        ExperimentResponse: Updated experiment
    """
    experiment = db.query(Experiment).filter(Experiment.experiment_id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Update fields that are provided
    update_dict = update_data.model_dump(exclude_unset=True)

    # Validate status if provided
    if "status" in update_dict and update_dict["status"] not in ["in_progress", "completed", "archived"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Must be one of: in_progress, completed, archived"
        )

    # Validate config_id if provided
    if "config_id" in update_dict and update_dict["config_id"]:
        config = db.query(TrainingConfig).filter(
            TrainingConfig.config_id == update_dict["config_id"]
        ).first()
        if not config:
            raise HTTPException(status_code=404, detail="Training config not found")

    # Validate training_job_id if provided
    if "training_job_id" in update_dict and update_dict["training_job_id"]:
        job = db.query(TrainingJob).filter(
            TrainingJob.job_id == update_dict["training_job_id"]
        ).first()
        if not job:
            raise HTTPException(status_code=404, detail="Training job not found")

    for key, value in update_dict.items():
        setattr(experiment, key, value)

    db.commit()
    db.refresh(experiment)

    return ExperimentResponse.model_validate(experiment)


@router.delete("/{experiment_id}")
async def delete_experiment(
    experiment_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete an experiment and associated data.

    Returns:
        dict: Confirmation message
    """
    experiment = db.query(Experiment).filter(Experiment.experiment_id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    db.delete(experiment)
    db.commit()

    return {"message": "Experiment deleted successfully", "experiment_id": experiment_id}


@router.post("/{experiment_id}/complete", response_model=ExperimentResponse)
async def complete_experiment(
    experiment_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark an experiment as completed.

    Sets the status to 'completed' and records the completion timestamp.

    Returns:
        ExperimentResponse: Updated experiment
    """
    experiment = db.query(Experiment).filter(Experiment.experiment_id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    experiment.status = "completed"
    experiment.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(experiment)

    return ExperimentResponse.model_validate(experiment)


@router.get("/{experiment_id}/models")
async def get_experiment_models(
    experiment_id: str,
    db: Session = Depends(get_db)
):
    """
    Get all trained models for this experiment.

    Retrieves model information from the linked training job.

    Returns:
        dict: List of trained models with metrics
    """
    experiment = db.query(Experiment).filter(Experiment.experiment_id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if not experiment.training_job_id:
        return {"models": [], "message": "No training job linked to this experiment"}

    job = db.query(TrainingJob).filter(TrainingJob.job_id == experiment.training_job_id).first()
    if not job:
        return {"models": [], "message": "Training job not found"}

    # Extract models from training job results
    models = []
    if job.results and "all_models" in job.results:
        models = job.results["all_models"]
    elif job.results and "leaderboard" in job.results:
        models = job.results["leaderboard"]

    return {
        "experiment_id": experiment_id,
        "training_job_id": experiment.training_job_id,
        "models": models,
        "total": len(models)
    }


@router.post("/{experiment_id}/save-models")
async def save_models_for_benchmarking(
    experiment_id: str,
    request: SaveModelsRequest,
    db: Session = Depends(get_db)
):
    """
    Save selected models for benchmarking.

    Updates the experiment with the count of saved models.

    Returns:
        dict: Confirmation with saved model count
    """
    experiment = db.query(Experiment).filter(Experiment.experiment_id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Update count of models saved for benchmarking
    experiment.models_saved_for_benchmarking = len(request.model_names)

    db.commit()
    db.refresh(experiment)

    return {
        "experiment_id": experiment_id,
        "models_saved": len(request.model_names),
        "model_names": request.model_names,
        "message": f"Successfully saved {len(request.model_names)} models for benchmarking"
    }
