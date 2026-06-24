"""
Configuration Manager Service

Handles configuration templates, estimator definitions, and validation.
"""

import yaml
import pandas as pd
from typing import Dict, List, Any, Tuple
from pathlib import Path
import math


class ConfigManager:
    """Manages configuration templates and estimator definitions"""

    def __init__(self):
        self.templates = self._load_templates()
        self.estimators = self._load_estimators()

    def _load_templates(self) -> Dict:
        """Load configuration templates from YAML"""
        template_path = Path("config/templates.yaml")
        if template_path.exists():
            with open(template_path, 'r') as f:
                data = yaml.safe_load(f)
                return data.get('templates', {})
        return {}

    def _load_estimators(self) -> Dict:
        """Load estimator definitions from YAML"""
        estimator_path = Path("config/estimators.yaml")
        if estimator_path.exists():
            with open(estimator_path, 'r') as f:
                return yaml.safe_load(f)
        return {}

    def get_templates(self) -> List[Dict]:
        """Get all configuration templates"""
        return [
            {
                "id": tid,
                "name": template.get("name"),
                "description": template.get("description"),
                "config": template.get("config")
            }
            for tid, template in self.templates.items()
        ]

    def get_estimators_for_task(self, task_type: str) -> List[Dict]:
        """Get available estimators for a task type"""
        estimators = self.estimators.get(task_type, {})

        return [
            {
                "id": est_id,
                "name": est_info.get("name"),
                "category": est_info.get("category"),
                "description": est_info.get("description"),
                "default_params": est_info.get("default_params", {}),
                "tunable_params": est_info.get("tunable_params", {})
            }
            for est_id, est_info in estimators.items()
        ]

    def validate_config(self, config_request: Dict, df: pd.DataFrame) -> Tuple[bool, List[str], List[str]]:
        """Validate configuration against dataset"""
        errors = []
        warnings = []

        # Check target column exists
        target_col = config_request.get("target_column")
        if target_col not in df.columns:
            errors.append(f"Target column '{target_col}' not found in dataset")
            return False, errors, warnings

        # Check task type matches target
        task_type = config_request.get("task_type")
        if task_type == "classification":
            if pd.api.types.is_numeric_dtype(df[target_col]):
                unique_values = df[target_col].nunique()
                if unique_values > 20:
                    warnings.append(f"Target has {unique_values} unique values - consider regression instead")
        elif task_type == "regression":
            if not pd.api.types.is_numeric_dtype(df[target_col]):
                errors.append("Regression requires a numeric target column")

        # Check categorical encoding compatibility
        preprocessing = config_request.get("preprocessing", {})
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns

        if len(categorical_cols) > 10 and preprocessing.get("categorical_encoding") == "onehot":
            warnings.append("Many categorical columns detected - consider target encoding")

        # Check for high cardinality categoricals
        for col in categorical_cols:
            if col != target_col:  # Don't warn about target column
                if df[col].nunique() > 50:
                    warnings.append(f"Column '{col}' has high cardinality ({df[col].nunique()} values)")

        # Check missing value strategy
        missing_cols = df.columns[df.isnull().any()].tolist()
        if missing_cols and preprocessing.get("missing_strategy") == "drop":
            warnings.append(f"{len(missing_cols)} columns have missing values - drop strategy may remove many rows")

        # Check dataset size for hyperparameter tuning
        n_samples = len(df)
        model_selection = config_request.get("model_selection", {})
        cv_folds = model_selection.get("cv_folds", 5)

        if n_samples < cv_folds * 30:
            warnings.append(f"Small dataset ({n_samples} samples) - consider reducing cv_folds")

        # Validate estimators exist
        estimators = model_selection.get("estimators", [])
        if isinstance(estimators, str) and estimators == "all":
            # "all" is valid - will be expanded later
            pass
        elif isinstance(estimators, list):
            available_estimators = self.estimators.get(task_type, {})
            for est_id in estimators:
                if est_id not in available_estimators:
                    errors.append(f"Estimator '{est_id}' not found for task type '{task_type}'")
        else:
            errors.append("estimators must be a list or the string 'all'")

        return len(errors) == 0, errors, warnings

    def estimate_training_time(self, config_request: Dict, n_samples: int, n_features: int) -> int:
        """Estimate training time in seconds"""

        # Base time per model
        base_time = 10  # seconds

        # Factor in dataset size
        size_factor = math.log10(n_samples * n_features) if n_samples * n_features > 0 else 1

        # Factor in number of estimators
        model_selection = config_request.get("model_selection", {})
        estimators = model_selection.get("estimators", [])

        if isinstance(estimators, str) and estimators == "all":
            # Count all estimators for task type
            task_type = config_request.get("task_type")
            n_estimators = len(self.estimators.get(task_type, {}))
        else:
            n_estimators = len(estimators)

        # Factor in CV folds
        cv_folds = model_selection.get("cv_folds", 5)

        # Factor in hyperparameter iterations
        tuning = config_request.get("hyperparameter_tuning", {})
        n_iter = tuning.get("n_iter", 10)
        search_multiplier = 1
        if tuning.get("search_method") == "grid":
            search_multiplier = 2
        elif tuning.get("search_method") == "bayesian":
            search_multiplier = 1.5

        estimated_time = base_time * n_estimators * cv_folds * size_factor * (n_iter / 10) * search_multiplier

        return int(estimated_time)

    def validate_preprocessing(self, preprocessing: Dict, df: pd.DataFrame) -> Tuple[bool, List[str], List[str], List[str]]:
        """Validate preprocessing configuration"""
        errors = []
        warnings = []
        suggestions = []

        # Validate scaling method
        valid_scaling = ["standard", "minmax", "robust", "none"]
        if preprocessing.get("scaling_method") not in valid_scaling:
            errors.append(f"Invalid scaling method. Choose from: {valid_scaling}")

        # Validate missing strategy
        valid_missing = ["median", "mean", "mode", "knn", "drop"]
        if preprocessing.get("missing_strategy") not in valid_missing:
            errors.append(f"Invalid missing strategy. Choose from: {valid_missing}")

        # Check if missing strategy is appropriate
        numeric_cols = df.select_dtypes(include=['number']).columns
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns

        missing_numeric = [col for col in numeric_cols if df[col].isnull().any()]
        missing_categorical = [col for col in categorical_cols if df[col].isnull().any()]

        if preprocessing.get("missing_strategy") in ["median", "mean"] and missing_categorical:
            suggestions.append("Use 'mode' strategy for categorical columns with missing values")

        # Validate categorical encoding
        valid_encoding = ["onehot", "ordinal", "target", "frequency"]
        if preprocessing.get("categorical_encoding") not in valid_encoding:
            errors.append(f"Invalid categorical encoding. Choose from: {valid_encoding}")

        # Validate outlier handling
        if preprocessing.get("handle_outliers"):
            valid_methods = ["iqr", "zscore", "isolation_forest"]
            outlier_method = preprocessing.get("outlier_method")
            if outlier_method not in valid_methods:
                errors.append(f"Invalid outlier method. Choose from: {valid_methods}")

        return len(errors) == 0, errors, warnings, suggestions

    def expand_estimators(self, config: Dict) -> Dict:
        """Expand 'all' estimators to full list"""
        model_selection = config.get("model_selection", {})
        estimators = model_selection.get("estimators", [])

        if isinstance(estimators, str) and estimators == "all":
            task_type = config.get("task_type")
            available_estimators = self.estimators.get(task_type, {})
            model_selection["estimators"] = list(available_estimators.keys())
            config["model_selection"] = model_selection

        return config
