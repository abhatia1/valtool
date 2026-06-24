"""
Benchmarking API - Model Comparison Endpoints

Provides endpoints for comparing platform-trained models against external Docker containers:
- Upload external models
- Build Docker images
- Validate endpoints
- Run benchmarks
- Get comparison results
"""

import os
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.database import get_db
from models.database import ExternalModel, BenchmarkRun, TrainingJob
from models.schemas import (
    ExternalModelUploadRequest,
    ExternalModelResponse,
    ExternalModelListResponse,
    ContainerBuildStatus,
    SecurityScanResult,
    EndpointValidationResponse,
    ContainerStatusResponse,
    ContainerPredictionRequest,
    ContainerPredictionResponse,
    BenchmarkStartRequest,
    BenchmarkStatusResponse,
    BenchmarkResultsResponse,
    BenchmarkListResponse,
    BenchmarkListItem,
    NativeModelUploadRequest,
    NativeModelValidationResponse,
)
from services.external_model_manager import ExternalModelManager
from services.container_runner import ContainerRunner
from services.benchmark_service import BenchmarkService
from services.native_model_manager import native_model_manager

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# External Model Management Endpoints
# ============================================================

@router.post("/external-models/upload", response_model=ExternalModelResponse)
async def upload_external_model(
    name: str = Form(...),
    task_type: str = Form(...),
    description: Optional[str] = Form(None),
    dockerfile: UploadFile = File(...),
    requirements: Optional[UploadFile] = File(None),
    model_files: List[UploadFile] = File([]),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    """
    Upload an external model with Dockerfile and model files.

    Args:
        name: Model name
        task_type: Task type (classification or regression)
        description: Optional model description
        dockerfile: Dockerfile for building the container
        requirements: Optional requirements.txt
        model_files: Model files (pickle, h5, pt, etc.)
        db: Database session

    Returns:
        Created external model information
    """
    # Validate task type
    if task_type not in ["classification", "regression"]:
        raise HTTPException(
            status_code=400,
            detail="task_type must be 'classification' or 'regression'"
        )

    # Validate Dockerfile
    if not dockerfile.filename.lower().endswith(("dockerfile", ".dockerfile")):
        if dockerfile.filename.lower() != "dockerfile":
            raise HTTPException(
                status_code=400,
                detail="Must upload a Dockerfile"
            )

    try:
        manager = ExternalModelManager(db)
        model = await manager.upload_model(
            name=name,
            task_type=task_type,
            dockerfile=dockerfile,
            requirements=requirements,
            model_files=model_files,
            description=description,
        )

        # Optionally start build in background
        if background_tasks:
            container_runner = ContainerRunner(db)
            background_tasks.add_task(container_runner.build_image, model.model_id)

        return ExternalModelResponse(
            model_id=model.model_id,
            name=model.name,
            description=model.description,
            task_type=model.task_type,
            status=model.build_status,
            build_progress=model.build_progress,
            created_at=model.created_at,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading external model: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload model")


@router.post("/external-models/upload-native", response_model=ExternalModelResponse)
async def upload_native_model(
    name: str = Form(...),
    task_type: str = Form(...),
    description: Optional[str] = Form(None),
    model_file: UploadFile = File(...),
    preprocessor_file: Optional[UploadFile] = File(None),
    label_encoder_file: Optional[UploadFile] = File(None),
    target_scaler_file: Optional[UploadFile] = File(None),
    feature_names: Optional[str] = Form(None),  # JSON string
    class_names: Optional[str] = Form(None),  # JSON string
    db: Session = Depends(get_db),
):
    """
    Upload a native sklearn model (pickle/joblib) for benchmarking.

    Unlike Docker-based uploads, native models are immediately ready for inference
    without a build step. This is ideal for scikit-learn compatible models.

    Args:
        name: Model name
        task_type: Task type (classification or regression)
        description: Optional model description
        model_file: Model file (.pkl, .joblib) - required
        preprocessor_file: Preprocessor file (.pkl, .joblib) - optional
        label_encoder_file: Label encoder file (.pkl) - optional, classification only
        target_scaler_file: Target scaler file (.pkl) - optional, regression only
        feature_names: JSON string array of feature names - optional
        class_names: JSON string array of class names - optional (classification)
        db: Database session

    Returns:
        Created external model information (status will be 'ready')
    """
    import json

    # Validate task type
    if task_type not in ["classification", "regression"]:
        raise HTTPException(
            status_code=400,
            detail="task_type must be 'classification' or 'regression'"
        )

    # Validate model file extension
    allowed_extensions = {".pkl", ".joblib", ".pickle"}
    model_ext = os.path.splitext(model_file.filename)[1].lower()
    if model_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Model file must be {', '.join(allowed_extensions)}"
        )

    # Parse optional JSON fields
    parsed_feature_names = None
    parsed_class_names = None

    if feature_names:
        try:
            parsed_feature_names = json.loads(feature_names)
            if not isinstance(parsed_feature_names, list):
                raise ValueError("feature_names must be a JSON array")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid feature_names JSON")

    if class_names:
        try:
            parsed_class_names = json.loads(class_names)
            if not isinstance(parsed_class_names, list):
                raise ValueError("class_names must be a JSON array")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid class_names JSON")

    try:
        # Read file contents
        model_content = await model_file.read()
        preprocessor_content = await preprocessor_file.read() if preprocessor_file else None
        label_encoder_content = await label_encoder_file.read() if label_encoder_file else None
        target_scaler_content = await target_scaler_file.read() if target_scaler_file else None

        # Build metadata
        metadata = {}
        if parsed_feature_names:
            metadata["feature_names"] = parsed_feature_names
        if parsed_class_names:
            metadata["class_names"] = parsed_class_names

        # Upload via native model manager
        model = await native_model_manager.upload_native_model(
            db=db,
            name=name,
            task_type=task_type,
            model_file_content=model_content,
            model_filename=model_file.filename,
            description=description,
            preprocessor_content=preprocessor_content,
            preprocessor_filename=preprocessor_file.filename if preprocessor_file else None,
            label_encoder_content=label_encoder_content,
            label_encoder_filename=label_encoder_file.filename if label_encoder_file else None,
            target_scaler_content=target_scaler_content,
            target_scaler_filename=target_scaler_file.filename if target_scaler_file else None,
            metadata=metadata if metadata else None,
        )

        return ExternalModelResponse(
            model_id=model.model_id,
            name=model.name,
            description=model.description,
            task_type=model.task_type,
            model_source=model.model_source,
            status=model.build_status,
            build_progress=model.build_progress,
            current_build_step=model.current_build_step,
            feature_names=model.feature_names,
            class_names=model.class_names,
            created_at=model.created_at,
            validated_at=model.validated_at,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error uploading native model: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload native model: {str(e)}")


@router.post("/external-models/{model_id}/validate-native", response_model=NativeModelValidationResponse)
async def validate_native_model(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Validate a native model can make predictions.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        Validation results including model capabilities
    """
    model = db.query(ExternalModel).filter(ExternalModel.model_id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if model.model_source != "native":
        raise HTTPException(status_code=400, detail="Model is not a native model")

    try:
        from pathlib import Path

        validation_errors = []
        validation_warnings = []

        # Validate model file
        model_validation = native_model_manager.validate_model_file(Path(model.native_model_path))
        validation_errors.extend(model_validation.get("errors", []))
        validation_warnings.extend(model_validation.get("warnings", []))

        # Check preprocessor if present
        has_preprocessor = False
        if model.native_preprocessor_path:
            prep_validation = native_model_manager.validate_preprocessor_file(
                Path(model.native_preprocessor_path)
            )
            has_preprocessor = prep_validation.get("is_valid", False)
            validation_errors.extend(prep_validation.get("errors", []))

        # Check label encoder if present
        has_label_encoder = False
        if model.native_label_encoder_path:
            enc_validation = native_model_manager.validate_encoder_file(
                Path(model.native_label_encoder_path), "label"
            )
            has_label_encoder = enc_validation.get("is_valid", False)
            validation_errors.extend(enc_validation.get("errors", []))

        # Check target scaler if present
        has_target_scaler = False
        if model.native_target_scaler_path:
            scaler_validation = native_model_manager.validate_encoder_file(
                Path(model.native_target_scaler_path), "scaler"
            )
            has_target_scaler = scaler_validation.get("is_valid", False)
            validation_errors.extend(scaler_validation.get("errors", []))

        return NativeModelValidationResponse(
            model_id=model_id,
            is_valid=model_validation.get("is_valid", False),
            model_type=model_validation.get("model_type"),
            has_predict=model_validation.get("has_predict", False),
            has_predict_proba=model_validation.get("has_predict_proba", False),
            has_preprocessor=has_preprocessor,
            has_label_encoder=has_label_encoder,
            has_target_scaler=has_target_scaler,
            feature_count=len(model.feature_names) if model.feature_names else None,
            validation_errors=validation_errors,
            validation_warnings=validation_warnings,
        )

    except Exception as e:
        logger.error(f"Error validating native model: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.get("/external-models", response_model=ExternalModelListResponse)
async def list_external_models(
    task_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List external models with optional filtering.

    Args:
        task_type: Optional filter by task type
        status: Optional filter by build status
        db: Database session

    Returns:
        List of external models
    """
    manager = ExternalModelManager(db)
    models = manager.list_models(task_type=task_type, status=status)

    return ExternalModelListResponse(
        models=[
            ExternalModelResponse(
                model_id=m.model_id,
                name=m.name,
                description=m.description,
                task_type=m.task_type,
                status=m.build_status,
                build_error=m.build_logs if m.build_status == "failed" else None,
                build_progress=m.build_progress,
                current_build_step=m.current_build_step,
                image_name=m.image_name,
                security_scan_status=m.security_scan_status,
                vulnerability_count=m.vulnerability_count,
                created_at=m.created_at,
                validated_at=m.validated_at,
            )
            for m in models
        ]
    )


@router.get("/external-models/{model_id}", response_model=ExternalModelResponse)
async def get_external_model(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Get details of an external model.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        External model details
    """
    manager = ExternalModelManager(db)
    model = manager.get_model(model_id)

    if not model:
        raise HTTPException(status_code=404, detail="External model not found")

    return ExternalModelResponse(
        model_id=model.model_id,
        name=model.name,
        description=model.description,
        task_type=model.task_type,
        status=model.build_status,
        build_error=model.build_logs if model.build_status == "failed" else None,
        build_progress=model.build_progress,
        current_build_step=model.current_build_step,
        image_name=model.image_name,
        security_scan_status=model.security_scan_status,
        vulnerability_count=model.vulnerability_count,
        created_at=model.created_at,
        validated_at=model.validated_at,
    )


@router.delete("/external-models/{model_id}")
async def delete_external_model(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete an external model and its files.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        Deletion confirmation
    """
    manager = ExternalModelManager(db)

    # Stop any running containers first
    container_runner = ContainerRunner(db)
    await container_runner.stop_container(model_id)

    if not manager.delete_model(model_id):
        raise HTTPException(status_code=404, detail="External model not found")

    return {"message": "External model deleted", "model_id": model_id}


# ============================================================
# Container Build and Validation Endpoints
# ============================================================

@router.post("/external-models/{model_id}/build", response_model=ContainerBuildStatus)
async def build_external_model(
    model_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Build Docker image for an external model.

    Args:
        model_id: External model ID
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Build status
    """
    manager = ExternalModelManager(db)
    model = manager.get_model(model_id)

    if not model:
        raise HTTPException(status_code=404, detail="External model not found")

    if model.build_status == "building":
        raise HTTPException(status_code=400, detail="Build already in progress")

    # Update status to building
    manager.update_build_status(model_id, "building", 0, "Queued for build")

    # Start build in background
    container_runner = ContainerRunner(db)
    background_tasks.add_task(container_runner.build_image, model_id)

    return ContainerBuildStatus(
        model_id=model_id,
        status="building",
        progress=0,
        current_step="Queued for build",
        logs=[],
    )


@router.get("/external-models/{model_id}/build-status", response_model=ContainerBuildStatus)
async def get_build_status(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Get build status for an external model.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        Current build status
    """
    manager = ExternalModelManager(db)
    model = manager.get_model(model_id)

    if not model:
        raise HTTPException(status_code=404, detail="External model not found")

    # Parse logs into list
    logs = []
    if model.build_logs:
        logs = model.build_logs.split("\n")

    return ContainerBuildStatus(
        model_id=model_id,
        status=model.build_status,
        progress=model.build_progress,
        current_step=model.current_build_step,
        logs=logs[-50:],  # Last 50 lines
        completed_at=model.validated_at if model.build_status == "ready" else None,
        error_message=model.build_logs if model.build_status == "failed" else None,
    )


@router.post("/external-models/{model_id}/validate", response_model=EndpointValidationResponse)
async def validate_external_model(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Validate that the external model's /predict endpoint works.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        Validation result
    """
    manager = ExternalModelManager(db)
    model = manager.get_model(model_id)

    if not model:
        raise HTTPException(status_code=404, detail="External model not found")

    if model.build_status != "ready":
        raise HTTPException(status_code=400, detail="Model must be built before validation")

    container_runner = ContainerRunner(db)
    result = await container_runner.validate_endpoint(model_id)

    return EndpointValidationResponse(
        model_id=model_id,
        valid=result.get("valid", False),
        endpoint=result.get("endpoint", ""),
        response_time_ms=result.get("response_time_ms"),
        sample_input=result.get("sample_input"),
        sample_output=result.get("sample_output"),
        error_message=result.get("error"),
    )


# ============================================================
# Container Runtime Endpoints
# ============================================================

@router.post("/containers/{model_id}/start", response_model=ContainerStatusResponse)
async def start_container(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Start a container for an external model.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        Container status
    """
    manager = ExternalModelManager(db)
    model = manager.get_model(model_id)

    if not model:
        raise HTTPException(status_code=404, detail="External model not found")

    if model.build_status != "ready":
        raise HTTPException(status_code=400, detail="Model must be built before starting")

    container_runner = ContainerRunner(db)
    instance = await container_runner.start_container(model_id)

    if not instance:
        raise HTTPException(status_code=500, detail="Failed to start container")

    return ContainerStatusResponse(
        instance_id=instance.instance_id,
        model_id=model_id,
        status=instance.status,
        container_id=instance.container_id,
        host_port=instance.host_port,
        request_count=instance.request_count,
    )


@router.post("/containers/{model_id}/stop")
async def stop_container(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Stop a container for an external model.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        Stop confirmation
    """
    container_runner = ContainerRunner(db)
    await container_runner.stop_container(model_id)

    return {"message": "Container stopped", "model_id": model_id}


@router.get("/containers/{model_id}/status", response_model=ContainerStatusResponse)
async def get_container_status(
    model_id: str,
    db: Session = Depends(get_db),
):
    """
    Get container status for an external model.

    Args:
        model_id: External model ID
        db: Database session

    Returns:
        Container status
    """
    container_runner = ContainerRunner(db)
    status = container_runner.get_container_status(model_id)

    if status.get("status") == "not_created":
        raise HTTPException(status_code=404, detail="No container instance found")

    return ContainerStatusResponse(
        instance_id=status.get("instance_id", ""),
        model_id=model_id,
        status=status.get("status", "unknown"),
        container_id=status.get("container_id"),
        host_port=status.get("host_port"),
        request_count=status.get("request_count", 0),
        last_request_at=status.get("last_request_at"),
        uptime_seconds=status.get("uptime_seconds"),
    )


@router.post("/containers/{model_id}/predict", response_model=ContainerPredictionResponse)
async def proxy_prediction(
    model_id: str,
    request: ContainerPredictionRequest,
    db: Session = Depends(get_db),
):
    """
    Proxy a prediction request to an external model container.

    Args:
        model_id: External model ID
        request: Prediction request with data
        db: Database session

    Returns:
        Prediction results
    """
    manager = ExternalModelManager(db)
    model = manager.get_model(model_id)

    if not model:
        raise HTTPException(status_code=404, detail="External model not found")

    container_runner = ContainerRunner(db)

    try:
        predictions, inference_time = await container_runner.predict(model_id, request.data)

        return ContainerPredictionResponse(
            predictions=predictions,
            inference_time_ms=inference_time,
            model_id=model_id,
        )

    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Benchmark Endpoints
# ============================================================

@router.post("/benchmarks/start", response_model=BenchmarkStatusResponse)
async def start_benchmark(
    request: BenchmarkStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Start a benchmark comparison between platform and external models.

    Args:
        request: Benchmark configuration
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Benchmark status
    """
    # Validate training job exists
    job = db.query(TrainingJob).filter(TrainingJob.job_id == request.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Training job must be completed")

    # Validate external models
    for model_id in request.external_model_ids:
        model = db.query(ExternalModel).filter(ExternalModel.model_id == model_id).first()
        if not model:
            raise HTTPException(status_code=404, detail=f"External model not found: {model_id}")
        if model.build_status != "ready":
            raise HTTPException(
                status_code=400,
                detail=f"External model not ready: {model_id}"
            )

    try:
        service = BenchmarkService(db)
        benchmark = await service.start_benchmark(
            job_id=request.job_id,
            external_model_ids=request.external_model_ids,
            platform_model_ids=request.platform_model_ids,
            test_dataset_id=request.test_dataset_id,
            name=request.name,
        )

        # Run benchmark in background
        background_tasks.add_task(service.run_benchmark, benchmark.benchmark_id)

        return BenchmarkStatusResponse(
            benchmark_id=benchmark.benchmark_id,
            job_id=benchmark.job_id,
            status=benchmark.status,
            progress=benchmark.progress,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/benchmarks/{benchmark_id}/status", response_model=BenchmarkStatusResponse)
async def get_benchmark_status(
    benchmark_id: str,
    db: Session = Depends(get_db),
):
    """
    Get benchmark execution status.

    Args:
        benchmark_id: Benchmark ID
        db: Database session

    Returns:
        Current benchmark status
    """
    service = BenchmarkService(db)
    benchmark = service.get_benchmark(benchmark_id)

    if not benchmark:
        raise HTTPException(status_code=404, detail="Benchmark not found")

    return BenchmarkStatusResponse(
        benchmark_id=benchmark.benchmark_id,
        job_id=benchmark.job_id,
        status=benchmark.status,
        progress=benchmark.progress,
        current_model=benchmark.current_model,
        started_at=benchmark.started_at,
        completed_at=benchmark.completed_at,
        error_message=benchmark.error_message,
    )


@router.get("/benchmarks/{benchmark_id}/results", response_model=BenchmarkResultsResponse)
async def get_benchmark_results(
    benchmark_id: str,
    db: Session = Depends(get_db),
):
    """
    Get benchmark comparison results.

    Args:
        benchmark_id: Benchmark ID
        db: Database session

    Returns:
        Benchmark results with comparisons and visualizations
    """
    service = BenchmarkService(db)
    benchmark = service.get_benchmark(benchmark_id)

    if not benchmark:
        raise HTTPException(status_code=404, detail="Benchmark not found")

    if benchmark.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Benchmark not completed. Status: {benchmark.status}"
        )

    # Get job for task type
    job = db.query(TrainingJob).filter(TrainingJob.job_id == benchmark.job_id).first()
    from models.database import TrainingConfig
    config = db.query(TrainingConfig).filter(TrainingConfig.config_id == job.config_id).first()

    return service._format_results(benchmark, config.task_type, 0)


@router.get("/benchmarks", response_model=BenchmarkListResponse)
async def list_benchmarks(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List benchmarks with optional filtering.

    Args:
        job_id: Optional filter by training job
        status: Optional filter by status
        db: Database session

    Returns:
        List of benchmarks
    """
    service = BenchmarkService(db)
    benchmarks = service.list_benchmarks(job_id=job_id, status=status)

    return BenchmarkListResponse(
        benchmarks=[
            BenchmarkListItem(
                benchmark_id=b.benchmark_id,
                name=b.name,
                job_id=b.job_id,
                status=b.status,
                winner=b.winner,
                created_at=b.created_at,
                completed_at=b.completed_at,
            )
            for b in benchmarks
        ]
    )


@router.delete("/benchmarks/{benchmark_id}")
async def delete_benchmark(
    benchmark_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete a benchmark.

    Args:
        benchmark_id: Benchmark ID
        db: Database session

    Returns:
        Deletion confirmation
    """
    service = BenchmarkService(db)

    if not service.delete_benchmark(benchmark_id):
        raise HTTPException(status_code=404, detail="Benchmark not found")

    return {"message": "Benchmark deleted", "benchmark_id": benchmark_id}
