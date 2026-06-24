"""
External Model Manager Service

Handles upload, validation, and management of external Docker container models.
"""

import os
import shutil
import uuid
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.orm import Session

from models.database import ExternalModel
from services.security_validator import SecurityValidator

logger = logging.getLogger(__name__)

# Storage paths (will be imported from config later)
EXTERNAL_MODELS_PATH = "./storage/external_models"
BENCHMARKS_PATH = "./storage/benchmarks"


class ExternalModelManager:
    """Manages external Docker container models for benchmarking."""

    def __init__(self, db: Session):
        """
        Initialize the external model manager.

        Args:
            db: Database session
        """
        self.db = db
        self.security_validator = SecurityValidator()
        self._ensure_storage_dirs()

    def _ensure_storage_dirs(self):
        """Ensure storage directories exist."""
        os.makedirs(EXTERNAL_MODELS_PATH, exist_ok=True)
        os.makedirs(BENCHMARKS_PATH, exist_ok=True)

    def _get_model_dir(self, model_id: str) -> str:
        """Get the directory path for a model."""
        return os.path.join(EXTERNAL_MODELS_PATH, model_id)

    async def upload_model(
        self,
        name: str,
        task_type: str,
        dockerfile: UploadFile,
        requirements: Optional[UploadFile] = None,
        model_files: Optional[List[UploadFile]] = None,
        description: Optional[str] = None,
    ) -> ExternalModel:
        """
        Upload an external model with its Dockerfile and files.

        Args:
            name: Model name
            task_type: Task type (classification, regression)
            dockerfile: Dockerfile upload
            requirements: Optional requirements.txt upload
            model_files: Optional list of model files
            description: Optional description

        Returns:
            Created ExternalModel instance
        """
        # Generate model ID and create directory
        model_id = str(uuid.uuid4())
        model_dir = self._get_model_dir(model_id)
        os.makedirs(model_dir, exist_ok=True)

        try:
            # Save Dockerfile
            dockerfile_path = os.path.join(model_dir, "Dockerfile")
            content = await dockerfile.read()
            with open(dockerfile_path, "wb") as f:
                f.write(content)

            # Validate Dockerfile
            is_valid, issues = self.security_validator.validate_dockerfile(dockerfile_path)
            if not is_valid:
                # Clean up and raise error
                shutil.rmtree(model_dir)
                raise ValueError(f"Dockerfile validation failed: {'; '.join(issues)}")

            # Save requirements.txt if provided
            requirements_path = None
            if requirements:
                requirements_path = os.path.join(model_dir, "requirements.txt")
                content = await requirements.read()
                with open(requirements_path, "wb") as f:
                    f.write(content)

            # Create model files directory and save files
            model_files_dir = os.path.join(model_dir, "model_files")
            os.makedirs(model_files_dir, exist_ok=True)
            if model_files:
                for model_file in model_files:
                    file_path = os.path.join(model_files_dir, model_file.filename)
                    content = await model_file.read()
                    with open(file_path, "wb") as f:
                        f.write(content)

            # Create database record
            external_model = ExternalModel(
                model_id=model_id,
                name=name,
                description=description,
                task_type=task_type,
                dockerfile_path=dockerfile_path,
                requirements_path=requirements_path,
                model_files_path=model_files_dir,
                build_status="pending",
                created_at=datetime.utcnow(),
            )

            self.db.add(external_model)
            self.db.commit()
            self.db.refresh(external_model)

            logger.info(f"External model uploaded: {model_id} ({name})")
            return external_model

        except Exception as e:
            # Clean up on error
            if os.path.exists(model_dir):
                shutil.rmtree(model_dir)
            raise e

    def validate_dockerfile(self, dockerfile_path: str) -> Dict[str, Any]:
        """
        Validate a Dockerfile for security issues.

        Args:
            dockerfile_path: Path to the Dockerfile

        Returns:
            Validation result dictionary
        """
        is_valid, issues = self.security_validator.validate_dockerfile(dockerfile_path)
        return {
            "valid": is_valid,
            "issues": issues,
        }

    def get_model(self, model_id: str) -> Optional[ExternalModel]:
        """
        Get an external model by ID.

        Args:
            model_id: Model ID

        Returns:
            ExternalModel instance or None
        """
        return self.db.query(ExternalModel).filter(
            ExternalModel.model_id == model_id
        ).first()

    def list_models(
        self,
        task_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[ExternalModel]:
        """
        List external models with optional filtering.

        Args:
            task_type: Optional task type filter
            status: Optional status filter

        Returns:
            List of ExternalModel instances
        """
        query = self.db.query(ExternalModel)

        if task_type:
            query = query.filter(ExternalModel.task_type == task_type)

        if status:
            query = query.filter(ExternalModel.build_status == status)

        return query.order_by(ExternalModel.created_at.desc()).all()

    def update_model(
        self,
        model_id: str,
        **kwargs,
    ) -> Optional[ExternalModel]:
        """
        Update an external model.

        Args:
            model_id: Model ID
            **kwargs: Fields to update

        Returns:
            Updated ExternalModel instance or None
        """
        model = self.get_model(model_id)
        if not model:
            return None

        # Update allowed fields
        allowed_fields = {
            "name", "description", "build_status", "build_logs",
            "build_progress", "current_build_step", "image_name", "image_id",
            "security_scan_status", "vulnerability_count",
            "cpu_limit", "memory_limit", "timeout_seconds", "idle_timeout_seconds",
            "validated_at",
        }

        for field, value in kwargs.items():
            if field in allowed_fields and hasattr(model, field):
                setattr(model, field, value)

        model.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(model)

        return model

    def update_build_status(
        self,
        model_id: str,
        status: str,
        progress: int = 0,
        current_step: Optional[str] = None,
        logs: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Optional[ExternalModel]:
        """
        Update the build status of a model.

        Args:
            model_id: Model ID
            status: New status
            progress: Build progress percentage
            current_step: Current build step description
            logs: Build logs to append
            error_message: Error message if failed

        Returns:
            Updated ExternalModel instance or None
        """
        model = self.get_model(model_id)
        if not model:
            return None

        model.build_status = status
        model.build_progress = progress
        model.current_build_step = current_step

        if logs:
            existing_logs = model.build_logs or ""
            model.build_logs = existing_logs + logs

        if status == "failed" and error_message:
            model.build_logs = (model.build_logs or "") + f"\nERROR: {error_message}"

        if status == "ready":
            model.validated_at = datetime.utcnow()

        model.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(model)

        return model

    def delete_model(self, model_id: str) -> bool:
        """
        Delete an external model and its files.

        Args:
            model_id: Model ID

        Returns:
            True if deleted, False if not found
        """
        model = self.get_model(model_id)
        if not model:
            return False

        # Delete model directory
        model_dir = self._get_model_dir(model_id)
        if os.path.exists(model_dir):
            shutil.rmtree(model_dir)

        # Delete database record
        self.db.delete(model)
        self.db.commit()

        logger.info(f"External model deleted: {model_id}")
        return True

    def get_model_files_info(self, model_id: str) -> Dict[str, Any]:
        """
        Get information about model files.

        Args:
            model_id: Model ID

        Returns:
            Dictionary with file information
        """
        model = self.get_model(model_id)
        if not model:
            return {"error": "Model not found"}

        model_dir = self._get_model_dir(model_id)
        files_info = {
            "dockerfile_exists": os.path.exists(model.dockerfile_path or ""),
            "requirements_exists": os.path.exists(model.requirements_path or ""),
            "model_files": [],
        }

        if model.model_files_path and os.path.exists(model.model_files_path):
            for filename in os.listdir(model.model_files_path):
                filepath = os.path.join(model.model_files_path, filename)
                files_info["model_files"].append({
                    "name": filename,
                    "size": os.path.getsize(filepath),
                })

        return files_info
