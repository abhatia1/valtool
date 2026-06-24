"""
Native Model Manager Service

Handles uploading, validating, and running inference on native scikit-learn
compatible models (pickle/joblib files) for benchmarking.
"""

import pickle
import json
import uuid
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

import numpy as np
from sqlalchemy.orm import Session

from models.database import ExternalModel
from core.config import settings


# Allowed file extensions for native models
ALLOWED_MODEL_EXTENSIONS = {".pkl", ".joblib", ".pickle"}


class NativeModelManager:
    """Manages native sklearn model uploads and inference."""

    def __init__(self, storage_path: Optional[str] = None):
        """Initialize the native model manager.

        Args:
            storage_path: Base path for storing external models.
        """
        self.storage_path = Path(storage_path or settings.EXTERNAL_MODELS_PATH)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _get_model_dir(self, model_id: str) -> Path:
        """Get the directory for a specific model."""
        return self.storage_path / model_id / "native"

    def _validate_file_extension(self, filename: str) -> bool:
        """Check if file has allowed extension."""
        return Path(filename).suffix.lower() in ALLOWED_MODEL_EXTENSIONS

    def validate_model_file(self, file_path: Path) -> Dict[str, Any]:
        """Validate a pickle/joblib model file.

        Args:
            file_path: Path to the model file.

        Returns:
            Dict with validation results including model type and capabilities.
        """
        result = {
            "is_valid": False,
            "model_type": None,
            "has_predict": False,
            "has_predict_proba": False,
            "has_transform": False,
            "errors": [],
            "warnings": []
        }

        if not file_path.exists():
            result["errors"].append(f"File not found: {file_path}")
            return result

        # Check file size (max 500MB)
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        if file_size_mb > 500:
            result["errors"].append(f"File too large: {file_size_mb:.1f}MB (max 500MB)")
            return result

        try:
            # Try to load the model
            with open(file_path, "rb") as f:
                model = pickle.load(f)

            # Get model type
            result["model_type"] = type(model).__name__

            # Check for predict method (required for models)
            if hasattr(model, "predict") and callable(getattr(model, "predict")):
                result["has_predict"] = True

            # Check for predict_proba (optional, for classification)
            if hasattr(model, "predict_proba") and callable(getattr(model, "predict_proba")):
                result["has_predict_proba"] = True

            # Check for transform method (for preprocessors)
            if hasattr(model, "transform") and callable(getattr(model, "transform")):
                result["has_transform"] = True

            # Model must have either predict or transform
            if result["has_predict"] or result["has_transform"]:
                result["is_valid"] = True
            else:
                result["errors"].append("Model must have 'predict' or 'transform' method")

            # Warnings for missing methods
            if result["has_predict"] and not result["has_predict_proba"]:
                result["warnings"].append("Model does not have 'predict_proba' method - probability outputs will not be available")

        except pickle.UnpicklingError as e:
            result["errors"].append(f"Invalid pickle file: {str(e)}")
        except Exception as e:
            result["errors"].append(f"Error loading model: {str(e)}")

        return result

    def validate_preprocessor_file(self, file_path: Path) -> Dict[str, Any]:
        """Validate a preprocessor file.

        Args:
            file_path: Path to the preprocessor file.

        Returns:
            Dict with validation results.
        """
        result = {
            "is_valid": False,
            "preprocessor_type": None,
            "has_transform": False,
            "has_fit_transform": False,
            "feature_names": None,
            "errors": [],
            "warnings": []
        }

        if not file_path.exists():
            result["errors"].append(f"File not found: {file_path}")
            return result

        try:
            with open(file_path, "rb") as f:
                preprocessor = pickle.load(f)

            result["preprocessor_type"] = type(preprocessor).__name__

            # Check for transform method (required)
            if hasattr(preprocessor, "transform") and callable(getattr(preprocessor, "transform")):
                result["has_transform"] = True
                result["is_valid"] = True
            else:
                result["errors"].append("Preprocessor must have 'transform' method")

            # Check for fit_transform
            if hasattr(preprocessor, "fit_transform"):
                result["has_fit_transform"] = True

            # Try to extract feature names
            if hasattr(preprocessor, "get_feature_names_out"):
                try:
                    result["feature_names"] = list(preprocessor.get_feature_names_out())
                except Exception:
                    pass
            elif hasattr(preprocessor, "feature_names_in_"):
                result["feature_names"] = list(preprocessor.feature_names_in_)

        except Exception as e:
            result["errors"].append(f"Error loading preprocessor: {str(e)}")

        return result

    def validate_encoder_file(self, file_path: Path, encoder_type: str = "label") -> Dict[str, Any]:
        """Validate a label encoder or target scaler file.

        Args:
            file_path: Path to the encoder/scaler file.
            encoder_type: Either "label" or "scaler".

        Returns:
            Dict with validation results.
        """
        result = {
            "is_valid": False,
            "encoder_type": None,
            "classes": None,
            "errors": [],
            "warnings": []
        }

        if not file_path.exists():
            result["errors"].append(f"File not found: {file_path}")
            return result

        try:
            with open(file_path, "rb") as f:
                encoder = pickle.load(f)

            result["encoder_type"] = type(encoder).__name__

            if encoder_type == "label":
                # Label encoder should have transform and inverse_transform
                if hasattr(encoder, "transform") and hasattr(encoder, "inverse_transform"):
                    result["is_valid"] = True
                    if hasattr(encoder, "classes_"):
                        result["classes"] = list(encoder.classes_)
                else:
                    result["errors"].append("Label encoder must have 'transform' and 'inverse_transform' methods")
            else:
                # Scaler should have transform and inverse_transform
                if hasattr(encoder, "transform") and hasattr(encoder, "inverse_transform"):
                    result["is_valid"] = True
                else:
                    result["errors"].append("Target scaler must have 'transform' and 'inverse_transform' methods")

        except Exception as e:
            result["errors"].append(f"Error loading encoder: {str(e)}")

        return result

    async def upload_native_model(
        self,
        db: Session,
        name: str,
        task_type: str,
        model_file_content: bytes,
        model_filename: str,
        description: Optional[str] = None,
        preprocessor_content: Optional[bytes] = None,
        preprocessor_filename: Optional[str] = None,
        label_encoder_content: Optional[bytes] = None,
        label_encoder_filename: Optional[str] = None,
        target_scaler_content: Optional[bytes] = None,
        target_scaler_filename: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ExternalModel:
        """Upload a native sklearn model with optional preprocessor and encoders.

        Args:
            db: Database session.
            name: Model name.
            task_type: Either "classification" or "regression".
            model_file_content: Model file bytes.
            model_filename: Original model filename.
            description: Optional description.
            preprocessor_content: Optional preprocessor file bytes.
            preprocessor_filename: Original preprocessor filename.
            label_encoder_content: Optional label encoder bytes (classification).
            label_encoder_filename: Original label encoder filename.
            target_scaler_content: Optional target scaler bytes (regression).
            target_scaler_filename: Original target scaler filename.
            metadata: Optional metadata dict with feature_names, class_names, etc.

        Returns:
            Created ExternalModel instance.

        Raises:
            ValueError: If validation fails.
        """
        model_id = str(uuid.uuid4())
        model_dir = self._get_model_dir(model_id)
        model_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Save and validate model file
            model_ext = Path(model_filename).suffix.lower() or ".pkl"
            model_path = model_dir / f"model{model_ext}"
            model_path.write_bytes(model_file_content)

            model_validation = self.validate_model_file(model_path)
            if not model_validation["is_valid"]:
                raise ValueError(f"Invalid model file: {'; '.join(model_validation['errors'])}")

            # Initialize paths
            preprocessor_path = None
            label_encoder_path = None
            target_scaler_path = None
            feature_names = metadata.get("feature_names") if metadata else None
            class_names = metadata.get("class_names") if metadata else None

            # Save and validate preprocessor if provided
            if preprocessor_content:
                prep_ext = Path(preprocessor_filename).suffix.lower() if preprocessor_filename else ".pkl"
                preprocessor_path = model_dir / f"preprocessor{prep_ext}"
                preprocessor_path.write_bytes(preprocessor_content)

                prep_validation = self.validate_preprocessor_file(preprocessor_path)
                if not prep_validation["is_valid"]:
                    raise ValueError(f"Invalid preprocessor file: {'; '.join(prep_validation['errors'])}")

                # Extract feature names from preprocessor if not provided
                if not feature_names and prep_validation.get("feature_names"):
                    feature_names = prep_validation["feature_names"]

            # Save and validate label encoder if provided (classification only)
            if label_encoder_content and task_type == "classification":
                enc_ext = Path(label_encoder_filename).suffix.lower() if label_encoder_filename else ".pkl"
                label_encoder_path = model_dir / f"label_encoder{enc_ext}"
                label_encoder_path.write_bytes(label_encoder_content)

                enc_validation = self.validate_encoder_file(label_encoder_path, "label")
                if not enc_validation["is_valid"]:
                    raise ValueError(f"Invalid label encoder file: {'; '.join(enc_validation['errors'])}")

                # Extract class names from encoder if not provided
                if not class_names and enc_validation.get("classes"):
                    class_names = enc_validation["classes"]

            # Save and validate target scaler if provided (regression only)
            if target_scaler_content and task_type == "regression":
                scaler_ext = Path(target_scaler_filename).suffix.lower() if target_scaler_filename else ".pkl"
                target_scaler_path = model_dir / f"target_scaler{scaler_ext}"
                target_scaler_path.write_bytes(target_scaler_content)

                scaler_validation = self.validate_encoder_file(target_scaler_path, "scaler")
                if not scaler_validation["is_valid"]:
                    raise ValueError(f"Invalid target scaler file: {'; '.join(scaler_validation['errors'])}")

            # Save metadata if provided
            if metadata:
                metadata_path = model_dir / "metadata.json"
                with open(metadata_path, "w") as f:
                    json.dump(metadata, f, indent=2)

            # Create database record
            external_model = ExternalModel(
                model_id=model_id,
                name=name,
                description=description,
                task_type=task_type,
                model_source="native",
                # Native model paths
                native_model_path=str(model_path),
                native_preprocessor_path=str(preprocessor_path) if preprocessor_path else None,
                native_label_encoder_path=str(label_encoder_path) if label_encoder_path else None,
                native_target_scaler_path=str(target_scaler_path) if target_scaler_path else None,
                # Metadata
                feature_names=feature_names,
                class_names=class_names,
                # Status - native models are immediately ready (no build needed)
                build_status="ready",
                build_progress=100,
                current_build_step="Ready",
                validated_at=datetime.utcnow()
            )

            db.add(external_model)
            db.commit()
            db.refresh(external_model)

            return external_model

        except Exception as e:
            # Cleanup on failure
            if model_dir.exists():
                shutil.rmtree(model_dir)
            db.rollback()
            raise

    def load_native_model(self, model: ExternalModel) -> Dict[str, Any]:
        """Load a native model and its components for inference.

        Args:
            model: ExternalModel database record.

        Returns:
            Dict with loaded model components.

        Raises:
            ValueError: If model is not a native model or files not found.
        """
        if model.model_source != "native":
            raise ValueError(f"Model {model.model_id} is not a native model")

        components = {
            "model": None,
            "preprocessor": None,
            "label_encoder": None,
            "target_scaler": None
        }

        # Load model (required)
        if not model.native_model_path:
            raise ValueError("Native model path not set")

        model_path = Path(model.native_model_path)
        if not model_path.exists():
            raise ValueError(f"Model file not found: {model_path}")

        with open(model_path, "rb") as f:
            components["model"] = pickle.load(f)

        # Load preprocessor (optional)
        if model.native_preprocessor_path:
            prep_path = Path(model.native_preprocessor_path)
            if prep_path.exists():
                with open(prep_path, "rb") as f:
                    components["preprocessor"] = pickle.load(f)

        # Load label encoder (optional, classification only)
        if model.native_label_encoder_path:
            enc_path = Path(model.native_label_encoder_path)
            if enc_path.exists():
                with open(enc_path, "rb") as f:
                    components["label_encoder"] = pickle.load(f)

        # Load target scaler (optional, regression only)
        if model.native_target_scaler_path:
            scaler_path = Path(model.native_target_scaler_path)
            if scaler_path.exists():
                with open(scaler_path, "rb") as f:
                    components["target_scaler"] = pickle.load(f)

        return components

    def predict_native(
        self,
        model: ExternalModel,
        X: np.ndarray,
        return_proba: bool = False
    ) -> Tuple[np.ndarray, float, Optional[np.ndarray]]:
        """Make predictions using a native model.

        Args:
            model: ExternalModel database record.
            X: Input features as numpy array.
            return_proba: Whether to return probabilities (classification only).

        Returns:
            Tuple of (predictions, inference_time_ms, probabilities or None).
        """
        components = self.load_native_model(model)

        start_time = time.time()

        # Apply preprocessor if available
        X_processed = X
        if components["preprocessor"] is not None:
            X_processed = components["preprocessor"].transform(X)

        # Make predictions
        predictions = components["model"].predict(X_processed)

        # Get probabilities if requested and available
        probabilities = None
        if return_proba and hasattr(components["model"], "predict_proba"):
            try:
                probabilities = components["model"].predict_proba(X_processed)
            except Exception:
                pass

        inference_time_ms = (time.time() - start_time) * 1000

        return predictions, inference_time_ms, probabilities

    def delete_native_model(self, model: ExternalModel) -> bool:
        """Delete native model files.

        Args:
            model: ExternalModel database record.

        Returns:
            True if deleted successfully.
        """
        if model.model_source != "native":
            return False

        model_dir = self._get_model_dir(model.model_id)
        if model_dir.exists():
            shutil.rmtree(model_dir)
            return True

        return False


# Singleton instance
native_model_manager = NativeModelManager()
