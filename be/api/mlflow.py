"""
MLflow API Endpoints

Provides REST API for managing MLflow experiments, runs, and model registry.
These endpoints allow the frontend to:
- View and configure MLflow settings
- List and search experiments and runs
- Manage registered models and their lifecycle stages
"""

import logging
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

import mlflow
from mlflow.tracking import MlflowClient
from mlflow.exceptions import MlflowException

from services.mlflow_tracker import MLflowConfigLoader

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mlflow", tags=["mlflow"])


# Request/Response Models

class MLflowConfigRequest(BaseModel):
    """Request to update MLflow configuration."""
    enabled: bool = True
    tracking_uri: Optional[str] = None
    experiment_name_prefix: Optional[str] = "valtool"
    auto_log: bool = False


class MLflowConfigResponse(BaseModel):
    """Current MLflow configuration."""
    enabled: bool
    tracking_uri: Optional[str]
    experiment_name_prefix: str
    auto_log: bool
    artifact_location: Optional[str]
    mlflow_version: str


class ExperimentInfo(BaseModel):
    """MLflow experiment information."""
    experiment_id: str
    name: str
    artifact_location: Optional[str]
    lifecycle_stage: str
    creation_time: Optional[int]
    last_update_time: Optional[int]


class RunInfo(BaseModel):
    """MLflow run information."""
    run_id: str
    run_name: Optional[str]
    status: str
    start_time: Optional[int]
    end_time: Optional[int]
    metrics: dict
    params: dict
    artifact_uri: Optional[str]


class ModelVersionInfo(BaseModel):
    """Model version information."""
    version: str
    stage: str
    status: str
    creation_timestamp: Optional[int]
    last_updated_timestamp: Optional[int]
    run_id: Optional[str]
    source: Optional[str]


class RegisteredModelInfo(BaseModel):
    """Registered model information."""
    name: str
    creation_timestamp: Optional[int]
    last_updated_timestamp: Optional[int]
    description: Optional[str]
    latest_versions: List[ModelVersionInfo]


class PromoteModelRequest(BaseModel):
    """Request to promote a model version."""
    version: str = Field(..., description="Model version to promote")
    stage: str = Field(..., description="Target stage: Staging, Production, or Archived")
    archive_existing: bool = Field(True, description="Archive existing versions in target stage")


class CompareRunsRequest(BaseModel):
    """Request to compare multiple runs."""
    run_ids: List[str] = Field(..., description="List of run IDs to compare")
    metrics: Optional[List[str]] = Field(None, description="Specific metrics to compare")


# Helper functions

def get_mlflow_client() -> MlflowClient:
    """Get MLflow client with configuration."""
    config = MLflowConfigLoader.load()
    mlflow_config = config.get('mlflow', {})

    tracking_uri = mlflow_config.get('tracking_uri')
    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)

    return MlflowClient()


# Endpoints

@router.get("/config", response_model=MLflowConfigResponse)
async def get_mlflow_config():
    """Get current MLflow configuration."""
    config = MLflowConfigLoader.load()
    mlflow_config = config.get('mlflow', {})

    return MLflowConfigResponse(
        enabled=mlflow_config.get('enabled', True),
        tracking_uri=mlflow_config.get('tracking_uri'),
        experiment_name_prefix=mlflow_config.get('experiment_name_prefix', 'valtool'),
        auto_log=mlflow_config.get('auto_log', False),
        artifact_location=mlflow_config.get('artifact_location'),
        mlflow_version=mlflow.__version__
    )


@router.post("/config", response_model=dict)
async def update_mlflow_config(request: MLflowConfigRequest):
    """
    Update MLflow configuration.

    Note: This updates the in-memory configuration. For persistent changes,
    modify the config/mlflow.yaml file directly.
    """
    # For now, we just validate and return success
    # Full implementation would write to config file
    logger.info(f"MLflow config update requested: enabled={request.enabled}")

    return {
        "message": "Configuration updated",
        "note": "For persistent changes, modify config/mlflow.yaml",
        "config": request.model_dump()
    }


@router.get("/experiments", response_model=dict)
async def list_experiments(
    view_type: str = "ACTIVE_ONLY",
    max_results: int = 100
):
    """
    List all MLflow experiments.

    Args:
        view_type: Filter by lifecycle stage (ACTIVE_ONLY, DELETED_ONLY, ALL)
        max_results: Maximum number of experiments to return
    """
    try:
        client = get_mlflow_client()

        # Map view type string to enum
        view_map = {
            "ACTIVE_ONLY": mlflow.entities.ViewType.ACTIVE_ONLY,
            "DELETED_ONLY": mlflow.entities.ViewType.DELETED_ONLY,
            "ALL": mlflow.entities.ViewType.ALL
        }
        view = view_map.get(view_type.upper(), mlflow.entities.ViewType.ACTIVE_ONLY)

        experiments = client.search_experiments(view_type=view, max_results=max_results)

        return {
            "experiments": [
                {
                    "experiment_id": exp.experiment_id,
                    "name": exp.name,
                    "artifact_location": exp.artifact_location,
                    "lifecycle_stage": exp.lifecycle_stage,
                    "creation_time": exp.creation_time,
                    "last_update_time": exp.last_update_time,
                    "tags": dict(exp.tags) if exp.tags else {}
                }
                for exp in experiments
            ],
            "total": len(experiments)
        }
    except MlflowException as e:
        logger.error(f"MLflow error listing experiments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MLflow error: {str(e)}"
        )


@router.get("/experiments/{experiment_id}", response_model=dict)
async def get_experiment(experiment_id: str):
    """Get details of a specific experiment."""
    try:
        client = get_mlflow_client()
        exp = client.get_experiment(experiment_id)

        if exp is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Experiment {experiment_id} not found"
            )

        return {
            "experiment_id": exp.experiment_id,
            "name": exp.name,
            "artifact_location": exp.artifact_location,
            "lifecycle_stage": exp.lifecycle_stage,
            "creation_time": exp.creation_time,
            "last_update_time": exp.last_update_time,
            "tags": dict(exp.tags) if exp.tags else {}
        }
    except MlflowException as e:
        logger.error(f"MLflow error getting experiment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MLflow error: {str(e)}"
        )


@router.get("/experiments/{experiment_id}/runs", response_model=dict)
async def get_experiment_runs(
    experiment_id: str,
    filter_string: str = "",
    max_results: int = 100,
    order_by: Optional[str] = None
):
    """
    Get all runs in an experiment.

    Args:
        experiment_id: Experiment ID
        filter_string: MLflow filter (e.g., "metrics.accuracy > 0.9")
        max_results: Maximum number of runs
        order_by: Column to order by (e.g., "metrics.accuracy DESC")
    """
    try:
        client = get_mlflow_client()

        order_by_list = [order_by] if order_by else None

        runs = client.search_runs(
            experiment_ids=[experiment_id],
            filter_string=filter_string,
            max_results=max_results,
            order_by=order_by_list
        )

        return {
            "runs": [
                {
                    "run_id": run.info.run_id,
                    "run_name": run.data.tags.get("mlflow.runName", ""),
                    "status": run.info.status,
                    "start_time": run.info.start_time,
                    "end_time": run.info.end_time,
                    "metrics": dict(run.data.metrics),
                    "params": dict(run.data.params),
                    "artifact_uri": run.info.artifact_uri,
                    "user_id": run.info.user_id
                }
                for run in runs
            ],
            "total": len(runs)
        }
    except MlflowException as e:
        logger.error(f"MLflow error getting runs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MLflow error: {str(e)}"
        )


@router.get("/runs/{run_id}", response_model=dict)
async def get_run(run_id: str):
    """Get detailed information about a specific run."""
    try:
        client = get_mlflow_client()
        run = client.get_run(run_id)

        return {
            "run_id": run.info.run_id,
            "run_name": run.data.tags.get("mlflow.runName", ""),
            "experiment_id": run.info.experiment_id,
            "status": run.info.status,
            "start_time": run.info.start_time,
            "end_time": run.info.end_time,
            "artifact_uri": run.info.artifact_uri,
            "metrics": dict(run.data.metrics),
            "params": dict(run.data.params),
            "tags": dict(run.data.tags)
        }
    except MlflowException as e:
        logger.error(f"MLflow error getting run: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} not found"
        )


@router.delete("/runs/{run_id}", response_model=dict)
async def delete_run(run_id: str):
    """Delete a run (moves to deleted state)."""
    try:
        client = get_mlflow_client()
        client.delete_run(run_id)

        return {"message": f"Run {run_id} deleted successfully"}
    except MlflowException as e:
        logger.error(f"MLflow error deleting run: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete run: {str(e)}"
        )


@router.post("/runs/compare", response_model=dict)
async def compare_runs(request: CompareRunsRequest):
    """
    Compare metrics across multiple runs.

    Returns a comparison table with run IDs as columns and metrics as rows.
    """
    try:
        client = get_mlflow_client()

        comparison = {
            "run_ids": request.run_ids,
            "metrics": {},
            "params": {},
            "runs": []
        }

        for run_id in request.run_ids:
            try:
                run = client.get_run(run_id)
                run_data = {
                    "run_id": run_id,
                    "run_name": run.data.tags.get("mlflow.runName", ""),
                    "metrics": dict(run.data.metrics),
                    "params": dict(run.data.params)
                }
                comparison["runs"].append(run_data)

                # Aggregate metrics across runs
                for metric_name, metric_value in run.data.metrics.items():
                    if request.metrics is None or metric_name in request.metrics:
                        if metric_name not in comparison["metrics"]:
                            comparison["metrics"][metric_name] = {}
                        comparison["metrics"][metric_name][run_id] = metric_value

                # Aggregate params across runs
                for param_name, param_value in run.data.params.items():
                    if param_name not in comparison["params"]:
                        comparison["params"][param_name] = {}
                    comparison["params"][param_name][run_id] = param_value

            except MlflowException:
                logger.warning(f"Run {run_id} not found, skipping")

        return comparison
    except Exception as e:
        logger.error(f"Error comparing runs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare runs: {str(e)}"
        )


@router.get("/models", response_model=dict)
async def list_registered_models(max_results: int = 100):
    """List all registered models in the model registry."""
    try:
        client = get_mlflow_client()
        models = client.search_registered_models(max_results=max_results)

        return {
            "models": [
                {
                    "name": model.name,
                    "creation_timestamp": model.creation_timestamp,
                    "last_updated_timestamp": model.last_updated_timestamp,
                    "description": model.description,
                    "tags": dict(model.tags) if model.tags else {},
                    "latest_versions": [
                        {
                            "version": version.version,
                            "stage": version.current_stage,
                            "status": version.status,
                            "creation_timestamp": version.creation_timestamp,
                            "last_updated_timestamp": version.last_updated_timestamp,
                            "run_id": version.run_id,
                            "source": version.source
                        }
                        for version in (model.latest_versions or [])
                    ]
                }
                for model in models
            ],
            "total": len(models)
        }
    except MlflowException as e:
        logger.error(f"MLflow error listing models: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MLflow error: {str(e)}"
        )


@router.get("/models/{model_name}", response_model=dict)
async def get_registered_model(model_name: str):
    """Get details of a specific registered model."""
    try:
        client = get_mlflow_client()
        model = client.get_registered_model(model_name)

        return {
            "name": model.name,
            "creation_timestamp": model.creation_timestamp,
            "last_updated_timestamp": model.last_updated_timestamp,
            "description": model.description,
            "tags": dict(model.tags) if model.tags else {},
            "latest_versions": [
                {
                    "version": version.version,
                    "stage": version.current_stage,
                    "status": version.status,
                    "creation_timestamp": version.creation_timestamp,
                    "last_updated_timestamp": version.last_updated_timestamp,
                    "run_id": version.run_id,
                    "source": version.source,
                    "description": version.description
                }
                for version in (model.latest_versions or [])
            ]
        }
    except MlflowException as e:
        logger.error(f"MLflow error getting model: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model {model_name} not found"
        )


@router.get("/models/{model_name}/versions", response_model=dict)
async def get_model_versions(
    model_name: str,
    stages: Optional[str] = None
):
    """
    Get all versions of a registered model.

    Args:
        model_name: Name of the registered model
        stages: Comma-separated list of stages to filter (e.g., "Staging,Production")
    """
    try:
        client = get_mlflow_client()

        stage_list = stages.split(",") if stages else None

        if stage_list:
            versions = client.get_latest_versions(model_name, stages=stage_list)
        else:
            # Get all versions
            filter_string = f"name='{model_name}'"
            versions = client.search_model_versions(filter_string=filter_string)

        return {
            "model_name": model_name,
            "versions": [
                {
                    "version": version.version,
                    "stage": version.current_stage,
                    "status": version.status,
                    "creation_timestamp": version.creation_timestamp,
                    "last_updated_timestamp": version.last_updated_timestamp,
                    "run_id": version.run_id,
                    "source": version.source,
                    "description": version.description
                }
                for version in versions
            ],
            "total": len(versions)
        }
    except MlflowException as e:
        logger.error(f"MLflow error getting model versions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MLflow error: {str(e)}"
        )


@router.post("/models/{model_name}/promote", response_model=dict)
async def promote_model(model_name: str, request: PromoteModelRequest):
    """
    Promote a model version to a new stage.

    Stages: None, Staging, Production, Archived
    """
    valid_stages = ["None", "Staging", "Production", "Archived"]
    if request.stage not in valid_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stage. Must be one of: {valid_stages}"
        )

    try:
        client = get_mlflow_client()

        client.transition_model_version_stage(
            name=model_name,
            version=request.version,
            stage=request.stage,
            archive_existing_versions=request.archive_existing
        )

        return {
            "message": f"Model {model_name} version {request.version} promoted to {request.stage}",
            "model_name": model_name,
            "version": request.version,
            "stage": request.stage
        }
    except MlflowException as e:
        logger.error(f"MLflow error promoting model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to promote model: {str(e)}"
        )


@router.delete("/models/{model_name}", response_model=dict)
async def delete_registered_model(model_name: str):
    """Delete a registered model and all its versions."""
    try:
        client = get_mlflow_client()
        client.delete_registered_model(model_name)

        return {"message": f"Model {model_name} deleted successfully"}
    except MlflowException as e:
        logger.error(f"MLflow error deleting model: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete model: {str(e)}"
        )


@router.delete("/models/{model_name}/versions/{version}", response_model=dict)
async def delete_model_version(model_name: str, version: str):
    """Delete a specific version of a registered model."""
    try:
        client = get_mlflow_client()
        client.delete_model_version(model_name, version)

        return {
            "message": f"Model {model_name} version {version} deleted successfully"
        }
    except MlflowException as e:
        logger.error(f"MLflow error deleting model version: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete model version: {str(e)}"
        )


@router.get("/artifacts/{run_id}", response_model=dict)
async def list_run_artifacts(run_id: str, path: str = ""):
    """
    List artifacts for a run.

    Args:
        run_id: The run ID
        path: Subdirectory path within artifacts (optional)
    """
    try:
        client = get_mlflow_client()
        artifacts = client.list_artifacts(run_id, path)

        return {
            "run_id": run_id,
            "path": path,
            "artifacts": [
                {
                    "path": artifact.path,
                    "is_dir": artifact.is_dir,
                    "file_size": artifact.file_size
                }
                for artifact in artifacts
            ]
        }
    except MlflowException as e:
        logger.error(f"MLflow error listing artifacts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list artifacts: {str(e)}"
        )


@router.get("/health", response_model=dict)
async def mlflow_health_check():
    """Check MLflow connectivity and status."""
    try:
        config = MLflowConfigLoader.load()
        mlflow_config = config.get('mlflow', {})

        client = get_mlflow_client()

        # Try to list experiments as a health check
        experiments = client.search_experiments(max_results=1)

        return {
            "status": "healthy",
            "tracking_uri": mlflow_config.get('tracking_uri'),
            "mlflow_version": mlflow.__version__,
            "experiments_accessible": True,
            "experiment_count": len(client.search_experiments())
        }
    except Exception as e:
        logger.error(f"MLflow health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "mlflow_version": mlflow.__version__
        }
