"""
MLflow Tracker Service

Provides a centralized wrapper for MLflow experiment tracking, model logging,
and model registry operations. This service can be used across all training
pipelines (classification, regression, time series).
"""

import os
import logging
from typing import Any, Dict, List, Optional, Union
from contextlib import contextmanager
from pathlib import Path

import yaml
import mlflow
import mlflow.sklearn
from mlflow.tracking import MlflowClient
from mlflow.entities import ViewType
import pandas as pd
import numpy as np

try:
    import matplotlib.pyplot as plt
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

try:
    from sklearn.metrics import confusion_matrix
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

logger = logging.getLogger(__name__)


class MLflowTracker:
    """
    MLflow experiment tracking wrapper.

    Provides simplified interface for:
    - Experiment creation and management
    - Run lifecycle (start, log, end)
    - Metric and parameter logging
    - Model artifact logging
    - Visualization logging
    - Model registry operations
    """

    def __init__(
        self,
        experiment_name: str,
        tracking_uri: Optional[str] = None,
        artifact_location: Optional[str] = None,
        auto_log: bool = False
    ):
        """
        Initialize MLflow tracker.

        Args:
            experiment_name: Name of the MLflow experiment
            tracking_uri: MLflow tracking server URI (default: local file store)
            artifact_location: Location for storing artifacts
            auto_log: Enable automatic sklearn logging
        """
        self.experiment_name = experiment_name
        self.tracking_uri = tracking_uri
        self.artifact_location = artifact_location
        self.auto_log = auto_log

        self.client: Optional[MlflowClient] = None
        self.experiment_id: Optional[str] = None
        self.active_run_id: Optional[str] = None

        self._initialize()

    def _initialize(self) -> None:
        """Initialize MLflow configuration and experiment."""
        # Set tracking URI
        if self.tracking_uri:
            mlflow.set_tracking_uri(self.tracking_uri)

        # Initialize client
        self.client = MlflowClient()

        # Get or create experiment
        self.experiment_id = self._get_or_create_experiment()

        # Enable autologging if requested
        if self.auto_log:
            mlflow.sklearn.autolog(log_models=True, log_input_examples=True)

        logger.info(
            f"MLflow tracker initialized: experiment='{self.experiment_name}', "
            f"experiment_id={self.experiment_id}"
        )

    def _get_or_create_experiment(self) -> str:
        """Get existing experiment or create new one."""
        experiment = mlflow.get_experiment_by_name(self.experiment_name)

        if experiment is None:
            experiment_id = mlflow.create_experiment(
                self.experiment_name,
                artifact_location=self.artifact_location
            )
            logger.info(f"Created new experiment: {self.experiment_name}")
        else:
            experiment_id = experiment.experiment_id
            logger.info(f"Using existing experiment: {self.experiment_name}")

        return experiment_id

    @contextmanager
    def start_run(
        self,
        run_name: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
        nested: bool = False
    ):
        """
        Context manager for MLflow run.

        Args:
            run_name: Optional name for the run
            tags: Optional tags to add to the run
            nested: Whether this is a nested run

        Yields:
            MLflow run object
        """
        run = mlflow.start_run(
            experiment_id=self.experiment_id,
            run_name=run_name,
            nested=nested
        )

        try:
            self.active_run_id = run.info.run_id

            # Set tags if provided
            if tags:
                mlflow.set_tags(tags)

            yield run
        finally:
            mlflow.end_run()
            if not nested:
                self.active_run_id = None

    def log_params(self, params: Dict[str, Any]) -> None:
        """
        Log parameters to current run.

        Args:
            params: Dictionary of parameters to log
        """
        # MLflow has limits on param values - truncate if needed
        safe_params = {}
        for key, value in params.items():
            str_value = str(value)
            if len(str_value) > 500:
                str_value = str_value[:497] + "..."
            safe_params[key] = str_value

        mlflow.log_params(safe_params)

    def log_metrics(
        self,
        metrics: Dict[str, Union[int, float]],
        step: Optional[int] = None
    ) -> None:
        """
        Log metrics to current run.

        Args:
            metrics: Dictionary of metric name to value
            step: Optional step number for time-series metrics
        """
        # Filter out non-numeric values
        numeric_metrics = {
            k: v for k, v in metrics.items()
            if isinstance(v, (int, float)) and not np.isnan(v)
        }

        mlflow.log_metrics(numeric_metrics, step=step)

    def log_metric(
        self,
        key: str,
        value: Union[int, float],
        step: Optional[int] = None
    ) -> None:
        """
        Log a single metric.

        Args:
            key: Metric name
            value: Metric value
            step: Optional step number
        """
        if isinstance(value, (int, float)) and not np.isnan(value):
            mlflow.log_metric(key, value, step=step)

    def log_model(
        self,
        model: Any,
        artifact_path: str,
        registered_model_name: Optional[str] = None,
        input_example: Optional[Any] = None
    ) -> None:
        """
        Log sklearn model to MLflow.

        Args:
            model: Trained sklearn model or pipeline
            artifact_path: Path within artifacts to store model
            registered_model_name: Optional name to register in model registry
            input_example: Optional input example for model signature
        """
        mlflow.sklearn.log_model(
            model,
            artifact_path,
            registered_model_name=registered_model_name,
            input_example=input_example
        )

    def log_artifact(self, local_path: str, artifact_path: Optional[str] = None) -> None:
        """
        Log a local file as an artifact.

        Args:
            local_path: Path to local file
            artifact_path: Optional subdirectory in artifacts
        """
        mlflow.log_artifact(local_path, artifact_path)

    def log_dict(self, data: Dict, artifact_file: str) -> None:
        """
        Log a dictionary as a JSON artifact.

        Args:
            data: Dictionary to log
            artifact_file: Filename for the artifact (e.g., "config.json")
        """
        mlflow.log_dict(data, artifact_file)

    def log_text(self, text: str, artifact_file: str) -> None:
        """
        Log text as an artifact.

        Args:
            text: Text content to log
            artifact_file: Filename for the artifact
        """
        mlflow.log_text(text, artifact_file)

    def log_figure(self, figure: Any, artifact_file: str) -> None:
        """
        Log matplotlib figure as artifact.

        Args:
            figure: Matplotlib figure object
            artifact_file: Filename for the artifact (e.g., "plot.png")
        """
        if HAS_MATPLOTLIB:
            mlflow.log_figure(figure, artifact_file)

    def log_confusion_matrix(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        class_names: Optional[List[str]] = None,
        artifact_name: str = "confusion_matrix.png"
    ) -> None:
        """
        Log confusion matrix as artifact.

        Args:
            y_true: True labels
            y_pred: Predicted labels
            class_names: Optional list of class names
            artifact_name: Filename for the artifact
        """
        if not HAS_MATPLOTLIB or not HAS_SKLEARN:
            logger.warning("Matplotlib or sklearn not available for confusion matrix")
            return

        try:
            import seaborn as sns

            cm = confusion_matrix(y_true, y_pred)

            fig, ax = plt.subplots(figsize=(10, 8))
            sns.heatmap(
                cm,
                annot=True,
                fmt='d',
                cmap='Blues',
                xticklabels=class_names,
                yticklabels=class_names,
                ax=ax
            )
            ax.set_title('Confusion Matrix')
            ax.set_ylabel('True Label')
            ax.set_xlabel('Predicted Label')

            mlflow.log_figure(fig, artifact_name)
            plt.close(fig)
        except Exception as e:
            logger.warning(f"Failed to log confusion matrix: {e}")

    def log_feature_importance(
        self,
        feature_names: List[str],
        importances: np.ndarray,
        top_n: int = 20,
        artifact_name: str = "feature_importance.png"
    ) -> None:
        """
        Log feature importance bar chart as artifact.

        Args:
            feature_names: List of feature names
            importances: Array of importance values
            top_n: Number of top features to show
            artifact_name: Filename for the artifact
        """
        if not HAS_MATPLOTLIB:
            logger.warning("Matplotlib not available for feature importance plot")
            return

        try:
            # Create importance dict and sort
            importance_dict = dict(zip(feature_names, importances))
            sorted_features = sorted(
                importance_dict.items(),
                key=lambda x: x[1],
                reverse=True
            )[:top_n]

            fig, ax = plt.subplots(figsize=(10, 8))
            names = [f[0] for f in sorted_features]
            values = [f[1] for f in sorted_features]

            ax.barh(range(len(names)), values, align='center')
            ax.set_yticks(range(len(names)))
            ax.set_yticklabels(names)
            ax.invert_yaxis()  # Top feature at top
            ax.set_xlabel('Importance')
            ax.set_title(f'Top {top_n} Feature Importances')

            plt.tight_layout()
            mlflow.log_figure(fig, artifact_name)
            plt.close(fig)
        except Exception as e:
            logger.warning(f"Failed to log feature importance: {e}")

    def log_dataset_info(
        self,
        df: pd.DataFrame,
        target_column: str,
        dataset_name: str = "training_data"
    ) -> None:
        """
        Log dataset information as parameters.

        Args:
            df: Dataset DataFrame
            target_column: Name of target column
            dataset_name: Name identifier for the dataset
        """
        params = {
            f'{dataset_name}_n_samples': len(df),
            f'{dataset_name}_n_features': len(df.columns) - 1,
            f'{dataset_name}_target_column': target_column,
        }

        if target_column in df.columns:
            n_unique = df[target_column].nunique()
            params[f'{dataset_name}_n_classes'] = n_unique
            params[f'{dataset_name}_class_balance'] = df[target_column].value_counts().to_dict()

        # Log numeric stats
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        params[f'{dataset_name}_n_numeric_features'] = len(numeric_cols)

        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        params[f'{dataset_name}_n_categorical_features'] = len(categorical_cols)

        # Log missing value info
        missing = df.isnull().sum().sum()
        params[f'{dataset_name}_missing_values'] = int(missing)

        self.log_params(params)

    def set_tag(self, key: str, value: str) -> None:
        """Set a single tag on the current run."""
        mlflow.set_tag(key, value)

    def set_tags(self, tags: Dict[str, str]) -> None:
        """Set multiple tags on the current run."""
        mlflow.set_tags(tags)

    # Model Registry Methods

    def register_model(
        self,
        model_name: str,
        run_id: Optional[str] = None,
        artifact_path: str = "model"
    ) -> str:
        """
        Register a model from a run to the model registry.

        Args:
            model_name: Name for the registered model
            run_id: Run ID containing the model (default: current run)
            artifact_path: Path to model artifact within run

        Returns:
            Version number of registered model
        """
        if run_id is None:
            run_id = self.active_run_id or mlflow.active_run().info.run_id

        model_uri = f"runs:/{run_id}/{artifact_path}"
        result = mlflow.register_model(model_uri, model_name)

        logger.info(f"Registered model '{model_name}' version {result.version}")
        return result.version

    def transition_model_stage(
        self,
        model_name: str,
        version: Union[int, str],
        stage: str,
        archive_existing: bool = True
    ) -> None:
        """
        Transition a model version to a new stage.

        Args:
            model_name: Name of the registered model
            version: Version number to transition
            stage: Target stage ("Staging", "Production", "Archived")
            archive_existing: Whether to archive existing versions in target stage
        """
        self.client.transition_model_version_stage(
            name=model_name,
            version=str(version),
            stage=stage,
            archive_existing_versions=archive_existing
        )
        logger.info(f"Transitioned {model_name} v{version} to {stage}")

    def get_latest_model_version(
        self,
        model_name: str,
        stage: Optional[str] = None
    ) -> Optional[str]:
        """
        Get the latest version of a registered model.

        Args:
            model_name: Name of the registered model
            stage: Optional stage filter

        Returns:
            Latest version number or None if not found
        """
        try:
            if stage:
                versions = self.client.get_latest_versions(model_name, stages=[stage])
            else:
                versions = self.client.get_latest_versions(model_name)

            if versions:
                return versions[0].version
        except Exception as e:
            logger.warning(f"Failed to get model version: {e}")

        return None

    def load_model(
        self,
        model_name: str,
        version: Optional[str] = None,
        stage: Optional[str] = None
    ) -> Any:
        """
        Load a model from the registry.

        Args:
            model_name: Name of the registered model
            version: Specific version to load
            stage: Stage to load from (alternative to version)

        Returns:
            Loaded model object
        """
        if version:
            model_uri = f"models:/{model_name}/{version}"
        elif stage:
            model_uri = f"models:/{model_name}/{stage}"
        else:
            model_uri = f"models:/{model_name}/latest"

        return mlflow.sklearn.load_model(model_uri)

    # Query Methods

    def search_runs(
        self,
        filter_string: str = "",
        max_results: int = 100,
        order_by: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        Search runs in the experiment.

        Args:
            filter_string: MLflow filter string (e.g., "metrics.accuracy > 0.9")
            max_results: Maximum number of results
            order_by: List of columns to order by (e.g., ["metrics.accuracy DESC"])

        Returns:
            List of run information dictionaries
        """
        runs = self.client.search_runs(
            experiment_ids=[self.experiment_id],
            filter_string=filter_string,
            max_results=max_results,
            order_by=order_by
        )

        return [
            {
                'run_id': run.info.run_id,
                'run_name': run.data.tags.get('mlflow.runName', ''),
                'status': run.info.status,
                'start_time': run.info.start_time,
                'end_time': run.info.end_time,
                'metrics': dict(run.data.metrics),
                'params': dict(run.data.params),
                'tags': dict(run.data.tags)
            }
            for run in runs
        ]

    def get_run(self, run_id: str) -> Optional[Dict]:
        """
        Get detailed information about a specific run.

        Args:
            run_id: The run ID to retrieve

        Returns:
            Run information dictionary or None if not found
        """
        try:
            run = self.client.get_run(run_id)
            return {
                'run_id': run.info.run_id,
                'run_name': run.data.tags.get('mlflow.runName', ''),
                'experiment_id': run.info.experiment_id,
                'status': run.info.status,
                'start_time': run.info.start_time,
                'end_time': run.info.end_time,
                'artifact_uri': run.info.artifact_uri,
                'metrics': dict(run.data.metrics),
                'params': dict(run.data.params),
                'tags': dict(run.data.tags)
            }
        except Exception as e:
            logger.warning(f"Failed to get run {run_id}: {e}")
            return None

    def delete_run(self, run_id: str) -> bool:
        """
        Delete a run.

        Args:
            run_id: The run ID to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.delete_run(run_id)
            logger.info(f"Deleted run {run_id}")
            return True
        except Exception as e:
            logger.warning(f"Failed to delete run {run_id}: {e}")
            return False


class MLflowConfigLoader:
    """Utility class to load MLflow configuration from YAML file."""

    DEFAULT_CONFIG = {
        'mlflow': {
            'enabled': True,
            'tracking_uri': 'sqlite:///mlflow.db',
            'experiment_name_prefix': 'valtool',
            'auto_log': False,
            'artifact_location': './mlruns',
            'model_registry_uri': None
        }
    }

    @classmethod
    def load(cls, config_path: Optional[str] = None) -> Dict:
        """
        Load MLflow configuration from file.

        Args:
            config_path: Path to config file (default: config/mlflow.yaml)

        Returns:
            Configuration dictionary
        """
        if config_path is None:
            # Look for config relative to this file
            base_dir = Path(__file__).parent.parent
            config_path = base_dir / 'config' / 'mlflow.yaml'

        if isinstance(config_path, str):
            config_path = Path(config_path)

        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                logger.info(f"Loaded MLflow config from {config_path}")
                return config
        else:
            logger.warning(f"MLflow config not found at {config_path}, using defaults")
            return cls.DEFAULT_CONFIG

    @classmethod
    def get_tracker(
        cls,
        task_type: str,
        config_path: Optional[str] = None,
        job_id: Optional[str] = None
    ) -> Optional[MLflowTracker]:
        """
        Create an MLflow tracker from configuration.

        Args:
            task_type: Type of ML task (classification, regression, timeseries)
            config_path: Optional path to config file
            job_id: Optional job ID to include in experiment name

        Returns:
            MLflowTracker instance or None if disabled
        """
        config = cls.load(config_path)
        mlflow_config = config.get('mlflow', {})

        if not mlflow_config.get('enabled', True):
            logger.info("MLflow tracking is disabled")
            return None

        # Build experiment name
        prefix = mlflow_config.get('experiment_name_prefix', 'valtool')
        experiment_name = f"{prefix}_{task_type}"
        if job_id:
            experiment_name = f"{experiment_name}_{job_id[:8]}"

        return MLflowTracker(
            experiment_name=experiment_name,
            tracking_uri=mlflow_config.get('tracking_uri'),
            artifact_location=mlflow_config.get('artifact_location'),
            auto_log=mlflow_config.get('auto_log', False)
        )
