"""
Training API Endpoints

Endpoints for managing AutoML training jobs.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from core.database import get_db
from core.config import settings
from services.automl_classification import ClassificationTrainer
from services.automl_regression import RegressionTrainer
from services.automl_timeseries import TimeSeriesTrainer
from models.database import TrainingConfig, TrainingJob, Dataset
from models.schemas import (
    TrainingStartRequest,
    TrainingStartResponse,
    TrainingStatusResponse,
    TrainingResultsResponse,
    TrainingProgress,
    BestModelInfo,
    ModelComparisonItem
)
from datetime import datetime, timedelta
import json
from typing import Dict, Any, Optional
from fastapi import Query
import traceback


def _extract_clean_metrics(metrics: Dict[str, float]) -> Dict[str, float]:
    """
    Extract clean metric names from prefixed metrics.
    Converts 'val_accuracy' -> 'accuracy', 'train_accuracy' -> removed
    """
    clean_metrics = {}
    for key, value in metrics.items():
        if key.startswith('val_'):
            # Remove 'val_' prefix
            clean_key = key[4:]
            clean_metrics[clean_key] = value
        elif not key.startswith('train_'):
            # Keep metrics without prefix
            clean_metrics[key] = value
    return clean_metrics


def _get_model_predictions(job_results: Dict, estimator_name: str = None) -> Dict:
    """
    Get predictions for a specific model or the best model.

    Args:
        job_results: The job.results dictionary
        estimator_name: Optional model name. If None, returns best model predictions.

    Returns:
        Predictions dict with y_true, y_pred, y_pred_proba, class_names

    Raises:
        HTTPException: If model not found or predictions not available
    """
    if estimator_name is None:
        # Return best model predictions (backward compatible)
        predictions = job_results.get('predictions')
        if not predictions:
            raise HTTPException(
                status_code=404,
                detail="Predictions not available. This may be an older training job."
            )
        return predictions

    # Find predictions for specific model
    all_models = job_results.get('all_models', [])
    for model in all_models:
        if model.get('estimator_name') == estimator_name:
            predictions = model.get('predictions')
            if not predictions:
                raise HTTPException(
                    status_code=404,
                    detail=f"Predictions not available for model '{estimator_name}'"
                )
            return predictions

    raise HTTPException(
        status_code=404,
        detail=f"Model '{estimator_name}' not found in training results"
    )


router = APIRouter()


def run_training_job(
    job_id: str,
    config_id: str,
    dataset_path: str,
    target_column: str,
    task_type: str,
    config_dict: Dict[str, Any]
):
    """
    Background task to run training job.

    This function runs in the background and updates the job status
    in the database as training progresses.
    """
    from core.database import SessionLocal
    db = SessionLocal()

    try:
        # Update job status to running
        job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()
        if not job:
            return

        job.status = "running"
        job.started_at = datetime.utcnow()
        job.progress = {
            "current_model": "Initializing",
            "models_completed": 0,
            "total_models": len(config_dict.get('model_selection', {}).get('estimators', [])),
            "percent_complete": 0,
            "elapsed_time": 0,
            "eta": 0
        }
        db.commit()

        # Initialize trainer based on task type
        if task_type == 'regression':
            trainer = RegressionTrainer(
                config=config_dict,
                dataset_path=dataset_path,
                target_column=target_column,
                output_dir=settings.MODELS_PATH
            )
        elif task_type == 'timeseries':
            trainer = TimeSeriesTrainer(
                config=config_dict,
                dataset_path=dataset_path,
                target_column=target_column,
                date_column=config_dict.get('date_column'),
                output_dir=settings.MODELS_PATH
            )
        else:  # classification (default)
            trainer = ClassificationTrainer(
                config=config_dict,
                dataset_path=dataset_path,
                target_column=target_column,
                output_dir=settings.MODELS_PATH
            )

        # Execute training pipeline
        trainer.load_data()

        job.progress["current_model"] = "Preprocessing data"
        db.commit()
        trainer.preprocess_data()

        job.progress["current_model"] = "Engineering features"
        db.commit()
        trainer.engineer_features()

        job.progress["current_model"] = "Training models"
        db.commit()
        trainer.train_models()

        job.progress["current_model"] = "Evaluating best model"
        db.commit()
        
        # NEW: Evaluate best model on test set to get predictions
        test_results = trainer.evaluate_best_model()

        job.progress["current_model"] = "Saving model"
        db.commit()
        model_path = trainer.save_model(job_id)

        # Get training results (contains train/val metrics only)
        final_results = trainer.get_results_summary()
        
        # NEW: Merge test results (includes predictions) into final results
        if test_results:
            final_results['predictions'] = test_results.get('predictions')
            final_results['test_metrics'] = test_results.get('test_metrics')
            if 'feature_importance' in test_results and test_results['feature_importance']:
                final_results['feature_importance'] = test_results['feature_importance']
            if 'confusion_matrix' in test_results:
                final_results['confusion_matrix'] = test_results['confusion_matrix']
            if 'classification_report' in test_results:
                final_results['classification_report'] = test_results['classification_report']

        # Update job with results
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.results = final_results
        job.best_model_path = model_path
        job.mlflow_run_id = trainer.mlflow_run_id
        job.progress = {
            "current_model": "Completed",
            "models_completed": len(config_dict.get('model_selection', {}).get('estimators', [])),
            "total_models": len(config_dict.get('model_selection', {}).get('estimators', [])),
            "percent_complete": 100,
            "elapsed_time": int((datetime.utcnow() - job.started_at).total_seconds()),
            "eta": 0
        }

        # Cleanup
        trainer.cleanup()

        db.commit()

    except Exception as e:
        # Update job status to failed
        job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()
        if job:
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.results = {
                "error": str(e),
                "traceback": traceback.format_exc()
            }
            db.commit()

    finally:
        db.close()


@router.post("/start", response_model=TrainingStartResponse)
async def start_training(
    request: TrainingStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start a new training job

    Creates a training job and starts training in the background.
    The job will process the dataset using the provided configuration.

    Args:
        request: Training start request with config_id
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Training job information with job_id for tracking progress
    """

    # Get configuration
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == request.config_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    # Get dataset
    dataset = db.query(Dataset).filter(
        Dataset.dataset_id == config.dataset_id
    ).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Create training job
    job_name = request.job_name or f"Training_{config.task_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    training_job = TrainingJob(
        config_id=request.config_id,
        job_name=job_name,
        status="queued",
        progress={
            "current_model": "Queued",
            "models_completed": 0,
            "total_models": len(config.model_selection.get('estimators', [])),
            "percent_complete": 0,
            "elapsed_time": 0,
            "eta": config.estimated_training_time or 0
        }
    )

    db.add(training_job)
    db.commit()
    db.refresh(training_job)

    # Prepare configuration dictionary with auto-generated MLflow experiment name if needed
    mlflow_config = dict(config.mlflow_config) if config.mlflow_config else {}

    # Auto-generate experiment name if not provided
    if mlflow_config.get('enabled', True) and not mlflow_config.get('experiment_name'):
        # Generate meaningful experiment name: dataset_tasktype_timestamp
        dataset_name = dataset.name.replace(' ', '_').replace('.', '_')[:50]  # Limit length
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        mlflow_config['experiment_name'] = f"{dataset_name}_{config.task_type}_{timestamp}"

    config_dict = {
        'preprocessing': config.preprocessing,
        'feature_engineering': config.feature_engineering,
        'model_selection': config.model_selection,
        'hyperparameter_tuning': config.hyperparameter_tuning,
        'mlflow': mlflow_config
    }

    # Start training in background
    background_tasks.add_task(
        run_training_job,
        job_id=training_job.job_id,
        config_id=config.config_id,
        dataset_path=dataset.file_path,
        target_column=config.target_column,
        task_type=config.task_type,
        config_dict=config_dict
    )

    # Calculate estimated completion time
    estimated_completion = None
    if config.estimated_training_time:
        estimated_completion = datetime.utcnow() + timedelta(seconds=config.estimated_training_time)

    return TrainingStartResponse(
        job_id=training_job.job_id,
        job_name=training_job.job_name,
        status=training_job.status,
        started_at=datetime.utcnow(),
        estimated_completion=estimated_completion
    )


@router.get("/job/{job_id}/status", response_model=TrainingStatusResponse)
async def get_training_status(job_id: str, db: Session = Depends(get_db)):
    """
    Get training job status

    Returns the current status and progress of a training job.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        Current job status with progress information
    """

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    # Build progress object
    progress_data = job.progress or {}
    progress = TrainingProgress(
        current_model=progress_data.get('current_model', 'Unknown'),
        models_completed=progress_data.get('models_completed', 0),
        total_models=progress_data.get('total_models', 0),
        percent_complete=progress_data.get('percent_complete', 0.0),
        elapsed_time=progress_data.get('elapsed_time', 0),
        eta=progress_data.get('eta', 0)
    )

    # Determine current step
    current_step = "Unknown"
    if job.status == "queued":
        current_step = "Waiting to start"
    elif job.status == "running":
        current_step = progress_data.get('current_model', 'Training in progress')
    elif job.status == "completed":
        current_step = "Training completed successfully"
    elif job.status == "failed":
        current_step = "Training failed"

    # Generate logs
    logs = []
    if job.started_at:
        logs.append(f"Training started at {job.started_at.isoformat()}")
    if job.status == "running":
        logs.append(f"Currently: {progress.current_model}")
        logs.append(f"Progress: {progress.models_completed}/{progress.total_models} models")
    if job.status == "completed":
        logs.append(f"Training completed at {job.completed_at.isoformat()}")
    if job.status == "failed" and job.results:
        error = job.results.get('error', 'Unknown error')
        logs.append(f"Error: {error}")

    return TrainingStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=progress,
        current_step=current_step,
        logs=logs
    )


@router.get("/job/{job_id}/results", response_model=TrainingResultsResponse)
async def get_training_results(job_id: str, db: Session = Depends(get_db)):
    """
    Get training job results

    Returns comprehensive training results including best model info,
    all model comparisons, feature importance, and evaluation metrics.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        Complete training results with model performance metrics

    Raises:
        HTTPException: If job not found or not completed
    """

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    if not job.results:
        raise HTTPException(status_code=500, detail="Training results not available")

    # Get config for task type
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == job.config_id
    ).first()

    # Parse results
    results = job.results
    best_model_data = results.get('best_model', {})

    # Extract metrics from best_model_data
    all_metrics = best_model_data.get('metrics', {})

    # Separate into train, val, and test metrics
    train_metrics = {k[6:]: v for k, v in all_metrics.items() if k.startswith('train_')}
    val_metrics = {k[4:]: v for k, v in all_metrics.items() if k.startswith('val_')}
    test_metrics = results.get('test_metrics', {})

    # Use test metrics for primary display, fallback to val metrics
    display_metrics = test_metrics if test_metrics else val_metrics

    # Build best model info
    best_model = BestModelInfo(
        estimator_name=best_model_data.get('estimator_name', 'Unknown'),
        estimator_id=best_model_data.get('estimator_id', 'Unknown'),
        metrics=display_metrics,  # Test metrics for display
        train_metrics=train_metrics if train_metrics else None,
        val_metrics=val_metrics if val_metrics else None,
        hyperparameters=best_model_data.get('hyperparameters', {}),
        validation_score=best_model_data.get('validation_score', 0.0),
        validation_strategy=best_model_data.get('validation_strategy', 'cross_validation'),
        validation_std=best_model_data.get('validation_std'),
        train_score=best_model_data.get('train_score'),
        training_time=best_model_data.get('training_time')
    )

    # Build model comparison list with clean metrics
    all_models = [
        ModelComparisonItem(
            estimator_name=model.get('estimator_name', 'Unknown'),
            metrics=_extract_clean_metrics(model.get('metrics', {})),  # Clean up metric names
            validation_score=model.get('validation_score', 0.0),
            validation_std=model.get('validation_std', 0.0),
            training_time=model.get('training_time', 0.0),
            validation_strategy=model.get('validation_strategy', 'cross_validation')
        )
        for model in results.get('all_models', [])
    ]

    # Build training summary
    training_summary = {
        'total_models_trained': len(all_models),
        'best_validation_score': best_model_data.get('validation_score', 0.0),
        'training_duration': int((job.completed_at - job.started_at).total_seconds()) if job.started_at and job.completed_at else 0,
        'test_metrics': results.get('test_metrics', {}),
        'confusion_matrix': results.get('confusion_matrix', []),
        'classification_report': results.get('classification_report', {})
    }

    return TrainingResultsResponse(
        job_id=job.job_id,
        job_name=job.job_name,
        task_type=config.task_type if config else 'classification',
        status=job.status,
        best_model=best_model,
        all_models=all_models,
        feature_importance=results.get('feature_importance', {}),
        training_summary=training_summary,
        mlflow_run_id=job.mlflow_run_id,
        completed_at=job.completed_at
    )


@router.get("/job/{job_id}/comparison")
async def get_model_comparison(job_id: str, db: Session = Depends(get_db)):
    """
    Get detailed model comparison

    Returns a detailed comparison of all trained models with metrics,
    sorted by performance.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        Detailed model comparison data
    """

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    if not job.results:
        raise HTTPException(status_code=500, detail="Training results not available")

    # Get all models and sort by primary metric
    all_models = job.results.get('all_models', [])

    # Get config to determine task type
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == job.config_id
    ).first()

    # Sort by appropriate metric based on task type
    def get_sort_metric(model):
        metrics = model.get('metrics', {})
        if config and config.task_type == 'regression':
            # For regression, higher R² is better (negate MSE/RMSE to reverse sort)
            return metrics.get('r2_score', 0)
        else:
            # For classification, use accuracy or F1
            return metrics.get('accuracy', metrics.get('f1_weighted', 0))

    sorted_models = sorted(all_models, key=get_sort_metric, reverse=True)

    comparison_metric = 'r2_score' if config and config.task_type == 'regression' else 'accuracy'

    return {
        'job_id': job_id,
        'models': sorted_models,
        'best_model': job.results.get('best_model', {}),
        'comparison_metric': comparison_metric
    }


@router.post("/job/{job_id}/cancel")
async def cancel_training_job(job_id: str, db: Session = Depends(get_db)):
    """
    Cancel a training job

    Attempts to cancel a queued or running training job.
    Note: Cancellation may not be immediate for running jobs.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        Cancellation confirmation
    """

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status in ["completed", "failed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job.status}"
        )

    # Update status
    job.status = "cancelled"
    job.completed_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Training job cancelled",
        "job_id": job_id,
        "status": "cancelled"
    }


@router.get("/jobs")
async def list_training_jobs(
    status: str = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    List training jobs

    Returns a list of training jobs with optional filtering by status.

    Args:
        status: Optional filter by job status (queued, running, completed, failed)
        limit: Maximum number of jobs to return (default: 50)
        offset: Number of jobs to skip (default: 0)
        db: Database session

    Returns:
        List of training jobs
    """

    query = db.query(TrainingJob)

    if status:
        query = query.filter(TrainingJob.status == status)

    # Order by created date (most recent first)
    query = query.order_by(TrainingJob.started_at.desc())

    # Apply pagination
    jobs = query.offset(offset).limit(limit).all()

    return {
        'jobs': [
            {
                'job_id': job.job_id,
                'job_name': job.job_name,
                'status': job.status,
                'started_at': job.started_at,
                'completed_at': job.completed_at,
                'config_id': job.config_id
            }
            for job in jobs
        ],
        'total': query.count(),
        'limit': limit,
        'offset': offset
    }


@router.delete("/job/{job_id}")
async def delete_training_job(job_id: str, db: Session = Depends(get_db)):
    """
    Delete a training job

    Deletes a training job and its associated results.
    Note: This does not delete the saved model files.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        Deletion confirmation
    """

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status == "running":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a running job. Cancel it first."
        )

    db.delete(job)
    db.commit()

    return {
        "message": "Training job deleted successfully",
        "deleted_job_id": job_id
    }


# ============================================================================
# VISUALIZATION ENDPOINTS
# ============================================================================

@router.get("/job/{job_id}/visualizations/confusion-matrix")
async def get_confusion_matrix(
    job_id: str,
    estimator_name: Optional[str] = Query(None, description="Model name. If not provided, uses best model."),
    db: Session = Depends(get_db)
):
    """
    Get confusion matrix visualization for classification job.

    Args:
        job_id: Training job ID
        estimator_name: Optional model name. If not provided, uses best model.

    Returns:
        Plotly JSON for confusion matrix heatmap

    Raises:
        HTTPException: If job not found, not completed, or not classification
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    if not job.results:
        raise HTTPException(status_code=500, detail="Training results not available")

    # Get config for task type
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == job.config_id
    ).first()

    if not config or config.task_type != "classification":
        raise HTTPException(
            status_code=400,
            detail="Confusion matrix only available for classification tasks"
        )

    # Get predictions for specified model or best model
    predictions = _get_model_predictions(job.results, estimator_name)

    # Generate visualization
    plotly_json = visualization_generator.generate_confusion_matrix(
        y_true=predictions['y_true'],
        y_pred=predictions['y_pred'],
        class_names=predictions['class_names']
    )

    model_label = estimator_name or "Best Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "confusion_matrix",
        "title": f"Confusion Matrix - {model_label}"
    }


@router.get("/job/{job_id}/visualizations/roc-curves")
async def get_roc_curves(
    job_id: str,
    estimator_name: Optional[str] = Query(None, description="Model name. If not provided, uses best model."),
    db: Session = Depends(get_db)
):
    """
    Get ROC curves visualization for classification job.

    Args:
        job_id: Training job ID
        estimator_name: Optional model name. If not provided, uses best model.

    Returns:
        Plotly JSON for ROC curves

    Raises:
        HTTPException: If job not found, not completed, or predictions unavailable
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    # Get predictions for specified model or best model
    predictions = _get_model_predictions(job.results, estimator_name)

    if not predictions.get('y_pred_proba'):
        raise HTTPException(
            status_code=404,
            detail="Probability predictions not available for ROC curves"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_roc_curves(
        y_true=predictions['y_true'],
        y_pred_proba=predictions['y_pred_proba'],
        class_names=predictions['class_names']
    )

    model_label = estimator_name or "Best Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "roc_curves",
        "title": f"ROC Curves - {model_label}"
    }


@router.get("/job/{job_id}/visualizations/pr-curves")
async def get_pr_curves(
    job_id: str,
    estimator_name: Optional[str] = Query(None, description="Model name. If not provided, uses best model."),
    db: Session = Depends(get_db)
):
    """
    Get Precision-Recall curves visualization for classification job.

    Args:
        job_id: Training job ID
        estimator_name: Optional model name. If not provided, uses best model.

    Returns:
        Plotly JSON for PR curves

    Raises:
        HTTPException: If job not found, not completed, or predictions unavailable
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    # Get predictions for specified model or best model
    predictions = _get_model_predictions(job.results, estimator_name)

    if not predictions.get('y_pred_proba'):
        raise HTTPException(
            status_code=404,
            detail="Probability predictions not available for PR curves"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_pr_curves(
        y_true=predictions['y_true'],
        y_pred_proba=predictions['y_pred_proba'],
        class_names=predictions['class_names']
    )

    model_label = estimator_name or "Best Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "pr_curves",
        "title": f"Precision-Recall Curves - {model_label}"
    }


@router.get("/job/{job_id}/visualizations/feature-importance")
async def get_feature_importance(
    job_id: str,
    top_n: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get feature importance visualization.

    Args:
        job_id: Training job ID
        top_n: Number of top features to display (default: 20)

    Returns:
        Plotly JSON for feature importance bar chart

    Raises:
        HTTPException: If job not found or feature importance unavailable
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    # Get feature importance
    results = job.results
    feature_importance = results.get('feature_importance')

    if not feature_importance:
        raise HTTPException(
            status_code=404,
            detail="Feature importance not available for this model"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_feature_importance(
        importance_dict=feature_importance,
        top_n=top_n
    )

    return {
        "plotly_json": plotly_json,
        "viz_type": "feature_importance",
        "title": f"Top {min(top_n, len(feature_importance))} Feature Importances"
    }


@router.get("/job/{job_id}/visualizations/calibration")
async def get_calibration_plot(
    job_id: str,
    estimator_name: Optional[str] = Query(None, description="Model name. If not provided, uses best model."),
    db: Session = Depends(get_db)
):
    """
    Get calibration plot (reliability diagram) for classification job.

    Args:
        job_id: Training job ID
        estimator_name: Optional model name. If not provided, uses best model.

    Returns:
        Plotly JSON for calibration plot

    Raises:
        HTTPException: If job not found or predictions unavailable
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    # Get predictions for specified model or best model
    predictions = _get_model_predictions(job.results, estimator_name)

    if not predictions.get('y_pred_proba'):
        raise HTTPException(
            status_code=404,
            detail="Probability predictions not available for calibration plot"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_calibration_plot(
        y_true=predictions['y_true'],
        y_pred_proba=predictions['y_pred_proba'],
        class_names=predictions['class_names']
    )

    model_label = estimator_name or "Best Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "calibration",
        "title": f"Calibration Plot - {model_label}"
    }


@router.get("/job/{job_id}/visualizations/predicted-vs-actual")
async def get_predicted_vs_actual(job_id: str, db: Session = Depends(get_db)):
    """
    Get predicted vs actual scatter plot for regression job.

    Args:
        job_id: Training job ID

    Returns:
        Plotly JSON for predicted vs actual plot

    Raises:
        HTTPException: If job not found, not completed, or not regression
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    # Get config for task type
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == job.config_id
    ).first()

    if not config or config.task_type != "regression":
        raise HTTPException(
            status_code=400,
            detail="Predicted vs actual plot only available for regression tasks"
        )

    # Get predictions
    results = job.results
    predictions = results.get('predictions')

    if not predictions:
        raise HTTPException(
            status_code=404,
            detail="Predictions not available"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_predicted_vs_actual(
        y_true=predictions['y_true'],
        y_pred=predictions['y_pred']
    )

    return {
        "plotly_json": plotly_json,
        "viz_type": "predicted_vs_actual",
        "title": "Predicted vs Actual"
    }


@router.get("/job/{job_id}/visualizations/residual-plot")
async def get_residual_plot(job_id: str, db: Session = Depends(get_db)):
    """
    Get residual plot for regression job.

    Args:
        job_id: Training job ID

    Returns:
        Plotly JSON for residual plot

    Raises:
        HTTPException: If job not found, not completed, or not regression
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    # Get config for task type
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == job.config_id
    ).first()

    if not config or config.task_type != "regression":
        raise HTTPException(
            status_code=400,
            detail="Residual plot only available for regression tasks"
        )

    # Get predictions
    results = job.results
    predictions = results.get('predictions')

    if not predictions:
        raise HTTPException(
            status_code=404,
            detail="Predictions not available"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_residual_plot(
        y_true=predictions['y_true'],
        y_pred=predictions['y_pred']
    )

    return {
        "plotly_json": plotly_json,
        "viz_type": "residual_plot",
        "title": "Residual Plot"
    }


@router.get("/job/{job_id}/visualizations/qq-plot")
async def get_qq_plot(job_id: str, db: Session = Depends(get_db)):
    """
    Get Q-Q plot for regression job (normality check of residuals).

    Args:
        job_id: Training job ID

    Returns:
        Plotly JSON for Q-Q plot

    Raises:
        HTTPException: If job not found, not completed, or not regression
    """
    from services.visualization_generator import visualization_generator

    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Training job is not completed. Current status: {job.status}"
        )

    # Get config for task type
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == job.config_id
    ).first()

    if not config or config.task_type != "regression":
        raise HTTPException(
            status_code=400,
            detail="Q-Q plot only available for regression tasks"
        )

    # Get predictions
    results = job.results
    predictions = results.get('predictions')

    if not predictions or not predictions.get('residuals'):
        raise HTTPException(
            status_code=404,
            detail="Residuals not available"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_qq_plot(
        residuals=predictions['residuals']
    )

    return {
        "plotly_json": plotly_json,
        "viz_type": "qq_plot",
        "title": "Q-Q Plot (Normality Check)"
    }
