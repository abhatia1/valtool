"""
Benchmark Service

Orchestrates model comparison between platform-trained models and external Docker containers.
"""

import os
import json
import pickle
import uuid
import time
import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, roc_curve, precision_recall_curve,
    mean_squared_error, mean_absolute_error, r2_score,
)

from models.database import (
    TrainingJob, TrainingConfig, ExternalModel, BenchmarkRun, Dataset
)
from services.container_runner import ContainerRunner
from services.native_model_manager import native_model_manager

logger = logging.getLogger(__name__)

# Storage paths
MODELS_PATH = "./storage/models"
BENCHMARKS_PATH = "./storage/benchmarks"


class BenchmarkService:
    """Orchestrates benchmarking between platform and external models."""

    def __init__(self, db: Session):
        """
        Initialize the benchmark service.

        Args:
            db: Database session
        """
        self.db = db
        self.container_runner = ContainerRunner(db)
        self._ensure_storage_dirs()

    def _ensure_storage_dirs(self):
        """Ensure storage directories exist."""
        os.makedirs(BENCHMARKS_PATH, exist_ok=True)

    async def start_benchmark(
        self,
        job_id: str,
        external_model_ids: List[str],
        platform_model_ids: Optional[List[str]] = None,
        test_dataset_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> BenchmarkRun:
        """
        Start a benchmark run.

        Args:
            job_id: Training job ID to benchmark against
            external_model_ids: List of external model IDs to include
            platform_model_ids: Optional list of specific platform models
            test_dataset_id: Optional test dataset ID
            name: Optional benchmark name

        Returns:
            Created BenchmarkRun instance
        """
        # Validate training job exists and is complete
        job = self.db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()
        if not job:
            raise ValueError(f"Training job not found: {job_id}")
        if job.status != "completed":
            raise ValueError(f"Training job not completed: {job_id}")

        # Validate external models exist and are ready
        for model_id in external_model_ids:
            model = self.db.query(ExternalModel).filter(
                ExternalModel.model_id == model_id
            ).first()
            if not model:
                raise ValueError(f"External model not found: {model_id}")
            if model.build_status != "ready":
                raise ValueError(f"External model not ready: {model_id}")

        # Create benchmark run record
        benchmark = BenchmarkRun(
            benchmark_id=str(uuid.uuid4()),
            name=name or f"Benchmark {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            job_id=job_id,
            external_model_id=external_model_ids[0],  # Primary external model
            test_dataset_path=test_dataset_id,
            status="pending",
            progress=0,
            created_at=datetime.utcnow(),
        )

        self.db.add(benchmark)
        self.db.commit()
        self.db.refresh(benchmark)

        logger.info(f"Created benchmark run: {benchmark.benchmark_id}")
        return benchmark

    async def run_benchmark(self, benchmark_id: str) -> Dict[str, Any]:
        """
        Execute a benchmark run.

        Args:
            benchmark_id: Benchmark run ID

        Returns:
            Benchmark results dictionary
        """
        benchmark = self.db.query(BenchmarkRun).filter(
            BenchmarkRun.benchmark_id == benchmark_id
        ).first()

        if not benchmark:
            raise ValueError(f"Benchmark not found: {benchmark_id}")

        # Update status
        benchmark.status = "running"
        benchmark.started_at = datetime.utcnow()
        benchmark.progress = 0
        self.db.commit()

        try:
            # Get training job and config
            job = self.db.query(TrainingJob).filter(
                TrainingJob.job_id == benchmark.job_id
            ).first()
            config = self.db.query(TrainingConfig).filter(
                TrainingConfig.config_id == job.config_id
            ).first()

            task_type = config.task_type

            # Load test data
            self._update_progress(benchmark, 10, "Loading test data")
            X_test, y_test = self._load_test_data(job, config)

            # Run platform model predictions
            self._update_progress(benchmark, 30, "Running platform predictions")
            platform_results = await self._run_platform_predictions(job, X_test, y_test, task_type)

            # Run external model predictions
            self._update_progress(benchmark, 60, "Running external predictions")
            external_results = await self._run_external_predictions(
                benchmark.external_model_id, X_test, y_test, task_type
            )

            # Compare metrics
            self._update_progress(benchmark, 80, "Comparing results")
            comparison = self._compare_metrics(platform_results, external_results, task_type)

            # Generate visualizations
            self._update_progress(benchmark, 90, "Generating visualizations")
            visualizations = self._generate_visualizations(
                y_test, platform_results, external_results, task_type
            )

            # Save results
            benchmark.platform_metrics = platform_results["metrics"]
            benchmark.platform_predictions = platform_results.get("predictions_sample")
            benchmark.platform_inference_time_ms = platform_results["inference_time_ms"]

            benchmark.external_metrics = external_results["metrics"]
            benchmark.external_predictions = external_results.get("predictions_sample")
            benchmark.external_inference_time_ms = external_results["inference_time_ms"]

            benchmark.comparison_summary = comparison
            benchmark.winner = comparison["overall_winner"]
            benchmark.visualizations = visualizations

            benchmark.status = "completed"
            benchmark.progress = 100
            benchmark.current_model = None
            benchmark.completed_at = datetime.utcnow()
            self.db.commit()

            logger.info(f"Benchmark completed: {benchmark_id}")
            return self._format_results(benchmark, task_type, len(X_test))

        except Exception as e:
            logger.error(f"Benchmark failed: {benchmark_id}: {e}")
            benchmark.status = "failed"
            benchmark.error_message = str(e)
            self.db.commit()
            raise

    def _update_progress(self, benchmark: BenchmarkRun, progress: int, current_model: str):
        """Update benchmark progress."""
        benchmark.progress = progress
        benchmark.current_model = current_model
        self.db.commit()

    def _load_test_data(
        self,
        job: TrainingJob,
        config: TrainingConfig,
    ) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Load test data for benchmarking.

        Args:
            job: Training job
            config: Training configuration

        Returns:
            Tuple of (X_test, y_test)
        """
        # Load the dataset
        dataset = self.db.query(Dataset).filter(
            Dataset.dataset_id == config.dataset_id
        ).first()

        if not dataset:
            raise ValueError(f"Dataset not found: {config.dataset_id}")

        # Load data
        df = pd.read_csv(dataset.file_path)
        target_column = config.target_column

        # Use test split from training if available
        model_dir = Path(MODELS_PATH) / job.job_id
        test_data_path = model_dir / "test_data.csv"

        if test_data_path.exists():
            test_df = pd.read_csv(test_data_path)
            X_test = test_df.drop(columns=[target_column])
            y_test = test_df[target_column]
        else:
            # Fall back to random split
            from sklearn.model_selection import train_test_split
            X = df.drop(columns=[target_column])
            y = df[target_column]
            _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        return X_test, y_test

    async def _run_platform_predictions(
        self,
        job: TrainingJob,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        task_type: str,
    ) -> Dict[str, Any]:
        """
        Run predictions using the platform's trained model.

        Args:
            job: Training job
            X_test: Test features
            y_test: Test labels
            task_type: Task type (classification/regression)

        Returns:
            Dictionary with predictions and metrics
        """
        model_dir = Path(MODELS_PATH) / job.job_id

        # Load model and preprocessor
        model_path = model_dir / "model.pkl"
        preprocessor_path = model_dir / "preprocessor.pkl"

        with open(model_path, "rb") as f:
            model = pickle.load(f)

        if preprocessor_path.exists():
            with open(preprocessor_path, "rb") as f:
                preprocessor = pickle.load(f)
            X_processed = preprocessor.transform(X_test)
        else:
            X_processed = X_test

        # Load label encoder for classification
        label_encoder = None
        if task_type == "classification":
            label_encoder_path = model_dir / "label_encoder.pkl"
            if label_encoder_path.exists():
                with open(label_encoder_path, "rb") as f:
                    label_encoder = pickle.load(f)
                y_test_encoded = label_encoder.transform(y_test)
            else:
                y_test_encoded = y_test
        else:
            y_test_encoded = y_test

        # Make predictions
        start_time = time.time()
        y_pred = model.predict(X_processed)
        inference_time_ms = (time.time() - start_time) * 1000

        # Calculate metrics
        metrics = self._calculate_metrics(y_test_encoded, y_pred, task_type, model, X_processed)

        return {
            "predictions": y_pred.tolist()[:100],  # Sample predictions
            "predictions_sample": y_pred[:100].tolist(),
            "metrics": metrics,
            "inference_time_ms": inference_time_ms,
        }

    async def _run_external_predictions(
        self,
        external_model_id: str,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        task_type: str,
    ) -> Dict[str, Any]:
        """
        Run predictions using an external model (Docker container or native).

        Args:
            external_model_id: External model ID
            X_test: Test features
            y_test: Test labels
            task_type: Task type

        Returns:
            Dictionary with predictions and metrics
        """
        # Get the external model to check its source type
        external_model = self.db.query(ExternalModel).filter(
            ExternalModel.model_id == external_model_id
        ).first()

        if not external_model:
            raise ValueError(f"External model not found: {external_model_id}")

        # Branch based on model source
        if external_model.model_source == "native":
            return await self._run_native_predictions(
                external_model, X_test, y_test, task_type
            )
        else:
            return await self._run_docker_predictions(
                external_model_id, X_test, y_test, task_type
            )


    async def _run_native_predictions(
        self,
        external_model: ExternalModel,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        task_type: str,
    ) -> Dict[str, Any]:
        """
        Run predictions using a native sklearn model.

        Args:
            external_model: ExternalModel database record
            X_test: Test features
            y_test: Test labels
            task_type: Task type

        Returns:
            Dictionary with predictions and metrics
        """
        try:
            # Make predictions using native model manager
            y_pred, inference_time_ms, probabilities = native_model_manager.predict_native(
                external_model, X_test.values
            )

            # Calculate metrics
            metrics = self._calculate_metrics(y_test, y_pred, task_type)

            return {
                "predictions": y_pred.tolist()[:100],
                "predictions_sample": y_pred.tolist()[:100],
                "metrics": metrics,
                "inference_time_ms": inference_time_ms,
            }

        except Exception as e:
            logger.error(f"Error running native predictions: {e}")
            raise

    async def _run_docker_predictions(
        self,
        external_model_id: str,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        task_type: str,
    ) -> Dict[str, Any]:
        """
        Run predictions using a Docker container model.

        Args:
            external_model_id: External model ID
            X_test: Test features
            y_test: Test labels
            task_type: Task type

        Returns:
            Dictionary with predictions and metrics
        """
        # Convert data to list format for JSON
        data = X_test.to_dict(orient="records")

        # Start container and make predictions
        try:
            predictions, inference_time_ms = await self.container_runner.predict(
                external_model_id, data
            )

            # Convert predictions to numpy array
            y_pred = np.array(predictions)

            # Calculate metrics
            metrics = self._calculate_metrics(y_test, y_pred, task_type)

            return {
                "predictions": predictions[:100],
                "predictions_sample": predictions[:100],
                "metrics": metrics,
                "inference_time_ms": inference_time_ms,
            }

        finally:
            # Stop container after benchmark
            await self.container_runner.stop_container(external_model_id)

    def _calculate_metrics(
        self,
        y_true: Any,
        y_pred: Any,
        task_type: str,
        model: Any = None,
        X: Any = None,
    ) -> Dict[str, float]:
        """
        Calculate metrics based on task type.

        Args:
            y_true: True labels
            y_pred: Predicted labels
            task_type: Task type
            model: Optional model for probability predictions
            X: Optional features for probability predictions

        Returns:
            Dictionary of metrics
        """
        if task_type == "classification":
            metrics = {
                "accuracy": accuracy_score(y_true, y_pred),
                "precision": precision_score(y_true, y_pred, average="weighted", zero_division=0),
                "recall": recall_score(y_true, y_pred, average="weighted", zero_division=0),
                "f1": f1_score(y_true, y_pred, average="weighted", zero_division=0),
            }

            # Try to calculate AUC if model supports predict_proba
            try:
                if model is not None and hasattr(model, "predict_proba") and X is not None:
                    y_proba = model.predict_proba(X)
                    if len(np.unique(y_true)) == 2:
                        metrics["auc"] = roc_auc_score(y_true, y_proba[:, 1])
                    else:
                        metrics["auc"] = roc_auc_score(y_true, y_proba, multi_class="ovr")
            except Exception:
                pass

            return metrics

        else:  # regression
            mse = mean_squared_error(y_true, y_pred)
            return {
                "mse": mse,
                "rmse": np.sqrt(mse),
                "mae": mean_absolute_error(y_true, y_pred),
                "r2": r2_score(y_true, y_pred),
            }

    def _compare_metrics(
        self,
        platform_results: Dict[str, Any],
        external_results: Dict[str, Any],
        task_type: str,
    ) -> Dict[str, Any]:
        """
        Compare metrics between platform and external models.

        Args:
            platform_results: Platform model results
            external_results: External model results
            task_type: Task type

        Returns:
            Comparison summary dictionary
        """
        platform_metrics = platform_results["metrics"]
        external_metrics = external_results["metrics"]

        # Primary metric for comparison
        if task_type == "classification":
            primary_metric = "f1"
            higher_is_better = True
        else:
            primary_metric = "r2"
            higher_is_better = True

        comparisons = []
        platform_wins = 0
        external_wins = 0
        ties = 0

        for metric in platform_metrics:
            if metric not in external_metrics:
                continue

            p_value = platform_metrics[metric]
            e_value = external_metrics[metric]

            # Determine if higher or lower is better
            higher_better = metric in ["accuracy", "precision", "recall", "f1", "auc", "r2"]

            if abs(p_value - e_value) < 0.001:
                winner = "tie"
                ties += 1
            elif (higher_better and p_value > e_value) or (not higher_better and p_value < e_value):
                winner = "platform"
                platform_wins += 1
            else:
                winner = "external"
                external_wins += 1

            diff = e_value - p_value
            pct_diff = (diff / p_value * 100) if p_value != 0 else 0

            comparisons.append({
                "metric_name": metric,
                "platform_value": round(p_value, 4),
                "external_value": round(e_value, 4),
                "difference": round(diff, 4),
                "percent_difference": round(pct_diff, 2),
                "winner": winner,
            })

        # Determine overall winner based on primary metric
        p_primary = platform_metrics.get(primary_metric, 0)
        e_primary = external_metrics.get(primary_metric, 0)

        if abs(p_primary - e_primary) < 0.001:
            overall_winner = "tie"
        elif (higher_is_better and p_primary > e_primary) or (not higher_is_better and p_primary < e_primary):
            overall_winner = "platform"
        else:
            overall_winner = "external"

        return {
            "total_metrics": len(comparisons),
            "platform_wins": platform_wins,
            "external_wins": external_wins,
            "ties": ties,
            "overall_winner": overall_winner,
            "primary_metric": primary_metric,
            "primary_metric_difference": round(e_primary - p_primary, 4),
            "metric_comparisons": comparisons,
        }

    def _generate_visualizations(
        self,
        y_true: Any,
        platform_results: Dict[str, Any],
        external_results: Dict[str, Any],
        task_type: str,
    ) -> Dict[str, Any]:
        """
        Generate comparison visualizations.

        Args:
            y_true: True labels
            platform_results: Platform model results
            external_results: External model results
            task_type: Task type

        Returns:
            Dictionary of Plotly JSON visualizations
        """
        visualizations = {}

        # Metrics comparison bar chart
        visualizations["metrics_comparison"] = self._create_metrics_comparison_chart(
            platform_results["metrics"],
            external_results["metrics"],
            task_type,
        )

        # Inference time comparison
        visualizations["inference_time"] = self._create_inference_time_chart(
            platform_results["inference_time_ms"],
            external_results["inference_time_ms"],
        )

        if task_type == "classification":
            # Confusion matrix comparison
            if platform_results.get("predictions") and external_results.get("predictions"):
                y_true_sample = y_true[:len(platform_results["predictions"])]
                visualizations["confusion_matrices"] = self._create_confusion_matrix_comparison(
                    y_true_sample,
                    platform_results["predictions"],
                    external_results["predictions"],
                )

        return visualizations

    def _create_metrics_comparison_chart(
        self,
        platform_metrics: Dict[str, float],
        external_metrics: Dict[str, float],
        task_type: str,
    ) -> Dict[str, Any]:
        """Create a grouped bar chart comparing metrics."""
        metrics = list(platform_metrics.keys())
        platform_values = [platform_metrics.get(m, 0) for m in metrics]
        external_values = [external_metrics.get(m, 0) for m in metrics]

        fig = go.Figure(data=[
            go.Bar(
                name="Platform Model",
                x=metrics,
                y=platform_values,
                marker_color="#3b82f6",
            ),
            go.Bar(
                name="External Model",
                x=metrics,
                y=external_values,
                marker_color="#f59e0b",
            ),
        ])

        fig.update_layout(
            title="Metrics Comparison",
            barmode="group",
            xaxis_title="Metric",
            yaxis_title="Value",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )

        return json.loads(fig.to_json())

    def _create_inference_time_chart(
        self,
        platform_time: float,
        external_time: float,
    ) -> Dict[str, Any]:
        """Create an inference time comparison chart."""
        fig = go.Figure(data=[
            go.Bar(
                x=["Platform Model", "External Model"],
                y=[platform_time, external_time],
                marker_color=["#3b82f6", "#f59e0b"],
                text=[f"{platform_time:.2f}ms", f"{external_time:.2f}ms"],
                textposition="auto",
            )
        ])

        fig.update_layout(
            title="Inference Time Comparison",
            xaxis_title="Model",
            yaxis_title="Time (ms)",
        )

        return json.loads(fig.to_json())

    def _create_confusion_matrix_comparison(
        self,
        y_true: Any,
        platform_pred: Any,
        external_pred: Any,
    ) -> Dict[str, Any]:
        """Create side-by-side confusion matrix visualization."""
        # Calculate confusion matrices
        cm_platform = confusion_matrix(y_true, platform_pred)
        cm_external = confusion_matrix(y_true, external_pred)

        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=["Platform Model", "External Model"],
        )

        # Platform confusion matrix
        fig.add_trace(
            go.Heatmap(
                z=cm_platform,
                colorscale="Blues",
                showscale=False,
            ),
            row=1, col=1
        )

        # External confusion matrix
        fig.add_trace(
            go.Heatmap(
                z=cm_external,
                colorscale="Oranges",
                showscale=False,
            ),
            row=1, col=2
        )

        fig.update_layout(
            title="Confusion Matrix Comparison",
        )

        return json.loads(fig.to_json())

    def _format_results(
        self,
        benchmark: BenchmarkRun,
        task_type: str,
        sample_count: int,
    ) -> Dict[str, Any]:
        """Format benchmark results for API response."""
        return {
            "benchmark_id": benchmark.benchmark_id,
            "name": benchmark.name,
            "job_id": benchmark.job_id,
            "task_type": task_type,
            "test_sample_count": sample_count,
            "status": benchmark.status,
            "platform_models": [{
                "model_id": benchmark.job_id,
                "model_name": "Platform Best Model",
                "model_type": "platform",
                "metrics": benchmark.platform_metrics,
                "inference_time_ms": benchmark.platform_inference_time_ms,
            }],
            "external_models": [{
                "model_id": benchmark.external_model_id,
                "model_name": "External Model",
                "model_type": "external",
                "metrics": benchmark.external_metrics,
                "inference_time_ms": benchmark.external_inference_time_ms,
            }],
            "best_overall": {
                "model_type": benchmark.winner,
                "metrics": benchmark.platform_metrics if benchmark.winner == "platform" else benchmark.external_metrics,
            },
            "best_platform": {
                "model_id": benchmark.job_id,
                "metrics": benchmark.platform_metrics,
            },
            "best_external": {
                "model_id": benchmark.external_model_id,
                "metrics": benchmark.external_metrics,
            },
            "comparison_summary": benchmark.comparison_summary,
            "visualizations": benchmark.visualizations,
            "completed_at": benchmark.completed_at.isoformat() if benchmark.completed_at else None,
        }

    def get_benchmark(self, benchmark_id: str) -> Optional[BenchmarkRun]:
        """Get a benchmark by ID."""
        return self.db.query(BenchmarkRun).filter(
            BenchmarkRun.benchmark_id == benchmark_id
        ).first()

    def list_benchmarks(
        self,
        job_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[BenchmarkRun]:
        """List benchmarks with optional filtering."""
        query = self.db.query(BenchmarkRun)

        if job_id:
            query = query.filter(BenchmarkRun.job_id == job_id)

        if status:
            query = query.filter(BenchmarkRun.status == status)

        return query.order_by(BenchmarkRun.created_at.desc()).all()

    def delete_benchmark(self, benchmark_id: str) -> bool:
        """Delete a benchmark."""
        benchmark = self.get_benchmark(benchmark_id)
        if not benchmark:
            return False

        self.db.delete(benchmark)
        self.db.commit()
        return True
