"""
Time Series Training Service

Provides AutoML capabilities for time series forecasting with both statistical
and ML-based models.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import pickle
import json
from datetime import datetime
from pathlib import Path
import warnings

# Statistical models
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# ML models for time series
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Try to import optional dependencies
try:
    from pmdarima import auto_arima
    PMDARIMA_AVAILABLE = True
except ImportError:
    PMDARIMA_AVAILABLE = False

# XGBoost (optional)
try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

from services.ts_preprocessing import TimeSeriesPreprocessor

warnings.filterwarnings('ignore')


# Time series estimator definitions
TIMESERIES_ESTIMATORS = {
    # Statistical models
    'arima': {
        'name': 'ARIMA',
        'class': ARIMA,
        'category': 'statistical',
        'default_params': {'order': (1, 1, 1)},
        'param_grid': {
            'order': [(p, d, q) for p in range(0, 3) for d in range(0, 2) for q in range(0, 3)]
        }
    },
    'sarima': {
        'name': 'SARIMA',
        'class': SARIMAX,
        'category': 'statistical',
        'default_params': {
            'order': (1, 1, 1),
            'seasonal_order': (1, 1, 1, 12)
        },
        'param_grid': {
            'order': [(1, 1, 1), (2, 1, 1), (1, 1, 2)],
            'seasonal_order': [(1, 1, 1, 12), (0, 1, 1, 12)]
        }
    },
    'exponential_smoothing': {
        'name': 'Exponential Smoothing',
        'class': ExponentialSmoothing,
        'category': 'statistical',
        'default_params': {
            'trend': 'add',
            'seasonal': 'add',
            'seasonal_periods': 12
        },
        'param_grid': {
            'trend': ['add', 'mul', None],
            'seasonal': ['add', 'mul', None]
        }
    },
    # ML models (require engineered features)
    'random_forest_ts': {
        'name': 'Random Forest (Time Series)',
        'class': RandomForestRegressor,
        'category': 'ml',
        'default_params': {
            'n_estimators': 100,
            'random_state': 42,
            'n_jobs': -1
        },
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'max_depth': [10, 20, 30, None],
            'min_samples_split': [2, 5, 10]
        }
    },
    'gradient_boosting_ts': {
        'name': 'Gradient Boosting (Time Series)',
        'class': GradientBoostingRegressor,
        'category': 'ml',
        'default_params': {
            'n_estimators': 100,
            'random_state': 42
        },
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'learning_rate': [0.01, 0.1, 0.3],
            'max_depth': [3, 5, 7]
        }
    }
}

# Add XGBoost if available
if XGBOOST_AVAILABLE:
    TIMESERIES_ESTIMATORS['xgboost_ts'] = {
        'name': 'XGBoost (Time Series)',
        'class': XGBRegressor,
        'category': 'ml',
        'default_params': {
            'n_estimators': 100,
            'random_state': 42,
            'n_jobs': -1
        },
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'learning_rate': [0.01, 0.1, 0.3],
            'max_depth': [3, 5, 7]
        }
    }


class TimeSeriesTrainer:
    """
    AutoML trainer for time series forecasting.

    Supports:
    - Statistical models (ARIMA, SARIMA, Exponential Smoothing)
    - ML models with engineered features (Random Forest, Gradient Boosting, XGBoost)
    - Time-based train/test splits
    - Comprehensive time series metrics
    """

    def __init__(
        self,
        config: Dict[str, Any],
        dataset_path: str,
        target_column: str,
        date_column: Optional[str] = None,
        output_dir: str = "models"
    ):
        """
        Initialize time series trainer.

        Args:
            config: Training configuration dictionary
            dataset_path: Path to dataset CSV file
            target_column: Name of target column
            date_column: Optional date column name
            output_dir: Directory to save trained models
        """
        self.config = config
        self.dataset_path = dataset_path
        self.target_column = target_column
        self.date_column = date_column
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Data attributes
        self.df = None
        self.train_data = None
        self.test_data = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None

        # Preprocessing
        self.preprocessor = None
        self.feature_names = []

        # Results
        self.results = []
        self.best_model = None
        self.best_model_name = None
        self.best_score = float('inf')  # Lower is better for time series (MAE)

        # MLflow
        self.mlflow_run_id = None

    def load_data(self):
        """Load dataset and perform time-based train/test split."""
        # Load data
        self.df = pd.read_csv(self.dataset_path)

        # Initialize preprocessor
        self.preprocessor = TimeSeriesPreprocessor(
            self.df,
            self.target_column,
            self.date_column
        )

        # Get the processed dataframe with datetime index
        self.df = self.preprocessor.df

        # Time-based split (last 20% for testing)
        split_idx = int(len(self.df) * 0.8)
        self.train_data = self.df.iloc[:split_idx]
        self.test_data = self.df.iloc[split_idx:]

        print(f"Loaded {len(self.df)} rows")
        print(f"Train: {len(self.train_data)} rows, Test: {len(self.test_data)} rows")

    def preprocess_data(self):
        """
        Preprocess time series data.

        For statistical models: use raw series
        For ML models: create engineered features
        """
        preprocessing_config = self.config.get('preprocessing', {})

        # Get lag and rolling window configurations
        lag_periods = preprocessing_config.get('lag_periods', [1, 2, 3, 7])
        rolling_windows = preprocessing_config.get('rolling_windows', [3, 7, 14])

        # Create lag features
        if lag_periods:
            preprocessor_train = TimeSeriesPreprocessor(
                self.train_data,
                self.target_column
            )
            train_lagged = preprocessor_train.create_lag_features(lag_periods)

            preprocessor_test = TimeSeriesPreprocessor(
                self.test_data,
                self.target_column
            )
            test_lagged = preprocessor_test.create_lag_features(lag_periods)

            # Create rolling features
            if rolling_windows:
                train_lagged = TimeSeriesPreprocessor(
                    train_lagged,
                    self.target_column
                ).create_rolling_features(rolling_windows)

                test_lagged = TimeSeriesPreprocessor(
                    test_lagged,
                    self.target_column
                ).create_rolling_features(rolling_windows)

            # Separate features and target
            self.X_train = train_lagged.drop(columns=[self.target_column])
            self.y_train = train_lagged[self.target_column]
            self.X_test = test_lagged.drop(columns=[self.target_column])
            self.y_test = test_lagged[self.target_column]
            self.feature_names = self.X_train.columns.tolist()

        print(f"Preprocessed data - Train: {self.X_train.shape}, Test: {self.X_test.shape}")

    def engineer_features(self):
        """
        Engineer time-based features for ML models.

        Creates features like year, month, day, dayofweek, etc.
        """
        feature_config = self.config.get('feature_engineering', {})

        if feature_config.get('create_time_features', True):
            # Add time features to training data
            preprocessor_train = TimeSeriesPreprocessor(
                self.X_train,
                self.target_column
            )
            X_train_time = preprocessor_train.create_time_features()

            # Add time features to test data
            preprocessor_test = TimeSeriesPreprocessor(
                self.X_test,
                self.target_column
            )
            X_test_time = preprocessor_test.create_time_features()

            # Update X_train and X_test
            self.X_train = X_train_time
            self.X_test = X_test_time
            self.feature_names = self.X_train.columns.tolist()

        print(f"Engineered features - Total features: {len(self.feature_names)}")

    def train_models(self):
        """Train multiple time series models."""
        model_selection_config = self.config.get('model_selection', {})
        estimators = model_selection_config.get('estimators', ['arima', 'random_forest_ts'])
        cv_folds = model_selection_config.get('cv_folds', 3)

        print(f"Training {len(estimators)} time series models...")

        for estimator_id in estimators:
            if estimator_id not in TIMESERIES_ESTIMATORS:
                print(f"Skipping unknown estimator: {estimator_id}")
                continue

            estimator_info = TIMESERIES_ESTIMATORS[estimator_id]
            print(f"\nTraining {estimator_info['name']}...")

            try:
                result = self._train_single_model(
                    estimator_id,
                    estimator_info,
                    cv_folds
                )
                self.results.append(result)

                # Track best model (lowest MAE)
                if result['metrics']['mae'] < self.best_score:
                    self.best_score = result['metrics']['mae']
                    self.best_model = result['model']
                    self.best_model_name = estimator_info['name']

                print(f"✓ {estimator_info['name']} - MAE: {result['metrics']['mae']:.4f}")

            except Exception as e:
                print(f"✗ {estimator_info['name']} failed: {str(e)}")
                self.results.append({
                    'model_name': estimator_info['name'],
                    'estimator_id': estimator_id,
                    'status': 'failed',
                    'error': str(e)
                })

        # Sort results by MAE
        self.results.sort(key=lambda x: x.get('metrics', {}).get('mae', float('inf')))

        print(f"\n✓ Best model: {self.best_model_name} (MAE: {self.best_score:.4f})")

    def _train_single_model(
        self,
        estimator_id: str,
        estimator_info: Dict[str, Any],
        cv_folds: int
    ) -> Dict[str, Any]:
        """
        Train a single time series model.

        Args:
            estimator_id: Estimator identifier
            estimator_info: Estimator configuration
            cv_folds: Number of CV folds for time series split

        Returns:
            Dictionary with model and metrics
        """
        category = estimator_info['category']
        estimator_class = estimator_info['class']
        default_params = estimator_info.get('default_params', {})

        if category == 'statistical':
            # Train statistical model (ARIMA, SARIMA, etc.)
            model = self._train_statistical_model(
                estimator_class,
                estimator_id,
                default_params
            )
        else:
            # Train ML model
            model = self._train_ml_model(
                estimator_class,
                estimator_id,
                default_params,
                cv_folds
            )

        # Calculate metrics
        metrics = self._calculate_metrics(model, category)

        return {
            'model_name': estimator_info['name'],
            'estimator_id': estimator_id,
            'category': category,
            'model': model,
            'metrics': metrics,
            'params': default_params,
            'status': 'success'
        }

    def _train_statistical_model(
        self,
        estimator_class: Any,
        estimator_id: str,
        params: Dict[str, Any]
    ):
        """Train statistical time series model (ARIMA, SARIMA, etc.)."""
        train_series = self.train_data[self.target_column]

        if estimator_id == 'arima':
            model = estimator_class(train_series, **params)
            fitted_model = model.fit()
            return fitted_model

        elif estimator_id == 'sarima':
            model = estimator_class(train_series, **params)
            fitted_model = model.fit()
            return fitted_model

        elif estimator_id == 'exponential_smoothing':
            # Remove seasonal_periods from params for ExponentialSmoothing
            es_params = params.copy()
            seasonal_periods = es_params.pop('seasonal_periods', None)
            model = estimator_class(
                train_series,
                seasonal_periods=seasonal_periods,
                **es_params
            )
            fitted_model = model.fit()
            return fitted_model

        else:
            raise ValueError(f"Unknown statistical model: {estimator_id}")

    def _train_ml_model(
        self,
        estimator_class: Any,
        estimator_id: str,
        params: Dict[str, Any],
        cv_folds: int
    ):
        """Train ML model with engineered features."""
        model = estimator_class(**params)

        # Use time series cross-validation
        tscv = TimeSeriesSplit(n_splits=cv_folds)
        cv_scores = []

        for train_idx, val_idx in tscv.split(self.X_train):
            X_tr, X_val = self.X_train.iloc[train_idx], self.X_train.iloc[val_idx]
            y_tr, y_val = self.y_train.iloc[train_idx], self.y_train.iloc[val_idx]

            model.fit(X_tr, y_tr)
            y_pred = model.predict(X_val)
            mae = mean_absolute_error(y_val, y_pred)
            cv_scores.append(mae)

        # Final training on full training set
        model.fit(self.X_train, self.y_train)

        return model

    def _calculate_metrics(self, model, category: str) -> Dict[str, float]:
        """
        Calculate time series metrics.

        Args:
            model: Trained model
            category: Model category ('statistical' or 'ml')

        Returns:
            Dictionary of metrics
        """
        if category == 'statistical':
            # Forecast for test period
            forecast = model.forecast(steps=len(self.test_data))
            y_true = self.test_data[self.target_column].values
            y_pred = forecast.values if hasattr(forecast, 'values') else forecast
        else:
            # ML model prediction
            y_pred = model.predict(self.X_test)
            y_true = self.y_test.values

        # Calculate metrics
        mae = mean_absolute_error(y_true, y_pred)
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100

        # SMAPE (Symmetric MAPE)
        smape = np.mean(2 * np.abs(y_pred - y_true) / (np.abs(y_true) + np.abs(y_pred))) * 100

        # WAPE (Weighted Absolute Percentage Error)
        wape = np.sum(np.abs(y_true - y_pred)) / np.sum(np.abs(y_true)) * 100

        # Directional Accuracy
        if len(y_true) > 1:
            true_direction = np.diff(y_true) > 0
            pred_direction = np.diff(y_pred) > 0
            directional_accuracy = np.mean(true_direction == pred_direction) * 100
        else:
            directional_accuracy = 0.0

        # Forecast Bias
        forecast_bias = np.mean(y_pred - y_true)

        return {
            'mae': float(mae),
            'mse': float(mse),
            'rmse': float(rmse),
            'mape': float(mape),
            'smape': float(smape),
            'wape': float(wape),
            'directional_accuracy': float(directional_accuracy),
            'forecast_bias': float(forecast_bias)
        }

    def evaluate_best_model(self) -> Dict[str, Any]:
        """Evaluate best model on test set."""
        if self.best_model is None:
            raise ValueError("No model has been trained yet")

        # Determine category
        category = 'statistical'
        for result in self.results:
            if result.get('model') == self.best_model:
                category = result['category']
                break

        # Get predictions
        if category == 'statistical':
            forecast = self.best_model.forecast(steps=len(self.test_data))
            y_pred = forecast.values if hasattr(forecast, 'values') else forecast
        else:
            y_pred = self.best_model.predict(self.X_test)

        y_true = self.test_data[self.target_column].values if category == 'statistical' else self.y_test.values

        # Calculate metrics
        test_metrics = self._calculate_metrics(self.best_model, category)

        # Feature importance (for ML models)
        feature_importance = {}
        if category == 'ml' and hasattr(self.best_model, 'feature_importances_'):
            feature_importance = dict(zip(
                self.feature_names,
                self.best_model.feature_importances_.tolist()
            ))

        return {
            'test_metrics': test_metrics,
            'feature_importance': feature_importance,
            'predictions': {
                'y_true': y_true.tolist(),
                'y_pred': y_pred.tolist(),
                'dates': self.test_data.index.astype(str).tolist() if category == 'statistical' else self.X_test.index.astype(str).tolist()
            }
        }

    def save_model(self, job_id: str) -> str:
        """
        Save best model to disk.

        Args:
            job_id: Training job ID

        Returns:
            Path to saved model
        """
        if self.best_model is None:
            raise ValueError("No model to save")

        model_filename = f"timeseries_model_{job_id}.pkl"
        model_path = self.output_dir / model_filename

        # Save model and metadata
        model_package = {
            'model': self.best_model,
            'model_name': self.best_model_name,
            'target_column': self.target_column,
            'date_column': self.date_column,
            'feature_names': self.feature_names,
            'config': self.config,
            'training_date': datetime.now().isoformat()
        }

        with open(model_path, 'wb') as f:
            pickle.dump(model_package, f)

        print(f"Model saved to: {model_path}")
        return str(model_path)

    def get_results_summary(self) -> Dict[str, Any]:
        """Get comprehensive results summary."""
        all_models = []
        for result in self.results:
            if result.get('status') == 'success':
                all_models.append({
                    'model_name': result['model_name'],
                    'estimator_id': result['estimator_id'],
                    'category': result['category'],
                    'metrics': result['metrics'],
                    'params': result['params']
                })

        return {
            'best_model': {
                'name': self.best_model_name,
                'mae': self.best_score
            },
            'all_models': all_models,
            'total_models_trained': len([r for r in self.results if r.get('status') == 'success']),
            'failed_models': len([r for r in self.results if r.get('status') == 'failed'])
        }

    def cleanup(self):
        """Clean up resources."""
        # Clear large objects from memory
        self.df = None
        self.train_data = None
        self.test_data = None
        self.X_train = None
        self.X_test = None
        self.results = []

        print("Cleaned up resources")
