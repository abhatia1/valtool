"""
Monitoring Service - Data Drift Detection and Performance Tracking

This service provides comprehensive monitoring capabilities for deployed models:
- Data drift detection using statistical tests (KS, Chi-square, PSI)
- Model performance tracking over time
- Alert generation for significant deviations
- Model testing on new datasets
"""

import json
import pickle
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)


class DataDriftDetector:
    """
    Detects data drift between reference (training) and current (production) data
    using multiple statistical tests.
    """

    def __init__(self, reference_data: pd.DataFrame, drift_threshold: float = 0.05):
        """
        Initialize the drift detector.

        Args:
            reference_data: The reference dataset (typically training data)
            drift_threshold: P-value threshold for drift detection (default 0.05)
        """
        self.reference_data = reference_data
        self.drift_threshold = drift_threshold
        self.numerical_cols = reference_data.select_dtypes(
            include=["number"]
        ).columns.tolist()
        self.categorical_cols = reference_data.select_dtypes(
            include=["object", "category"]
        ).columns.tolist()

    def detect_drift(self, current_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Detect drift using multiple statistical tests.

        Args:
            current_data: Current production data to compare against reference

        Returns:
            Dictionary containing drift results for each feature
        """
        drift_results = {}

        # Process numerical columns
        for column in self.numerical_cols:
            if column in current_data.columns:
                drift_results[column] = self._detect_numerical_drift(
                    column, current_data
                )

        # Process categorical columns
        for column in self.categorical_cols:
            if column in current_data.columns:
                drift_results[column] = self._detect_categorical_drift(
                    column, current_data
                )

        return drift_results

    def _detect_numerical_drift(
        self, column: str, current_data: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Detect drift in numerical features using Kolmogorov-Smirnov test.

        Args:
            column: Column name to test
            current_data: Current data DataFrame

        Returns:
            Dictionary with drift detection results
        """
        ref_values = self.reference_data[column].dropna()
        curr_values = current_data[column].dropna()

        if len(ref_values) == 0 or len(curr_values) == 0:
            return {
                "drift_detected": False,
                "drift_score": 0.0,
                "statistical_test": "ks_test",
                "p_value": None,
                "threshold": self.drift_threshold,
                "error": "Insufficient data",
            }

        # Kolmogorov-Smirnov test
        statistic, p_value = stats.ks_2samp(ref_values, curr_values)

        # Population Stability Index (PSI)
        psi = self._calculate_psi(ref_values, curr_values)

        return {
            "drift_detected": p_value < self.drift_threshold,
            "drift_score": float(statistic),
            "statistical_test": "ks_test",
            "p_value": float(p_value),
            "psi": float(psi),
            "threshold": self.drift_threshold,
            "reference_stats": {
                "mean": float(ref_values.mean()),
                "std": float(ref_values.std()),
                "min": float(ref_values.min()),
                "max": float(ref_values.max()),
            },
            "current_stats": {
                "mean": float(curr_values.mean()),
                "std": float(curr_values.std()),
                "min": float(curr_values.min()),
                "max": float(curr_values.max()),
            },
        }

    def _detect_categorical_drift(
        self, column: str, current_data: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Detect drift in categorical features using Chi-square test.

        Args:
            column: Column name to test
            current_data: Current data DataFrame

        Returns:
            Dictionary with drift detection results
        """
        ref_counts = self.reference_data[column].value_counts(normalize=True)
        curr_counts = current_data[column].value_counts(normalize=True)

        # Align categories
        all_categories = set(ref_counts.index) | set(curr_counts.index)

        ref_freq = np.array([ref_counts.get(cat, 0) for cat in all_categories])
        curr_freq = np.array([curr_counts.get(cat, 0) for cat in all_categories])

        # Avoid division by zero
        ref_freq = np.clip(ref_freq, 1e-10, 1)
        curr_freq = np.clip(curr_freq, 1e-10, 1)

        # Chi-square test
        n_ref = len(self.reference_data[column].dropna())
        n_curr = len(current_data[column].dropna())

        if n_ref == 0 or n_curr == 0:
            return {
                "drift_detected": False,
                "drift_score": 0.0,
                "statistical_test": "chi_square",
                "p_value": None,
                "threshold": self.drift_threshold,
                "error": "Insufficient data",
            }

        # Expected frequencies for chi-square
        expected = ref_freq * n_curr
        observed = curr_freq * n_curr

        try:
            # Chi-square statistic
            chi2, p_value = stats.chisquare(
                f_obs=observed + 1e-10, f_exp=expected + 1e-10
            )
        except Exception:
            chi2, p_value = 0.0, 1.0

        # Jensen-Shannon divergence as additional metric
        js_divergence = self._calculate_js_divergence(ref_freq, curr_freq)

        return {
            "drift_detected": p_value < self.drift_threshold,
            "drift_score": float(js_divergence),
            "statistical_test": "chi_square",
            "p_value": float(p_value) if p_value is not None else None,
            "chi2_statistic": float(chi2),
            "jensen_shannon_divergence": float(js_divergence),
            "threshold": self.drift_threshold,
            "reference_distribution": ref_counts.to_dict(),
            "current_distribution": curr_counts.to_dict(),
        }

    def _calculate_psi(
        self, reference: pd.Series, current: pd.Series, buckets: int = 10
    ) -> float:
        """
        Calculate Population Stability Index (PSI).

        PSI measures the shift in distribution of a variable from one period to another.
        PSI < 0.1: No significant change
        0.1 <= PSI < 0.25: Moderate change, some investigation needed
        PSI >= 0.25: Significant change, action may be required

        Args:
            reference: Reference data series
            current: Current data series
            buckets: Number of buckets for binning

        Returns:
            PSI value
        """
        # Create bins based on reference data
        breakpoints = np.percentile(reference, np.linspace(0, 100, buckets + 1))
        breakpoints = np.unique(breakpoints)

        # Calculate proportions in each bin
        ref_counts, _ = np.histogram(reference, bins=breakpoints)
        curr_counts, _ = np.histogram(current, bins=breakpoints)

        ref_proportions = ref_counts / len(reference)
        curr_proportions = curr_counts / len(current)

        # Avoid division by zero
        ref_proportions = np.clip(ref_proportions, 1e-10, 1)
        curr_proportions = np.clip(curr_proportions, 1e-10, 1)

        # Calculate PSI
        psi = np.sum(
            (curr_proportions - ref_proportions)
            * np.log(curr_proportions / ref_proportions)
        )

        return psi

    def _calculate_js_divergence(self, p: np.ndarray, q: np.ndarray) -> float:
        """
        Calculate Jensen-Shannon divergence between two probability distributions.

        Args:
            p: First probability distribution
            q: Second probability distribution

        Returns:
            JS divergence value (0 to 1)
        """
        p = np.asarray(p, dtype=np.float64)
        q = np.asarray(q, dtype=np.float64)

        # Normalize
        p = p / np.sum(p)
        q = q / np.sum(q)

        # Calculate midpoint distribution
        m = (p + q) / 2

        # KL divergence
        def kl_divergence(a, b):
            a = np.clip(a, 1e-10, 1)
            b = np.clip(b, 1e-10, 1)
            return np.sum(a * np.log(a / b))

        js = (kl_divergence(p, m) + kl_divergence(q, m)) / 2
        return float(np.sqrt(js))  # Square root for bounded [0, 1] metric

    def get_overall_drift_status(
        self, drift_results: Dict[str, Any]
    ) -> Tuple[bool, str, List[str]]:
        """
        Determine overall drift status from individual feature drift results.

        Args:
            drift_results: Dictionary of drift results per feature

        Returns:
            Tuple of (overall_drift_detected, severity, features_with_drift)
        """
        features_with_drift = []
        drift_severities = []

        for feature, result in drift_results.items():
            if result.get("drift_detected", False):
                features_with_drift.append(feature)

                # Determine severity based on drift score
                score = result.get("drift_score", 0)
                psi = result.get("psi", 0)

                if psi >= 0.25 or score >= 0.5:
                    drift_severities.append("high")
                elif psi >= 0.1 or score >= 0.25:
                    drift_severities.append("medium")
                else:
                    drift_severities.append("low")

        overall_drift = len(features_with_drift) > 0

        if not drift_severities:
            severity = "none"
        elif "high" in drift_severities:
            severity = "high"
        elif "medium" in drift_severities:
            severity = "medium"
        else:
            severity = "low"

        return overall_drift, severity, features_with_drift


class PerformanceTracker:
    """
    Tracks model performance over time and detects degradation.
    """

    def __init__(
        self, baseline_metrics: Dict[str, float], alert_threshold: float = 0.05
    ):
        """
        Initialize the performance tracker.

        Args:
            baseline_metrics: Baseline metrics from training/validation
            alert_threshold: Threshold for triggering alerts (fractional degradation)
        """
        self.baseline_metrics = baseline_metrics
        self.alert_threshold = alert_threshold
        self.history: List[Dict[str, Any]] = []

    def log_performance(
        self,
        metrics: Dict[str, float],
        batch_id: str,
        sample_count: int,
        timestamp: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Log performance metrics for a batch.

        Args:
            metrics: Dictionary of metric values
            batch_id: ID of the monitoring batch
            sample_count: Number of samples in the batch
            timestamp: Timestamp of the measurement

        Returns:
            Performance log entry
        """
        if timestamp is None:
            timestamp = datetime.utcnow()

        entry = {
            "timestamp": timestamp,
            "batch_id": batch_id,
            "metrics": metrics,
            "sample_count": sample_count,
        }
        self.history.append(entry)
        return entry

    def check_alerts(self) -> List[Dict[str, Any]]:
        """
        Check for performance degradation alerts.

        Returns:
            List of alert dictionaries
        """
        if not self.history:
            return []

        alerts = []
        latest_metrics = self.history[-1]["metrics"]

        for metric, baseline_value in self.baseline_metrics.items():
            if metric not in latest_metrics:
                continue

            current_value = latest_metrics[metric]

            # Calculate degradation (handle both higher-is-better and lower-is-better)
            if metric.lower() in ["mse", "rmse", "mae", "mape", "loss"]:
                # Lower is better
                degradation = (current_value - baseline_value) / max(
                    abs(baseline_value), 1e-10
                )
            else:
                # Higher is better (accuracy, f1, r2, etc.)
                degradation = (baseline_value - current_value) / max(
                    abs(baseline_value), 1e-10
                )

            if degradation > self.alert_threshold:
                severity = "critical" if degradation > 0.1 else "warning"
                alerts.append(
                    {
                        "alert_type": "performance_degradation",
                        "metric": metric,
                        "baseline": baseline_value,
                        "current": current_value,
                        "degradation": degradation,
                        "severity": severity,
                        "message": f"{metric} degraded by {degradation * 100:.1f}% "
                        f"(baseline: {baseline_value:.4f}, current: {current_value:.4f})",
                    }
                )

        return alerts

    def get_performance_trend(
        self, metric: str, window_size: int = 5
    ) -> Dict[str, Any]:
        """
        Calculate performance trend for a metric.

        Args:
            metric: Metric name to analyze
            window_size: Number of recent entries to consider

        Returns:
            Trend information dictionary
        """
        if len(self.history) < 2:
            return {"trend": "insufficient_data", "percent_change": 0.0, "is_significant": False}

        recent = self.history[-window_size:]
        values = [entry["metrics"].get(metric) for entry in recent if metric in entry["metrics"]]

        if len(values) < 2:
            return {"trend": "insufficient_data", "percent_change": 0.0, "is_significant": False}

        # Simple linear trend
        first_half = np.mean(values[: len(values) // 2])
        second_half = np.mean(values[len(values) // 2 :])

        if first_half == 0:
            percent_change = 0.0
        else:
            percent_change = (second_half - first_half) / abs(first_half)

        # Determine trend direction
        is_lower_better = metric.lower() in ["mse", "rmse", "mae", "mape", "loss"]

        if abs(percent_change) < 0.01:
            trend = "stable"
        elif is_lower_better:
            trend = "improving" if percent_change < 0 else "degrading"
        else:
            trend = "improving" if percent_change > 0 else "degrading"

        return {
            "trend": trend,
            "percent_change": float(percent_change * 100),
            "is_significant": abs(percent_change) > self.alert_threshold,
        }


class ModelTester:
    """
    Evaluates trained models on test datasets.
    Handles loading of model, preprocessor, and encoders/scalers.
    """

    def __init__(self, model_path: str, task_type: str):
        """
        Initialize the model tester.

        Args:
            model_path: Path to the pickled model (model.pkl)
            task_type: Type of task (classification/regression)
        """
        self.model_path = Path(model_path)
        self.model_dir = self.model_path.parent
        self.task_type = task_type
        self.model = None
        self.preprocessor = None
        self.label_encoder = None
        self.target_scaler = None
        self.metadata = None

    def load_artifacts(self) -> None:
        """Load all model artifacts from disk."""
        # Load model
        with open(self.model_path, "rb") as f:
            self.model = pickle.load(f)

        # Load preprocessor
        preprocessor_path = self.model_dir / "preprocessor.pkl"
        if preprocessor_path.exists():
            with open(preprocessor_path, "rb") as f:
                self.preprocessor = pickle.load(f)

        # Load label encoder for classification
        if self.task_type == "classification":
            label_encoder_path = self.model_dir / "label_encoder.pkl"
            if label_encoder_path.exists():
                with open(label_encoder_path, "rb") as f:
                    self.label_encoder = pickle.load(f)

        # Load target scaler for regression
        if self.task_type == "regression":
            target_scaler_path = self.model_dir / "target_scaler.pkl"
            if target_scaler_path.exists():
                with open(target_scaler_path, "rb") as f:
                    self.target_scaler = pickle.load(f)

        # Load metadata
        metadata_path = self.model_dir / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path, "r") as f:
                self.metadata = json.load(f)

    def load_model(self) -> None:
        """Load the model from disk (legacy method, calls load_artifacts)."""
        self.load_artifacts()

    def evaluate(
        self,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        training_metrics: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate the model on test data.

        Args:
            X_test: Test features
            y_test: Test labels/targets
            training_metrics: Original training metrics for comparison

        Returns:
            Dictionary containing test results
        """
        if self.model is None:
            self.load_artifacts()

        # Apply preprocessing to features
        if self.preprocessor is not None:
            try:
                X_transformed = self.preprocessor.transform(X_test)
            except Exception as e:
                print(f"Preprocessing failed: {e}, using raw data")
                X_transformed = X_test
        else:
            X_transformed = X_test

        # Encode target for classification if label encoder exists
        y_test_encoded = y_test
        if self.task_type == "classification" and self.label_encoder is not None:
            try:
                y_test_encoded = self.label_encoder.transform(y_test)
            except Exception as e:
                print(f"Label encoding failed: {e}, using raw labels")
                y_test_encoded = y_test

        # Make predictions
        y_pred = self.model.predict(X_transformed)

        # For regression with target scaling, inverse transform predictions
        if self.task_type == "regression" and self.target_scaler is not None:
            try:
                y_pred = self.target_scaler.inverse_transform(y_pred.reshape(-1, 1)).flatten()
            except Exception as e:
                print(f"Target inverse transform failed: {e}")

        # Calculate metrics based on task type
        if self.task_type == "classification":
            # Decode predictions back to original labels for metrics
            if self.label_encoder is not None:
                try:
                    y_pred_decoded = self.label_encoder.inverse_transform(y_pred)
                    y_test_original = y_test  # Use original labels
                except Exception:
                    y_pred_decoded = y_pred
                    y_test_original = y_test_encoded
            else:
                y_pred_decoded = y_pred
                y_test_original = y_test

            metrics = self._calculate_classification_metrics(y_test_original, y_pred_decoded)

            # Get probability predictions if available
            if hasattr(self.model, "predict_proba"):
                try:
                    y_proba = self.model.predict_proba(X_transformed)
                    metrics["probabilities"] = y_proba.tolist()
                except Exception:
                    pass

            # Use decoded values for return
            y_pred_return = y_pred_decoded
            y_test_return = y_test_original
        else:
            metrics = self._calculate_regression_metrics(y_test, y_pred)
            y_pred_return = y_pred
            y_test_return = y_test

        # Compare to training metrics
        comparison = {}
        if training_metrics:
            for metric_name, test_value in metrics.items():
                if metric_name in training_metrics and isinstance(test_value, (int, float)):
                    train_value = training_metrics[metric_name]
                    diff = test_value - train_value
                    pct_change = (
                        diff / abs(train_value) * 100 if train_value != 0 else 0
                    )
                    comparison[metric_name] = {
                        "training_value": train_value,
                        "test_value": test_value,
                        "difference": diff,
                        "percent_change": pct_change,
                    }

        # Convert to list for JSON serialization
        y_pred_list = y_pred_return.tolist() if hasattr(y_pred_return, 'tolist') else list(y_pred_return)
        y_test_list = y_test_return.tolist() if hasattr(y_test_return, 'tolist') else list(y_test_return)

        return {
            "metrics": metrics,
            "predictions": y_pred_list,
            "actual": y_test_list,
            "comparison_to_training": comparison,
            "sample_count": len(y_test),
        }

    def _calculate_classification_metrics(
        self, y_true: pd.Series, y_pred: np.ndarray
    ) -> Dict[str, float]:
        """Calculate classification metrics."""
        metrics = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "precision": float(
                precision_score(y_true, y_pred, average="weighted", zero_division=0)
            ),
            "recall": float(
                recall_score(y_true, y_pred, average="weighted", zero_division=0)
            ),
            "f1": float(
                f1_score(y_true, y_pred, average="weighted", zero_division=0)
            ),
        }

        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        metrics["confusion_matrix"] = cm.tolist()

        return metrics

    def _calculate_regression_metrics(
        self, y_true: pd.Series, y_pred: np.ndarray
    ) -> Dict[str, float]:
        """Calculate regression metrics."""
        mse = mean_squared_error(y_true, y_pred)
        return {
            "mse": float(mse),
            "rmse": float(np.sqrt(mse)),
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "r2": float(r2_score(y_true, y_pred)),
            "mape": float(
                np.mean(np.abs((y_true - y_pred) / np.clip(np.abs(y_true), 1e-10, None)))
                * 100
            ),
        }


class MultiModelTester:
    """
    Tests ALL trained models from a training job on a test dataset.
    
    Unlike ModelTester which only tests the best model, this class loads
    all models saved during training and evaluates each one, returning
    a leaderboard of results sorted by test performance.
    """

    def __init__(self, job_dir: str, task_type: str):
        """
        Initialize the multi-model tester.

        Args:
            job_dir: Path to the job directory (contains model.pkl, preprocessor.pkl, all_models/)
            task_type: Type of task (classification/regression)
        """
        self.job_dir = Path(job_dir)
        self.task_type = task_type
        self.preprocessor = None
        self.label_encoder = None
        self.target_scaler = None
        self.all_models_dir = self.job_dir / "all_models"

    def load_shared_artifacts(self) -> None:
        """Load preprocessor and encoders (shared across all models)."""
        # Load preprocessor
        preprocessor_path = self.job_dir / "preprocessor.pkl"
        if preprocessor_path.exists():
            with open(preprocessor_path, "rb") as f:
                self.preprocessor = pickle.load(f)

        # Load label encoder for classification
        if self.task_type == "classification":
            label_encoder_path = self.job_dir / "label_encoder.pkl"
            if label_encoder_path.exists():
                with open(label_encoder_path, "rb") as f:
                    self.label_encoder = pickle.load(f)

        # Load target scaler for regression
        if self.task_type == "regression":
            target_scaler_path = self.job_dir / "target_scaler.pkl"
            if target_scaler_path.exists():
                with open(target_scaler_path, "rb") as f:
                    self.target_scaler = pickle.load(f)

    def get_available_models(self) -> List[str]:
        """Get list of all saved model estimator names."""
        if not self.all_models_dir.exists():
            return []
        return [d.name for d in self.all_models_dir.iterdir() if d.is_dir()]

    def test_all_models(
        self,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        training_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Test all models and return comparative results.

        Args:
            X_test: Test features DataFrame
            y_test: Test labels/targets Series
            training_results: Results from training job containing all_models data

        Returns:
            Dictionary containing best_test_model, all_models list, and sample_count
        """
        self.load_shared_artifacts()

        # Preprocess test data
        if self.preprocessor is not None:
            try:
                X_transformed = self.preprocessor.transform(X_test)
            except Exception as e:
                print(f"Preprocessing failed: {e}, using raw data")
                X_transformed = X_test
        else:
            X_transformed = X_test

        # Encode target for classification
        y_test_encoded = y_test
        if self.task_type == "classification" and self.label_encoder is not None:
            try:
                y_test_encoded = self.label_encoder.transform(y_test)
            except Exception as e:
                print(f"Label encoding failed: {e}, using raw labels")

        all_results = []

        for est_name in self.get_available_models():
            model_path = self.all_models_dir / est_name / "model.pkl"
            
            try:
                with open(model_path, "rb") as f:
                    model = pickle.load(f)

                y_pred = model.predict(X_transformed)

                # For regression with target scaling, inverse transform predictions
                if self.task_type == "regression" and self.target_scaler is not None:
                    try:
                        y_pred = self.target_scaler.inverse_transform(
                            y_pred.reshape(-1, 1)
                        ).flatten()
                    except Exception:
                        pass

                if self.task_type == "classification":
                    metrics = self._calculate_classification_metrics(y_test_encoded, y_pred)
                else:
                    metrics = self._calculate_regression_metrics(y_test, y_pred)

                # Get training results for this model
                training_model_data = next(
                    (m for m in training_results.get("all_models", []) 
                     if m.get("estimator_name") == est_name),
                    {}
                )

                all_results.append({
                    "estimator_name": est_name,
                    "test_metrics": metrics,
                    "validation_score": training_model_data.get("validation_score", 0),
                    "validation_std": training_model_data.get("validation_std", 0),
                    "training_time": training_model_data.get("training_time", 0),
                })

            except Exception as e:
                print(f"Error testing model {est_name}: {e}")
                continue

        # Sort by primary test metric (higher is better)
        primary_metric = "accuracy" if self.task_type == "classification" else "r2"
        all_results.sort(
            key=lambda x: x["test_metrics"].get(primary_metric, 0), 
            reverse=True
        )

        return {
            "best_test_model": all_results[0] if all_results else None,
            "all_models": all_results,
            "sample_count": len(y_test),
        }

    def _calculate_classification_metrics(
        self, y_true: pd.Series, y_pred: np.ndarray
    ) -> Dict[str, float]:
        """Calculate classification metrics."""
        metrics = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "precision": float(
                precision_score(y_true, y_pred, average="weighted", zero_division=0)
            ),
            "recall": float(
                recall_score(y_true, y_pred, average="weighted", zero_division=0)
            ),
            "f1": float(
                f1_score(y_true, y_pred, average="weighted", zero_division=0)
            ),
        }

        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        metrics["confusion_matrix"] = cm.tolist()

        return metrics

    def _calculate_regression_metrics(
        self, y_true: pd.Series, y_pred: np.ndarray
    ) -> Dict[str, float]:
        """Calculate regression metrics."""
        mse = mean_squared_error(y_true, y_pred)
        return {
            "mse": float(mse),
            "rmse": float(np.sqrt(mse)),
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "r2": float(r2_score(y_true, y_pred)),
            "mape": float(
                np.mean(np.abs((y_true - y_pred) / np.clip(np.abs(y_true), 1e-10, None)))
                * 100
            ),
        }


class ModelFinalizer:
    """
    Finalizes a selected model for benchmarking by:
    1. Creating a combined pipeline package (preprocessor + model + metadata)
    2. Deleting unused models to save storage space
    3. Updating metadata with finalization info
    """

    def __init__(self, job_dir: str, task_type: str):
        """
        Initialize the model finalizer.

        Args:
            job_dir: Path to the job directory (contains model.pkl, preprocessor.pkl, all_models/)
            task_type: Type of task (classification/regression)
        """
        self.job_dir = Path(job_dir)
        self.task_type = task_type
        self.all_models_dir = self.job_dir / "all_models"

    def finalize_models(
        self,
        selected_models: List[str],
        primary_model: str,
        model_metrics: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Finalize selected models for benchmarking.

        This keeps selected models, creates a combined pipeline package for the primary,
        and cleans up unselected models to save space.

        Args:
            selected_models: List of estimator names to keep (e.g., ["random_forest", "xgboost"])
            primary_model: Which model to use as the main model (for final_model.pkl)
            model_metrics: Dict mapping estimator_name to {test_metrics, validation_score}

        Returns:
            Dictionary with finalization details
        """
        import shutil

        # 1. Calculate initial storage usage
        initial_size = self._calculate_directory_size(self.job_dir)

        # 2. Verify all selected models exist
        missing_models = []
        for model_name in selected_models:
            model_path = self.all_models_dir / model_name / "model.pkl"
            if not model_path.exists():
                missing_models.append(model_name)

        if missing_models:
            raise FileNotFoundError(f"Models not found: {missing_models}")

        # 3. Load shared artifacts
        preprocessor = None
        preprocessor_path = self.job_dir / "preprocessor.pkl"
        if preprocessor_path.exists():
            with open(preprocessor_path, "rb") as f:
                preprocessor = pickle.load(f)

        encoder = None
        encoder_type = None
        if self.task_type == "classification":
            encoder_path = self.job_dir / "label_encoder.pkl"
            encoder_type = "label_encoder"
        else:
            encoder_path = self.job_dir / "target_scaler.pkl"
            encoder_type = "target_scaler"

        if encoder_path.exists():
            with open(encoder_path, "rb") as f:
                encoder = pickle.load(f)

        # 4. Load original metadata
        metadata_path = self.job_dir / "metadata.json"
        metadata = {}
        if metadata_path.exists():
            with open(metadata_path, "r") as f:
                metadata = json.load(f)

        # 5. Create kept_models directory and move selected models
        kept_models_dir = self.job_dir / "kept_models"
        kept_models_dir.mkdir(exist_ok=True)

        for model_name in selected_models:
            src_path = self.all_models_dir / model_name
            dst_path = kept_models_dir / model_name
            if src_path.exists():
                shutil.copytree(src_path, dst_path, dirs_exist_ok=True)

        # 6. Load the primary model and create combined package
        primary_model_path = self.all_models_dir / primary_model / "model.pkl"
        with open(primary_model_path, "rb") as f:
            model = pickle.load(f)

        primary_metrics = model_metrics.get(primary_model, {})

        combined_package = {
            "model": model,
            "preprocessor": preprocessor,
            "encoder": encoder,
            "encoder_type": encoder_type,
            "task_type": self.task_type,
            "estimator_name": primary_model,
            "feature_names": metadata.get("feature_names", []),
            "target_column": metadata.get("target_column"),
            "test_metrics": primary_metrics.get("test_metrics", {}),
            "validation_score": primary_metrics.get("validation_score", 0),
            "finalized_at": datetime.now().isoformat(),
            "original_config": metadata.get("config", {}),
            "kept_models": selected_models,
        }

        # Add classification-specific info
        if self.task_type == "classification":
            combined_package["classes"] = metadata.get("classes", [])

        # 7. Save combined package
        final_model_path = self.job_dir / "final_model.pkl"
        with open(final_model_path, "wb") as f:
            pickle.dump(combined_package, f)

        # 8. Update the primary model.pkl
        main_model_path = self.job_dir / "model.pkl"
        with open(main_model_path, "wb") as f:
            pickle.dump(model, f)

        # 9. Count and delete unused models
        models_deleted = 0
        if self.all_models_dir.exists():
            all_models = list(self.all_models_dir.iterdir())
            models_deleted = len([m for m in all_models if m.name not in selected_models])
            # Delete entire all_models directory (we have copies in kept_models)
            self._delete_directory(self.all_models_dir)

        # 10. Update metadata
        metadata["finalized_models"] = selected_models
        metadata["primary_model"] = primary_model
        metadata["finalized_at"] = datetime.now().isoformat()
        metadata["test_metrics"] = primary_metrics.get("test_metrics", {})
        metadata["validation_score"] = primary_metrics.get("validation_score", 0)
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2, default=str)

        # 11. Calculate space saved
        final_size = self._calculate_directory_size(self.job_dir)
        space_saved = initial_size - final_size

        # 12. Get final model file size
        final_model_size = final_model_path.stat().st_size / (1024 * 1024)  # MB

        return {
            "model_path": str(final_model_path),
            "estimator_name": primary_model,
            "task_type": self.task_type,
            "test_metrics": primary_metrics.get("test_metrics", {}),
            "validation_score": primary_metrics.get("validation_score", 0),
            "file_size_mb": round(final_model_size, 2),
            "includes_preprocessor": preprocessor is not None,
            "includes_encoder": encoder is not None,
            "kept_models": selected_models,
            "models_deleted": models_deleted,
            "space_saved_mb": round(space_saved, 2),
        }

    def _calculate_directory_size(self, directory: Path) -> float:
        """Calculate total size of directory in MB."""
        total_size = 0
        if directory.exists():
            for file_path in directory.rglob("*"):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        return total_size / (1024 * 1024)  # Convert to MB

    def _delete_directory(self, directory: Path) -> None:
        """Recursively delete a directory and all its contents."""
        if directory.exists():
            import shutil
            shutil.rmtree(directory)


class MonitoringService:
    """
    Main service class for model monitoring operations.
    Coordinates drift detection, performance tracking, and testing.
    """

    def __init__(self):
        """Initialize the monitoring service."""
        self.drift_detectors: Dict[str, DataDriftDetector] = {}
        self.performance_trackers: Dict[str, PerformanceTracker] = {}

    def create_drift_detector(
        self,
        job_id: str,
        reference_data: pd.DataFrame,
        drift_threshold: float = 0.05,
    ) -> DataDriftDetector:
        """
        Create a drift detector for a job.

        Args:
            job_id: Training job ID
            reference_data: Reference dataset
            drift_threshold: P-value threshold for drift detection

        Returns:
            DataDriftDetector instance
        """
        detector = DataDriftDetector(reference_data, drift_threshold)
        self.drift_detectors[job_id] = detector
        return detector

    def create_performance_tracker(
        self,
        job_id: str,
        baseline_metrics: Dict[str, float],
        alert_threshold: float = 0.05,
    ) -> PerformanceTracker:
        """
        Create a performance tracker for a job.

        Args:
            job_id: Training job ID
            baseline_metrics: Baseline metrics from training
            alert_threshold: Threshold for alerts

        Returns:
            PerformanceTracker instance
        """
        tracker = PerformanceTracker(baseline_metrics, alert_threshold)
        self.performance_trackers[job_id] = tracker
        return tracker

    def detect_drift(
        self,
        job_id: str,
        current_data: pd.DataFrame,
        reference_data: Optional[pd.DataFrame] = None,
        drift_threshold: float = 0.05,
    ) -> Dict[str, Any]:
        """
        Detect drift for a job.

        Args:
            job_id: Training job ID
            current_data: Current production data
            reference_data: Reference data (optional if detector exists)
            drift_threshold: P-value threshold

        Returns:
            Drift detection results
        """
        # Get or create detector
        if job_id not in self.drift_detectors:
            if reference_data is None:
                raise ValueError(
                    f"No drift detector for job {job_id} and no reference data provided"
                )
            self.create_drift_detector(job_id, reference_data, drift_threshold)

        detector = self.drift_detectors[job_id]
        drift_results = detector.detect_drift(current_data)
        overall_drift, severity, features_with_drift = detector.get_overall_drift_status(
            drift_results
        )

        return {
            "overall_drift_detected": overall_drift,
            "drift_severity": severity,
            "features_with_drift": features_with_drift,
            "feature_drift": drift_results,
        }

    def generate_recommendations(
        self, drift_results: Dict[str, Any], performance_alerts: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Generate recommendations based on drift and performance analysis.

        Args:
            drift_results: Drift detection results
            performance_alerts: Performance alert list

        Returns:
            List of recommendation strings
        """
        recommendations = []

        # Drift-based recommendations
        if drift_results.get("overall_drift_detected"):
            severity = drift_results.get("drift_severity", "low")
            features = drift_results.get("features_with_drift", [])

            if severity == "high":
                recommendations.append(
                    "URGENT: Significant data drift detected. Consider retraining "
                    "the model with recent data."
                )
            elif severity == "medium":
                recommendations.append(
                    "Moderate data drift detected. Monitor closely and plan for "
                    "model retraining."
                )
            else:
                recommendations.append(
                    "Minor data drift detected. Continue monitoring for trends."
                )

            if len(features) > 3:
                recommendations.append(
                    f"Multiple features ({len(features)}) showing drift. "
                    "Investigate data collection process."
                )

        # Performance-based recommendations
        critical_alerts = [a for a in performance_alerts if a.get("severity") == "critical"]
        warning_alerts = [a for a in performance_alerts if a.get("severity") == "warning"]

        if critical_alerts:
            recommendations.append(
                f"CRITICAL: {len(critical_alerts)} metrics showing significant "
                "degradation. Immediate action required."
            )

        if warning_alerts:
            recommendations.append(
                f"WARNING: {len(warning_alerts)} metrics showing degradation. "
                "Review model performance."
            )

        if not recommendations:
            recommendations.append(
                "Model performance is stable. Continue routine monitoring."
            )

        return recommendations


# Singleton instance
monitoring_service = MonitoringService()
