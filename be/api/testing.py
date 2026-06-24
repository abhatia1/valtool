"""
Testing API - Model Testing Endpoints

Provides endpoints for testing trained models on new datasets:
- Upload test dataset
- Run model evaluation on test data
- Get test results with comparison to training metrics
"""

import json
import os
import pickle
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from models.database import Dataset, TestRun, TrainingConfig, TrainingJob
from models.schemas import (
    FinalizeModelRequest,
    FinalizeModelResponse,
    FinalizedModelForBenchmarking,
    FinalizedModelInfo,
    FinalizedModelsResponse,
    MetricComparison,
    ModelTestResult,
    MultiModelTestRequest,
    MultiModelTestResultsResponse,
    TestResultsResponse,
    TestRunRequest,
    TestRunResponse,
)
from services.monitoring_service import ModelFinalizer, ModelTester, MultiModelTester
from services.visualization_generator import visualization_generator
from utils.file_utils import save_upload_file

router = APIRouter()


def _get_test_predictions(
    test_run: TestRun,
    db: Session,
    estimator_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get predictions for a specific model or the best test model from a test run.

    Args:
        test_run: The TestRun database object
        db: Database session
        estimator_name: Optional model name. If None, uses best test model.

    Returns:
        Predictions dict with y_true, y_pred, y_pred_proba, class_names, task_type

    Raises:
        HTTPException: If model not found or predictions not available
    """
    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == test_run.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    # Get config for task type and target column
    config = db.query(TrainingConfig).filter(
        TrainingConfig.config_id == job.config_id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Training configuration not found")

    # Determine which model to use
    if estimator_name is None:
        # First try: best test model from multi-model test
        if test_run.metrics and "best_test_model" in test_run.metrics:
            estimator_name = test_run.metrics["best_test_model"]
        # Second try: best model from training job (for single model tests)
        elif job.results and "best_model" in job.results:
            best_model = job.results["best_model"]
            if isinstance(best_model, dict) and "estimator_name" in best_model:
                estimator_name = best_model["estimator_name"]

        # If still no model found, raise error
        if estimator_name is None:
            raise HTTPException(
                status_code=404,
                detail="No best model found. Test run may have failed or be incomplete."
            )

    # Build paths
    models_path = os.path.join(settings.BASE_STORAGE_PATH, "models", test_run.job_id)
    model_path = os.path.join(models_path, "all_models", estimator_name, "model.pkl")

    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=404,
            detail=f"Model '{estimator_name}' not found"
        )

    # Load model
    with open(model_path, "rb") as f:
        model = pickle.load(f)

    # Load shared artifacts using MultiModelTester pattern
    tester = MultiModelTester(models_path, config.task_type)
    tester.load_shared_artifacts()

    # Load test dataset
    try:
        if test_run.test_dataset_path.endswith(".csv"):
            test_df = pd.read_csv(test_run.test_dataset_path)
        else:
            test_df = pd.read_excel(test_run.test_dataset_path)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read test dataset: {str(e)}"
        )

    # Validate target column
    target_column = config.target_column
    if target_column not in test_df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{target_column}' not found in test dataset"
        )

    # Prepare features and target
    X_test = test_df.drop(columns=[target_column])
    y_test = test_df[target_column]

    # Preprocess test data
    if tester.preprocessor is not None:
        try:
            X_transformed = tester.preprocessor.transform(X_test)
        except Exception:
            X_transformed = X_test
    else:
        X_transformed = X_test

    # Make predictions
    y_pred = model.predict(X_transformed)

    # Handle target encoding/scaling
    y_actual = y_test.values if hasattr(y_test, "values") else y_test
    y_pred_proba = None
    class_names = None

    if config.task_type == "classification":
        # Encode target if label encoder exists
        if tester.label_encoder is not None:
            try:
                y_actual = tester.label_encoder.transform(y_test)
            except Exception:
                pass

        # Get class names
        y_actual_list = y_actual.tolist() if hasattr(y_actual, "tolist") else list(y_actual)
        y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)
        all_labels = set(y_actual_list) | set(y_pred_list)
        class_names = sorted([str(label) for label in all_labels])

        # Get prediction probabilities if available
        if hasattr(model, "predict_proba"):
            try:
                y_pred_proba = model.predict_proba(X_transformed)
                y_pred_proba = y_pred_proba.tolist() if hasattr(y_pred_proba, "tolist") else list(y_pred_proba)
            except Exception:
                pass
    else:
        # Regression: inverse transform if target scaler exists
        if tester.target_scaler is not None:
            try:
                y_pred = tester.target_scaler.inverse_transform(
                    y_pred.reshape(-1, 1)
                ).flatten()
            except Exception:
                pass

    # Convert to lists for JSON serialization
    y_true_list = y_actual.tolist() if hasattr(y_actual, "tolist") else list(y_actual)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)

    # Get feature names and importance
    feature_names = None
    feature_importance = None

    if tester.preprocessor is not None:
        try:
            feature_names = tester.preprocessor.get_feature_names_out()
            feature_names = list(feature_names)
        except Exception:
            pass

    if feature_names is None:
        feature_names = X_test.columns.tolist() if hasattr(X_test, "columns") else None

    # Get feature importance from model
    if hasattr(model, "feature_importances_"):
        feature_importance = dict(zip(
            feature_names or [f"feature_{i}" for i in range(len(model.feature_importances_))],
            model.feature_importances_.tolist()
        ))
    elif hasattr(model, "coef_"):
        coef = model.coef_.flatten() if model.coef_.ndim > 1 else model.coef_
        if len(coef) > len(feature_names or []):
            # Multi-class: average absolute coefficients
            coef = np.abs(model.coef_).mean(axis=0)
        feature_importance = dict(zip(
            feature_names or [f"feature_{i}" for i in range(len(coef))],
            np.abs(coef).tolist()
        ))

    return {
        "y_true": y_true_list,
        "y_pred": y_pred_list,
        "y_pred_proba": y_pred_proba,
        "class_names": class_names,
        "task_type": config.task_type,
        "feature_names": feature_names,
        "feature_importance": feature_importance,
        "estimator_name": estimator_name,
    }


@router.post("/upload", response_model=Dict[str, Any])
async def upload_test_dataset(
    file: UploadFile = File(...),
    job_id: str = None,
    db: Session = Depends(get_db),
):
    """
    Upload a test dataset for model evaluation.

    Args:
        file: CSV/Excel file containing test data
        job_id: Training job ID to associate with this test dataset
        db: Database session

    Returns:
        Upload confirmation with test_id
    """
    # Validate file extension
    allowed_extensions = [".csv", ".xlsx", ".xls"]
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}",
        )

    # Validate job exists if provided
    if job_id:
        job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Training job not found")
        if job.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="Training job must be completed before testing",
            )

    # Generate test ID and save file
    test_id = str(uuid.uuid4())
    test_dir = os.path.join(settings.BASE_STORAGE_PATH, "tests")
    os.makedirs(test_dir, exist_ok=True)

    file_path = os.path.join(test_dir, f"{test_id}{file_ext}")

    # Save file
    await save_upload_file(file, Path(file_path))

    # Load and validate dataset
    try:
        if file_ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    return {
        "test_id": test_id,
        "filename": file.filename,
        "file_path": file_path,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": df.columns.tolist(),
        "status": "uploaded",
    }


@router.post("/run", response_model=TestRunResponse)
async def run_model_test(
    request: TestRunRequest,
    db: Session = Depends(get_db),
):
    """
    Run model evaluation on test dataset.

    Args:
        request: Test run request with test_id and job_id
        db: Database session

    Returns:
        Test run information with test_run_id
    """
    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == request.job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400, detail="Training job must be completed before testing"
        )

    if not job.best_model_path:
        raise HTTPException(
            status_code=400, detail="No trained model found for this job"
        )

    # Get configuration for task type and target column
    config = (
        db.query(TrainingConfig)
        .filter(TrainingConfig.config_id == job.config_id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=404, detail="Training configuration not found")

    # Load test dataset
    test_dir = os.path.join(settings.BASE_STORAGE_PATH, "tests")
    test_files = [f for f in os.listdir(test_dir) if f.startswith(request.test_id)]

    if not test_files:
        raise HTTPException(status_code=404, detail="Test dataset not found")

    test_file_path = os.path.join(test_dir, test_files[0])

    try:
        if test_file_path.endswith(".csv"):
            test_df = pd.read_csv(test_file_path)
        else:
            test_df = pd.read_excel(test_file_path)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to read test dataset: {str(e)}"
        )

    # Validate target column exists
    target_column = config.target_column
    if target_column not in test_df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{target_column}' not found in test dataset",
        )

    # Create test run record
    test_run = TestRun(
        job_id=request.job_id,
        test_dataset_path=test_file_path,
        tested_at=datetime.utcnow(),
    )

    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    # Run evaluation
    try:
        tester = ModelTester(job.best_model_path, config.task_type)

        # Prepare features and target
        X_test = test_df.drop(columns=[target_column])
        y_test = test_df[target_column]

        # Get training metrics for comparison
        training_metrics = {}
        if job.results and "best_model" in job.results:
            training_metrics = job.results["best_model"].get("metrics", {})

        # Evaluate
        results = tester.evaluate(X_test, y_test, training_metrics)

        # Update test run with results
        test_run.metrics = results["metrics"]
        test_run.predictions = {
            "predictions": results["predictions"],
            "actual": results["actual"],
            "sample_count": results["sample_count"],
            "comparison_to_training": results["comparison_to_training"],
        }

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Model evaluation failed: {str(e)}"
        )

    return TestRunResponse(
        test_run_id=test_run.test_run_id,
        status="completed",
    )


@router.post("/run-all", response_model=MultiModelTestResultsResponse)
async def run_all_models_test(
    request: MultiModelTestRequest,
    db: Session = Depends(get_db),
):
    """
    Run evaluation on ALL trained models (not just the best) using test dataset.

    This enables a comprehensive comparison showing how all models perform on
    out-of-sample data, revealing potential overfitting and generalization issues.

    Args:
        request: Multi-model test request with job_id and test_dataset_id
        db: Database session

    Returns:
        Complete leaderboard of all models with test metrics
    """
    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == request.job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400, detail="Training job must be completed before testing"
        )

    # Check if all_models directory exists
    models_dir = os.path.join(settings.BASE_STORAGE_PATH, "models", request.job_id, "all_models")
    if not os.path.exists(models_dir):
        raise HTTPException(
            status_code=400,
            detail="No multi-model artifacts found. This training job may have been run before multi-model support was added.",
        )

    # Get configuration for task type and target column
    config = (
        db.query(TrainingConfig)
        .filter(TrainingConfig.config_id == job.config_id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=404, detail="Training configuration not found")

    # Load test dataset
    test_dir = os.path.join(settings.BASE_STORAGE_PATH, "tests")
    test_files = [f for f in os.listdir(test_dir) if f.startswith(request.test_dataset_id)]

    if not test_files:
        raise HTTPException(status_code=404, detail="Test dataset not found")

    test_file_path = os.path.join(test_dir, test_files[0])

    try:
        if test_file_path.endswith(".csv"):
            test_df = pd.read_csv(test_file_path)
        else:
            test_df = pd.read_excel(test_file_path)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to read test dataset: {str(e)}"
        )

    # Validate target column exists
    target_column = config.target_column
    if target_column not in test_df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{target_column}' not found in test dataset",
        )

    # Create test run record
    test_run = TestRun(
        job_id=request.job_id,
        test_dataset_path=test_file_path,
        tested_at=datetime.utcnow(),
    )

    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    # Run multi-model evaluation
    try:
        # Build the full path to the models directory
        models_path = os.path.join(settings.BASE_STORAGE_PATH, "models", request.job_id)
        tester = MultiModelTester(models_path, config.task_type)

        # Prepare features and target
        X_test = test_df.drop(columns=[target_column])
        y_test = test_df[target_column]

        # Pass the training results dict (test_all_models expects {"all_models": [...]})
        training_results = job.results if job.results else {}

        # Test all models
        test_output = tester.test_all_models(X_test, y_test, training_results)

        # Determine primary metric for ranking
        if config.task_type == "classification":
            primary_metric = "accuracy"
        else:
            primary_metric = "r2"

        # Build response models from test_output["all_models"]
        all_model_results = []
        for model_result in test_output.get("all_models", []):
            test_score = model_result["test_metrics"].get(primary_metric, 0)
            validation_score = model_result.get("validation_score", 0)

            all_model_results.append(
                ModelTestResult(
                    estimator_name=model_result["estimator_name"],
                    test_metrics=model_result["test_metrics"],
                    validation_score=validation_score,
                    validation_std=model_result.get("validation_std", 0),
                    training_time=model_result.get("training_time", 0),
                    generalization_gap=validation_score - test_score if validation_score else 0,
                )
            )

        # Sort by test score (descending for classification accuracy/r2)
        all_model_results.sort(
            key=lambda x: x.test_metrics.get(primary_metric, 0),
            reverse=True
        )

        # Best test model is first in sorted list
        best_test_model = all_model_results[0] if all_model_results else None

        # Find best validation model
        best_validation_model = max(
            all_model_results,
            key=lambda x: x.validation_score,
            default=None
        )

        # Update test run with multi-model results
        test_run.metrics = {
            "multi_model": True,
            "models_tested": len(all_model_results),
            "best_test_model": best_test_model.estimator_name if best_test_model else None,
            "best_validation_model": best_validation_model.estimator_name if best_validation_model else None,
        }
        test_run.predictions = {
            "all_models": [m.model_dump() for m in all_model_results],
            "sample_count": len(test_df),
        }

        db.commit()

        # Visualizations are now generated on-demand via dedicated endpoints:
        # GET /api/testing/results/{test_run_id}/visualizations/confusion-matrix
        # GET /api/testing/results/{test_run_id}/visualizations/roc-curves
        # GET /api/testing/results/{test_run_id}/visualizations/pr-curves
        # GET /api/testing/results/{test_run_id}/visualizations/predicted-vs-actual
        # GET /api/testing/results/{test_run_id}/visualizations/residual-plot
        # GET /api/testing/results/{test_run_id}/visualizations/qq-plot
        # GET /api/testing/results/{test_run_id}/visualizations/feature-importance
        visualizations = {}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Multi-model evaluation failed: {str(e)}"
        )

    return MultiModelTestResultsResponse(
        test_run_id=test_run.test_run_id,
        status="completed",
        task_type=config.task_type,
        best_test_model=best_test_model,
        best_validation_model=best_validation_model,
        all_models=all_model_results,
        sample_count=len(test_df),
        visualizations=visualizations,
        tested_at=test_run.tested_at,
    )


@router.post("/finalize-model", response_model=FinalizeModelResponse)
async def finalize_model_for_benchmarking(
    request: FinalizeModelRequest,
    db: Session = Depends(get_db),
):
    """
    Finalize selected models for benchmarking.

    This endpoint:
    1. Keeps selected models in a kept_models/ directory
    2. Creates a combined pipeline package for the primary model
    3. Deletes unused models from all_models/ to save storage space
    4. Returns finalization details including space saved

    Args:
        request: Finalize request with job_id, selected_models list, and optional primary_model
        db: Database session

    Returns:
        Finalization response with model info and cleanup stats
    """
    # Validate request
    if not request.selected_models:
        raise HTTPException(
            status_code=400, detail="At least one model must be selected"
        )

    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == request.job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400, detail="Training job must be completed before finalizing"
        )

    # Get configuration for task type
    config = (
        db.query(TrainingConfig)
        .filter(TrainingConfig.config_id == job.config_id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=404, detail="Training configuration not found")

    # Check if all_models directory exists
    models_dir = os.path.join(
        settings.BASE_STORAGE_PATH, "models", request.job_id, "all_models"
    )
    if not os.path.exists(models_dir):
        raise HTTPException(
            status_code=400,
            detail="No multi-model artifacts found. Model may have already been finalized.",
        )

    # Get available models
    available_models = [
        d for d in os.listdir(models_dir) if os.path.isdir(os.path.join(models_dir, d))
    ]

    # Verify all selected models exist
    missing_models = [m for m in request.selected_models if m not in available_models]
    if missing_models:
        raise HTTPException(
            status_code=400,
            detail=f"Selected models not found: {missing_models}. Available: {available_models}",
        )

    # Determine primary model (default to first selected if not specified)
    primary_model = request.primary_model or request.selected_models[0]
    if primary_model not in request.selected_models:
        raise HTTPException(
            status_code=400,
            detail=f"Primary model '{primary_model}' must be in selected_models list",
        )

    # Get test metrics for all selected models from the latest test run
    latest_test_run = (
        db.query(TestRun)
        .filter(TestRun.job_id == request.job_id)
        .order_by(TestRun.tested_at.desc())
        .first()
    )

    model_metrics: Dict[str, Dict[str, Any]] = {}

    if latest_test_run and latest_test_run.predictions:
        all_models_data = latest_test_run.predictions.get("all_models", [])
        for model_data in all_models_data:
            est_name = model_data.get("estimator_name")
            if est_name in request.selected_models:
                model_metrics[est_name] = {
                    "test_metrics": model_data.get("test_metrics", {}),
                    "validation_score": model_data.get("validation_score", 0.0),
                }

    # Run finalization
    try:
        job_dir = os.path.join(settings.BASE_STORAGE_PATH, "models", request.job_id)
        finalizer = ModelFinalizer(job_dir, config.task_type)

        result = finalizer.finalize_models(
            selected_models=request.selected_models,
            primary_model=primary_model,
            model_metrics=model_metrics,
        )

        # Update training job to mark as finalized
        if job.results:
            job.results["finalized_models"] = request.selected_models
            job.results["primary_model"] = primary_model
            job.results["finalized_at"] = datetime.utcnow().isoformat()
        else:
            job.results = {
                "finalized_models": request.selected_models,
                "primary_model": primary_model,
                "finalized_at": datetime.utcnow().isoformat(),
            }

        db.commit()

        return FinalizeModelResponse(
            success=True,
            job_id=request.job_id,
            primary_model=FinalizedModelInfo(
                model_path=result["model_path"],
                estimator_name=result["estimator_name"],
                task_type=result["task_type"],
                test_metrics=result["test_metrics"],
                validation_score=result["validation_score"],
                file_size_mb=result["file_size_mb"],
                includes_preprocessor=result["includes_preprocessor"],
                includes_encoder=result["includes_encoder"],
            ),
            kept_models=result["kept_models"],
            models_deleted=result["models_deleted"],
            space_saved_mb=result["space_saved_mb"],
            message=f"Successfully finalized {len(request.selected_models)} model(s). "
            f"Primary: '{primary_model}'. "
            f"Deleted {result['models_deleted']} unused model(s), "
            f"saved {result['space_saved_mb']:.1f} MB of storage.",
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Model finalization failed: {str(e)}"
        )


@router.get("/finalized-models/{job_id}", response_model=FinalizedModelsResponse)
async def get_finalized_models(
    job_id: str,
    db: Session = Depends(get_db),
):
    """
    Get finalized models available for benchmarking.

    Returns the list of models that have been finalized (if any) or all trained
    models if not yet finalized. This endpoint is used by the benchmarking stage
    to know which models are available for comparison.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        FinalizedModelsResponse with model info and finalization status
    """
    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400, detail="Training job must be completed"
        )

    # Get configuration for task type
    config = (
        db.query(TrainingConfig)
        .filter(TrainingConfig.config_id == job.config_id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=404, detail="Training configuration not found")

    task_type = config.task_type

    # Check if models have been finalized
    is_finalized = bool(
        job.results and job.results.get("finalized_models")
    )

    # Check for preprocessor and encoder files
    job_dir = os.path.join(settings.BASE_STORAGE_PATH, "models", job_id)
    includes_preprocessor = os.path.exists(os.path.join(job_dir, "preprocessor.pkl"))
    
    # Check for encoder (label_encoder for classification, target_scaler for regression)
    encoder_type: Optional[str] = None
    includes_encoder = False
    if os.path.exists(os.path.join(job_dir, "label_encoder.pkl")):
        includes_encoder = True
        encoder_type = "label_encoder"
    elif os.path.exists(os.path.join(job_dir, "target_scaler.pkl")):
        includes_encoder = True
        encoder_type = "target_scaler"

    # Get test metrics from latest test run (if any)
    latest_test_run = (
        db.query(TestRun)
        .filter(TestRun.job_id == job_id)
        .order_by(TestRun.tested_at.desc())
        .first()
    )

    test_metrics_map: Dict[str, Dict[str, Any]] = {}
    if latest_test_run and latest_test_run.predictions:
        all_models_data = latest_test_run.predictions.get("all_models", [])
        for model_data in all_models_data:
            est_name = model_data.get("estimator_name")
            if est_name:
                test_metrics_map[est_name] = {
                    "test_metrics": model_data.get("test_metrics", {}),
                    "validation_score": model_data.get("validation_score", 0.0),
                    "training_time": model_data.get("training_time", 0.0),
                }

    models: List[FinalizedModelForBenchmarking] = []
    primary_model: Optional[str] = None
    finalized_at: Optional[datetime] = None

    if is_finalized:
        # Return only finalized models
        finalized_model_names = job.results.get("finalized_models", [])
        primary_model = job.results.get("primary_model")
        finalized_at_str = job.results.get("finalized_at")
        if finalized_at_str:
            finalized_at = datetime.fromisoformat(finalized_at_str)

        for est_name in finalized_model_names:
            metrics_data = test_metrics_map.get(est_name, {})
            models.append(
                FinalizedModelForBenchmarking(
                    estimator_name=est_name,
                    is_primary=(est_name == primary_model),
                    test_metrics=metrics_data.get("test_metrics", {}),
                    validation_score=metrics_data.get("validation_score", 0.0),
                    training_time_seconds=metrics_data.get("training_time", 0.0),
                )
            )

        message = f"Models finalized. {len(models)} model(s) available for benchmarking."
    else:
        # Return all trained models
        if job.results and job.results.get("all_models"):
            all_models = job.results.get("all_models", [])
            best_model_name = job.results.get("best_model", {}).get("estimator_id")

            for model_data in all_models:
                est_name = model_data.get("estimator_id")
                if est_name:
                    # Prefer test metrics if available, otherwise use training metrics
                    metrics_data = test_metrics_map.get(est_name, {})
                    models.append(
                        FinalizedModelForBenchmarking(
                            estimator_name=est_name,
                            is_primary=(est_name == best_model_name),
                            test_metrics=metrics_data.get("test_metrics", model_data.get("metrics", {})),
                            validation_score=metrics_data.get("validation_score", model_data.get("validation_score", 0.0)),
                            training_time_seconds=metrics_data.get("training_time", model_data.get("training_time", 0.0)),
                        )
                    )

            primary_model = best_model_name

        message = "Models not yet finalized. All trained models shown. Finalize in Testing stage to proceed."

    return FinalizedModelsResponse(
        job_id=job_id,
        is_finalized=is_finalized,
        task_type=task_type,
        primary_model=primary_model,
        models=models,
        includes_preprocessor=includes_preprocessor,
        includes_encoder=includes_encoder,
        encoder_type=encoder_type,
        finalized_at=finalized_at,
        message=message,
    )


@router.get("/results/{test_run_id}", response_model=TestResultsResponse)
async def get_test_results(
    test_run_id: str,
    db: Session = Depends(get_db),
):
    """
    Get detailed test results.

    Args:
        test_run_id: Test run ID
        db: Database session

    Returns:
        Complete test results with metrics, predictions, and comparison
    """
    test_run = (
        db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()
    )

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get training job for context
    job = (
        db.query(TrainingJob).filter(TrainingJob.job_id == test_run.job_id).first()
    )

    # Get config for task type
    config = None
    if job:
        config = (
            db.query(TrainingConfig)
            .filter(TrainingConfig.config_id == job.config_id)
            .first()
        )

    # Build comparison to training
    comparison = {}
    if test_run.predictions and "comparison_to_training" in test_run.predictions:
        for metric, data in test_run.predictions["comparison_to_training"].items():
            comparison[metric] = MetricComparison(
                training_value=data.get("training_value", 0),
                test_value=data.get("test_value", 0),
                difference=data.get("difference", 0),
                percent_change=data.get("percent_change", 0),
            )

    # Generate visualizations
    visualizations = {}

    if config and test_run.predictions:
        task_type = config.task_type
        predictions = test_run.predictions.get("predictions", [])
        actual = test_run.predictions.get("actual", [])

        if task_type == "classification":
            # Confusion matrix
            try:
                # Get unique class names from actual and predictions
                all_labels = set(actual) | set(predictions)
                class_names = sorted([str(label) for label in all_labels])

                cm_viz = visualization_generator.generate_confusion_matrix(
                    actual, predictions, class_names
                )
                visualizations["confusion_matrix"] = json.dumps(cm_viz)
            except Exception as e:
                print(f"Failed to generate confusion matrix: {e}")
        else:
            # Predicted vs Actual for regression
            try:
                pva_viz = visualization_generator.generate_predicted_vs_actual(
                    actual, predictions
                )
                visualizations["predicted_vs_actual"] = json.dumps(pva_viz)
            except Exception as e:
                print(f"Failed to generate predicted vs actual: {e}")

            # Residual plot
            try:
                residual_viz = visualization_generator.generate_residual_plot(
                    actual, predictions
                )
                visualizations["residual_plot"] = json.dumps(residual_viz)
            except Exception as e:
                print(f"Failed to generate residual plot: {e}")

    return TestResultsResponse(
        test_run_id=test_run.test_run_id,
        status="completed",
        metrics=test_run.metrics or {},
        predictions=test_run.predictions or {},
        comparison_to_training=comparison,
        visualizations=visualizations,
        tested_at=test_run.tested_at,
    )


@router.get("/list/{job_id}", response_model=Dict[str, Any])
async def list_test_runs(
    job_id: str,
    db: Session = Depends(get_db),
):
    """
    List all test runs for a training job.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        List of test runs
    """
    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    test_runs = db.query(TestRun).filter(TestRun.job_id == job_id).all()

    return {
        "job_id": job_id,
        "total": len(test_runs),
        "test_runs": [
            {
                "test_run_id": tr.test_run_id,
                "test_dataset_path": tr.test_dataset_path,
                "metrics": tr.metrics,
                "tested_at": tr.tested_at.isoformat() if tr.tested_at else None,
            }
            for tr in test_runs
        ],
    }


@router.delete("/{test_run_id}", response_model=Dict[str, Any])
async def delete_test_run(
    test_run_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete a test run.

    Args:
        test_run_id: Test run ID
        db: Database session

    Returns:
        Deletion confirmation
    """
    test_run = (
        db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()
    )

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Delete test dataset file if exists
    if test_run.test_dataset_path and os.path.exists(test_run.test_dataset_path):
        try:
            os.remove(test_run.test_dataset_path)
        except Exception:
            pass

    db.delete(test_run)
    db.commit()

    return {
        "test_run_id": test_run_id,
        "status": "deleted",
        "message": "Test run deleted successfully",
    }


# =============================================================================
# Test Visualization Endpoints
# =============================================================================


@router.get("/results/{test_run_id}/visualizations/confusion-matrix")
async def get_test_confusion_matrix(
    test_run_id: str,
    estimator_name: Optional[str] = Query(
        None, description="Model name. If not provided, uses best test model."
    ),
    db: Session = Depends(get_db),
):
    """
    Get confusion matrix visualization for test run (classification only).

    Args:
        test_run_id: Test run ID
        estimator_name: Optional model name. If not provided, uses best test model.

    Returns:
        Plotly JSON for confusion matrix heatmap
    """
    test_run = db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get predictions
    predictions = _get_test_predictions(test_run, db, estimator_name)

    if predictions["task_type"] != "classification":
        raise HTTPException(
            status_code=400,
            detail="Confusion matrix only available for classification tasks"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_confusion_matrix(
        y_true=predictions["y_true"],
        y_pred=predictions["y_pred"],
        class_names=predictions["class_names"]
    )

    model_label = predictions["estimator_name"] or "Best Test Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "confusion_matrix",
        "title": f"Confusion Matrix - {model_label} (Test)"
    }


@router.get("/results/{test_run_id}/visualizations/roc-curves")
async def get_test_roc_curves(
    test_run_id: str,
    estimator_name: Optional[str] = Query(
        None, description="Model name. If not provided, uses best test model."
    ),
    db: Session = Depends(get_db),
):
    """
    Get ROC curves visualization for test run (classification only).

    Args:
        test_run_id: Test run ID
        estimator_name: Optional model name. If not provided, uses best test model.

    Returns:
        Plotly JSON for ROC curves
    """
    test_run = db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get predictions
    predictions = _get_test_predictions(test_run, db, estimator_name)

    if predictions["task_type"] != "classification":
        raise HTTPException(
            status_code=400,
            detail="ROC curves only available for classification tasks"
        )

    if predictions["y_pred_proba"] is None:
        raise HTTPException(
            status_code=400,
            detail="ROC curves require probability predictions. This model may not support predict_proba."
        )

    # Convert y_true to integer indices for binarization
    class_names = predictions["class_names"]
    label_to_idx = {label: idx for idx, label in enumerate(class_names)}
    y_true_int = [label_to_idx.get(str(y), 0) for y in predictions["y_true"]]

    # Generate visualization
    plotly_json = visualization_generator.generate_roc_curves(
        y_true=y_true_int,
        y_pred_proba=predictions["y_pred_proba"],
        class_names=class_names
    )

    model_label = predictions["estimator_name"] or "Best Test Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "roc_curves",
        "title": f"ROC Curves - {model_label} (Test)"
    }


@router.get("/results/{test_run_id}/visualizations/pr-curves")
async def get_test_pr_curves(
    test_run_id: str,
    estimator_name: Optional[str] = Query(
        None, description="Model name. If not provided, uses best test model."
    ),
    db: Session = Depends(get_db),
):
    """
    Get Precision-Recall curves visualization for test run (classification only).

    Args:
        test_run_id: Test run ID
        estimator_name: Optional model name. If not provided, uses best test model.

    Returns:
        Plotly JSON for PR curves
    """
    test_run = db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get predictions
    predictions = _get_test_predictions(test_run, db, estimator_name)

    if predictions["task_type"] != "classification":
        raise HTTPException(
            status_code=400,
            detail="PR curves only available for classification tasks"
        )

    if predictions["y_pred_proba"] is None:
        raise HTTPException(
            status_code=400,
            detail="PR curves require probability predictions. This model may not support predict_proba."
        )

    # Convert y_true to integer indices for binarization
    class_names = predictions["class_names"]
    label_to_idx = {label: idx for idx, label in enumerate(class_names)}
    y_true_int = [label_to_idx.get(str(y), 0) for y in predictions["y_true"]]

    # Generate visualization
    plotly_json = visualization_generator.generate_pr_curves(
        y_true=y_true_int,
        y_pred_proba=predictions["y_pred_proba"],
        class_names=class_names
    )

    model_label = predictions["estimator_name"] or "Best Test Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "pr_curves",
        "title": f"Precision-Recall Curves - {model_label} (Test)"
    }


@router.get("/results/{test_run_id}/visualizations/predicted-vs-actual")
async def get_test_predicted_vs_actual(
    test_run_id: str,
    estimator_name: Optional[str] = Query(
        None, description="Model name. If not provided, uses best test model."
    ),
    db: Session = Depends(get_db),
):
    """
    Get predicted vs actual visualization for test run (regression only).

    Args:
        test_run_id: Test run ID
        estimator_name: Optional model name. If not provided, uses best test model.

    Returns:
        Plotly JSON for predicted vs actual scatter plot
    """
    test_run = db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get predictions
    predictions = _get_test_predictions(test_run, db, estimator_name)

    if predictions["task_type"] != "regression":
        raise HTTPException(
            status_code=400,
            detail="Predicted vs Actual only available for regression tasks"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_predicted_vs_actual(
        y_true=predictions["y_true"],
        y_pred=predictions["y_pred"]
    )

    model_label = predictions["estimator_name"] or "Best Test Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "predicted_vs_actual",
        "title": f"Predicted vs Actual - {model_label} (Test)"
    }


@router.get("/results/{test_run_id}/visualizations/residual-plot")
async def get_test_residual_plot(
    test_run_id: str,
    estimator_name: Optional[str] = Query(
        None, description="Model name. If not provided, uses best test model."
    ),
    db: Session = Depends(get_db),
):
    """
    Get residual plot visualization for test run (regression only).

    Args:
        test_run_id: Test run ID
        estimator_name: Optional model name. If not provided, uses best test model.

    Returns:
        Plotly JSON for residual plot
    """
    test_run = db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get predictions
    predictions = _get_test_predictions(test_run, db, estimator_name)

    if predictions["task_type"] != "regression":
        raise HTTPException(
            status_code=400,
            detail="Residual plot only available for regression tasks"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_residual_plot(
        y_true=predictions["y_true"],
        y_pred=predictions["y_pred"]
    )

    model_label = predictions["estimator_name"] or "Best Test Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "residual_plot",
        "title": f"Residual Plot - {model_label} (Test)"
    }


@router.get("/results/{test_run_id}/visualizations/qq-plot")
async def get_test_qq_plot(
    test_run_id: str,
    estimator_name: Optional[str] = Query(
        None, description="Model name. If not provided, uses best test model."
    ),
    db: Session = Depends(get_db),
):
    """
    Get Q-Q plot visualization for test run (regression only).

    Args:
        test_run_id: Test run ID
        estimator_name: Optional model name. If not provided, uses best test model.

    Returns:
        Plotly JSON for Q-Q plot
    """
    test_run = db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get predictions
    predictions = _get_test_predictions(test_run, db, estimator_name)

    if predictions["task_type"] != "regression":
        raise HTTPException(
            status_code=400,
            detail="Q-Q plot only available for regression tasks"
        )

    # Calculate residuals
    y_actual_arr = np.array(predictions["y_true"])
    y_pred_arr = np.array(predictions["y_pred"])
    residuals = (y_actual_arr - y_pred_arr).tolist()

    # Generate visualization
    plotly_json = visualization_generator.generate_qq_plot(residuals)

    model_label = predictions["estimator_name"] or "Best Test Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "qq_plot",
        "title": f"Q-Q Plot - {model_label} (Test)"
    }


@router.get("/results/{test_run_id}/visualizations/feature-importance")
async def get_test_feature_importance(
    test_run_id: str,
    estimator_name: Optional[str] = Query(
        None, description="Model name. If not provided, uses best test model."
    ),
    top_n: int = Query(20, description="Number of top features to show"),
    db: Session = Depends(get_db),
):
    """
    Get feature importance visualization for test run.

    Args:
        test_run_id: Test run ID
        estimator_name: Optional model name. If not provided, uses best test model.
        top_n: Number of top features to display (default: 20)

    Returns:
        Plotly JSON for feature importance bar chart
    """
    test_run = db.query(TestRun).filter(TestRun.test_run_id == test_run_id).first()

    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    # Get predictions (includes feature importance)
    predictions = _get_test_predictions(test_run, db, estimator_name)

    if predictions["feature_importance"] is None:
        raise HTTPException(
            status_code=400,
            detail="Feature importance not available for this model type"
        )

    # Generate visualization
    plotly_json = visualization_generator.generate_feature_importance(
        predictions["feature_importance"],
        top_n=top_n
    )

    model_label = predictions["estimator_name"] or "Best Test Model"
    return {
        "plotly_json": plotly_json,
        "viz_type": "feature_importance",
        "title": f"Feature Importance - {model_label} (Test)"
    }
