"""
AutoML Regression Training Engine

Comprehensive regression training with preprocessing, feature engineering,
hyperparameter tuning, and model selection.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime
import pickle
import json
import warnings

# Scikit-learn preprocessing
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler,
    OneHotEncoder, OrdinalEncoder
)
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

# Feature engineering
from sklearn.preprocessing import PolynomialFeatures
from sklearn.feature_selection import (
    SelectKBest, f_regression, mutual_info_regression,
    SelectFromModel
)

# Model selection and evaluation
from sklearn.model_selection import (
    cross_validate, KFold, GridSearchCV,
    RandomizedSearchCV, train_test_split
)
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error,
    r2_score, explained_variance_score,
    median_absolute_error, max_error,
    mean_absolute_percentage_error, make_scorer
)

# Regression models
from sklearn.linear_model import (
    LinearRegression, Ridge, Lasso, ElasticNet,
    SGDRegressor, BayesianRidge, HuberRegressor,
    Lars, LassoLars, OrthogonalMatchingPursuit
)
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestRegressor, ExtraTreesRegressor,
    GradientBoostingRegressor, AdaBoostRegressor,
    HistGradientBoostingRegressor, BaggingRegressor
)
from sklearn.svm import SVR, NuSVR, LinearSVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.kernel_ridge import KernelRidge
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel

# XGBoost
try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    warnings.warn("XGBoost not available")

# LightGBM
try:
    from lightgbm import LGBMRegressor
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    warnings.warn("LightGBM not available")

# MLflow
import mlflow
import mlflow.sklearn

# Outlier detection
from sklearn.ensemble import IsolationForest
from scipy import stats

warnings.filterwarnings('ignore')


# ============================================================
# Estimator Registry
# ============================================================

# ============================================================
# Valid Scoring Metrics for Regression
# ============================================================

VALID_REGRESSION_METRICS = {
    'r2': {
        'name': 'R² Score',
        'sklearn_name': 'r2',
        'description': 'Coefficient of determination (higher is better, max=1.0)',
        'higher_is_better': True,
        'metric_key': 'r2_score'  # Key in _calculate_metrics output
    },
    'neg_mean_squared_error': {
        'name': 'Negative MSE',
        'sklearn_name': 'neg_mean_squared_error',
        'description': 'Negative mean squared error (higher/less negative is better)',
        'higher_is_better': True,
        'metric_key': 'mse'
    },
    'neg_root_mean_squared_error': {
        'name': 'Negative RMSE',
        'sklearn_name': 'neg_root_mean_squared_error',
        'description': 'Negative root mean squared error (higher/less negative is better)',
        'higher_is_better': True,
        'metric_key': 'rmse'
    },
    'neg_mean_absolute_error': {
        'name': 'Negative MAE',
        'sklearn_name': 'neg_mean_absolute_error',
        'description': 'Negative mean absolute error (higher/less negative is better)',
        'higher_is_better': True,
        'metric_key': 'mae'
    },
    'neg_median_absolute_error': {
        'name': 'Negative Median AE',
        'sklearn_name': 'neg_median_absolute_error',
        'description': 'Negative median absolute error (higher/less negative is better)',
        'higher_is_better': True,
        'metric_key': 'median_absolute_error'
    },
    'explained_variance': {
        'name': 'Explained Variance',
        'sklearn_name': 'explained_variance',
        'description': 'Explained variance score (higher is better)',
        'higher_is_better': True,
        'metric_key': 'explained_variance'
    }
}

# Default scoring metric for regression
DEFAULT_REGRESSION_METRIC = 'r2'

REGRESSION_ESTIMATORS = {
    # Linear models
    'linear_regression': {
        'class': LinearRegression,
        'default_params': {'n_jobs': -1},
        'param_grid': {
            'fit_intercept': [True, False]
        }
    },
    'ridge': {
        'class': Ridge,
        'default_params': {'random_state': 42},
        'param_grid': {
            'alpha': [0.1, 1.0, 10.0, 100.0, 1000.0],
            'solver': ['auto', 'svd', 'cholesky']
        }
    },
    'lasso': {
        'class': Lasso,
        'default_params': {'random_state': 42, 'max_iter': 1000},
        'param_grid': {
            'alpha': [0.001, 0.01, 0.1, 1.0, 10.0]
        }
    },
    'elastic_net': {
        'class': ElasticNet,
        'default_params': {'random_state': 42, 'max_iter': 1000},
        'param_grid': {
            'alpha': [0.001, 0.01, 0.1, 1.0],
            'l1_ratio': [0.2, 0.5, 0.8]
        }
    },
    'sgd_regressor': {
        'class': SGDRegressor,
        'default_params': {'random_state': 42, 'max_iter': 1000},
        'param_grid': {
            'penalty': ['l2', 'l1', 'elasticnet'],
            'alpha': [0.0001, 0.001, 0.01],
            'learning_rate': ['constant', 'optimal', 'invscaling']
        }
    },
    'bayesian_ridge': {
        'class': BayesianRidge,
        'default_params': {},
        'param_grid': {
            'alpha_1': [1e-6, 1e-5, 1e-4],
            'alpha_2': [1e-6, 1e-5, 1e-4],
            'lambda_1': [1e-6, 1e-5, 1e-4],
            'lambda_2': [1e-6, 1e-5, 1e-4]
        }
    },
    'huber': {
        'class': HuberRegressor,
        'default_params': {'max_iter': 1000},
        'param_grid': {
            'epsilon': [1.1, 1.35, 1.5, 2.0],
            'alpha': [0.0001, 0.001, 0.01]
        }
    },

    # Tree-based models
    'decision_tree': {
        'class': DecisionTreeRegressor,
        'default_params': {'random_state': 42},
        'param_grid': {
            'max_depth': [3, 5, 10, 20, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4],
            'splitter': ['best', 'random']
        }
    },
    'random_forest': {
        'class': RandomForestRegressor,
        'default_params': {'random_state': 42, 'n_jobs': -1},
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'max_depth': [5, 10, 20, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        }
    },
    'extra_trees': {
        'class': ExtraTreesRegressor,
        'default_params': {'random_state': 42, 'n_jobs': -1},
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'max_depth': [5, 10, 20, None],
            'min_samples_split': [2, 5],
            'min_samples_leaf': [1, 2]
        }
    },

    # Boosting models
    'gradient_boosting': {
        'class': GradientBoostingRegressor,
        'default_params': {'random_state': 42},
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'learning_rate': [0.01, 0.1, 0.3],
            'max_depth': [3, 5, 7],
            'subsample': [0.8, 1.0]
        }
    },
    'hist_gradient_boosting': {
        'class': HistGradientBoostingRegressor,
        'default_params': {'random_state': 42},
        'param_grid': {
            'learning_rate': [0.01, 0.1, 0.3],
            'max_depth': [3, 5, 10],
            'max_iter': [50, 100, 200],
            'l2_regularization': [0.0, 0.1, 1.0]
        }
    },
    'adaboost': {
        'class': AdaBoostRegressor,
        'default_params': {'random_state': 42},
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'learning_rate': [0.01, 0.1, 1.0],
            'loss': ['linear', 'square', 'exponential']
        }
    },

    # SVM models
    'svr': {
        'class': SVR,
        'default_params': {},
        'param_grid': {
            'C': [0.1, 1, 10],
            'kernel': ['rbf', 'linear', 'poly'],
            'gamma': ['scale', 'auto'],
            'epsilon': [0.01, 0.1, 0.2]
        }
    },
    'nu_svr': {
        'class': NuSVR,
        'default_params': {},
        'param_grid': {
            'nu': [0.25, 0.5, 0.75],
            'C': [0.1, 1, 10],
            'kernel': ['rbf', 'linear']
        }
    },
    'linear_svr': {
        'class': LinearSVR,
        'default_params': {'random_state': 42, 'max_iter': 1000},
        'param_grid': {
            'C': [0.1, 1, 10],
            'epsilon': [0.0, 0.1, 0.2],
            'loss': ['epsilon_insensitive', 'squared_epsilon_insensitive']
        }
    },

    # Other models
    'knn': {
        'class': KNeighborsRegressor,
        'default_params': {'n_jobs': -1},
        'param_grid': {
            'n_neighbors': [3, 5, 7, 9, 11],
            'weights': ['uniform', 'distance'],
            'p': [1, 2]
        }
    },
    'mlp': {
        'class': MLPRegressor,
        'default_params': {'random_state': 42, 'max_iter': 500},
        'param_grid': {
            'hidden_layer_sizes': [(50,), (100,), (50, 50), (100, 50)],
            'activation': ['relu', 'tanh'],
            'alpha': [0.0001, 0.001, 0.01],
            'learning_rate': ['constant', 'adaptive']
        }
    },
    'kernel_ridge': {
        'class': KernelRidge,
        'default_params': {},
        'param_grid': {
            'alpha': [0.1, 1.0, 10.0],
            'kernel': ['linear', 'rbf', 'polynomial'],
            'gamma': [None, 0.1, 1.0]
        }
    },
    'gaussian_process': {
        'class': GaussianProcessRegressor,
        'default_params': {'random_state': 42},
        'param_grid': {
            'alpha': [1e-10, 1e-5, 1e-2],
            'normalize_y': [True, False]
        }
    },
}

# Add XGBoost if available
if XGBOOST_AVAILABLE:
    REGRESSION_ESTIMATORS['xgboost'] = {
        'class': XGBRegressor,
        'default_params': {
            'random_state': 42,
            'n_jobs': -1,
            'verbosity': 0
        },
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'max_depth': [3, 5, 7],
            'learning_rate': [0.01, 0.1, 0.3],
            'subsample': [0.6, 0.8, 1.0],
            'colsample_bytree': [0.6, 0.8, 1.0],
            'reg_alpha': [0, 0.1, 1],
            'reg_lambda': [0, 0.1, 1]
        }
    }

# Add LightGBM if available
if LIGHTGBM_AVAILABLE:
    REGRESSION_ESTIMATORS['lightgbm'] = {
        'class': LGBMRegressor,
        'default_params': {
            'random_state': 42,
            'n_jobs': -1,
            'verbosity': -1
        },
        'param_grid': {
            'n_estimators': [50, 100, 200],
            'max_depth': [3, 5, 7, -1],
            'learning_rate': [0.01, 0.1, 0.3],
            'num_leaves': [15, 31, 63],
            'subsample': [0.6, 0.8, 1.0],
            'colsample_bytree': [0.6, 0.8, 1.0]
        }
    }


# ============================================================
# Regression Trainer
# ============================================================

class RegressionTrainer:
    """
    Comprehensive AutoML regression trainer.

    Handles:
    - Data preprocessing (scaling, encoding, missing values, outliers)
    - Feature engineering (polynomial features, feature selection)
    - Model training with hyperparameter tuning
    - Cross-validation
    - MLflow tracking
    - Comprehensive metrics calculation
    """

    def __init__(
        self,
        config: Dict[str, Any],
        dataset_path: str,
        target_column: str,
        output_dir: str = "models"
    ):
        self.config = config
        self.dataset_path = dataset_path
        self.target_column = target_column
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

        # Data containers
        self.df = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.X_processed = None
        self.y_processed = None

        # Preprocessing components
        self.preprocessor = None
        self.target_scaler = None
        self.feature_names = None
        
        # Feature engineering transformers (FIX: Store for test set application)
        self.poly_transformer = None
        self.feature_selector = None

        # Results
        self.results = {}
        self.best_model = None
        self.best_model_name = None
        self.best_score = -np.inf

        # MLflow
        self.mlflow_run_id = None

    def load_data(self) -> None:
        """Load dataset from file"""
        print(f"Loading dataset from {self.dataset_path}")
        self.df = pd.read_csv(self.dataset_path)
        print(f"Loaded {len(self.df)} rows, {len(self.df.columns)} columns")

    def preprocess_data(self) -> None:
        """
        Preprocess data according to configuration.

        Steps:
        1. Split features and target
        2. Split train/test (BEFORE outlier handling to prevent data leakage)
        3. Handle outliers (on training set only)
        4. Build preprocessing pipeline
        5. Transform data
        """
        print("\n" + "="*60)
        print("PREPROCESSING DATA")
        print("="*60)

        # Separate features and target
        X = self.df.drop(columns=[self.target_column])
        y = self.df[self.target_column]

        print(f"Target variable: {self.target_column}")
        print(f"Target stats: min={y.min():.2f}, max={y.max():.2f}, mean={y.mean():.2f}, std={y.std():.2f}")

        # FIX: Always reserve 20% test set for evaluation and visualizations
        # This is separate from the validation strategy (cross-validation still used for model selection)
        test_split = 0.2

        # Split train/test BEFORE outlier handling (prevents data leakage)
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            X, y, test_size=test_split, random_state=42
        )
        print(f"Train+Val set: {len(self.X_train)} samples ({(1-test_split)*100:.0f}%)")
        print(f"Test set: {len(self.X_test)} samples ({test_split*100:.0f}%) - for final evaluation & visualizations")

        # Handle outliers AFTER split (on training set only)
        preproc_config = self.config.get('preprocessing', {})
        if preproc_config.get('handle_outliers', False):
            outlier_method = preproc_config.get('outlier_method', 'iqr')
            self.X_train, self.y_train = self._handle_outliers(
                self.X_train, 
                self.y_train, 
                outlier_method
            )
            print(f"After outlier handling - Train+Val set: {len(self.X_train)} samples")

        # Build preprocessing pipeline
        self.preprocessor = self._build_preprocessor(self.X_train)

        # Transform data
        self.X_processed = self.preprocessor.fit_transform(self.X_train)
        self.y_processed = self.y_train.values

        # Optional: scale target variable for some models
        scale_target = preproc_config.get('scale_target', False)
        if scale_target:
            self.target_scaler = StandardScaler()
            self.y_processed = self.target_scaler.fit_transform(
                self.y_processed.reshape(-1, 1)
            ).ravel()
            print("Target variable scaled")

        # Store feature names for later use
        self.feature_names = self._get_feature_names()

        print(f"Processed features shape: {self.X_processed.shape}")
        print(f"Number of features: {self.X_processed.shape[1]}")

    def _handle_outliers(self, X: pd.DataFrame, y: pd.Series, method: str) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Handle outliers using specified method.
        
        FIX: Consistent with classification trainer, improved statistical approach.
        """
        print(f"Handling outliers using method: {method}")

        numeric_cols = X.select_dtypes(include=[np.number]).columns
        X_clean = X.copy()
        y_clean = y.copy()

        if method == 'iqr':
            # FIX: Option to clip (windsorize) instead of remove for consistency
            clip_outliers = self.config.get('preprocessing', {}).get('clip_outliers', False)
            
            if clip_outliers:
                # Clip outliers (windsorization) - keeps all rows
                for col in numeric_cols:
                    Q1 = X[col].quantile(0.25)
                    Q3 = X[col].quantile(0.75)
                    IQR = Q3 - Q1
                    lower = Q1 - 1.5 * IQR
                    upper = Q3 + 1.5 * IQR
                    X_clean[col] = X[col].clip(lower, upper)
                
                # Clip target outliers
                Q1 = y.quantile(0.25)
                Q3 = y.quantile(0.75)
                IQR = Q3 - Q1
                lower = Q1 - 1.5 * IQR
                upper = Q3 + 1.5 * IQR
                y_clean = y.clip(lower, upper)
                print(f"Clipped outliers in {len(numeric_cols)} features and target")
            else:
                # Remove outlier rows (original behavior)
                for col in numeric_cols:
                    Q1 = X[col].quantile(0.25)
                    Q3 = X[col].quantile(0.75)
                    IQR = Q3 - Q1
                    lower = Q1 - 1.5 * IQR
                    upper = Q3 + 1.5 * IQR
                    X_clean[col] = X[col].clip(lower, upper)

                # Remove outliers from target
                Q1 = y.quantile(0.25)
                Q3 = y.quantile(0.75)
                IQR = Q3 - Q1
                lower = Q1 - 1.5 * IQR
                upper = Q3 + 1.5 * IQR
                mask = (y >= lower) & (y <= upper)
                X_clean = X_clean[mask].reset_index(drop=True)
                y_clean = y_clean[mask].reset_index(drop=True)
                print(f"Removed {(~mask).sum()} outlier samples based on IQR")

        elif method == 'zscore':
            # Remove samples with extreme z-scores
            z_threshold = 3
            z_scores_X = np.abs(stats.zscore(X[numeric_cols].fillna(0), axis=0))
            z_scores_y = np.abs(stats.zscore(y))
            mask = (z_scores_X < z_threshold).all(axis=1) & (z_scores_y < z_threshold)
            X_clean = X_clean[mask].reset_index(drop=True)
            y_clean = y_clean[mask].reset_index(drop=True)
            print(f"Removed {(~mask).sum()} outlier samples based on z-scores")

        elif method == 'isolation_forest':
            # Combine X and y for outlier detection
            combined = pd.concat([X[numeric_cols].fillna(0), y], axis=1)
            iso_forest = IsolationForest(contamination=0.05, random_state=42)  # FIX: Reduced from 0.1 to 0.05
            outliers = iso_forest.fit_predict(combined)
            mask = outliers == 1
            X_clean = X_clean[mask].reset_index(drop=True)
            y_clean = y_clean[mask].reset_index(drop=True)
            print(f"Removed {(~mask).sum()} outlier samples using Isolation Forest")

        return X_clean, y_clean

    def _build_preprocessor(self, X: pd.DataFrame) -> ColumnTransformer:
        """Build preprocessing pipeline based on configuration"""
        preproc_config = self.config.get('preprocessing', {})

        # Identify column types
        numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
        categorical_features = X.select_dtypes(include=['object', 'category']).columns.tolist()

        print(f"Numeric features: {len(numeric_features)}")
        print(f"Categorical features: {len(categorical_features)}")

        # Numeric transformer
        numeric_transformer = Pipeline(steps=[
            ('imputer', self._get_imputer(preproc_config.get('missing_strategy', 'median'))),
            ('scaler', self._get_scaler(preproc_config.get('scaling_method', 'standard')))
        ])

        # Categorical transformer
        categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('encoder', self._get_encoder(preproc_config.get('categorical_encoding', 'onehot')))
        ])

        # Combine transformers
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', numeric_transformer, numeric_features),
                ('cat', categorical_transformer, categorical_features)
            ],
            remainder='drop'
        )

        return preprocessor

    def _get_imputer(self, strategy: str):
        """Get imputer based on strategy"""
        if strategy == 'knn':
            return KNNImputer(n_neighbors=5)
        elif strategy in ['mean', 'median', 'most_frequent']:
            return SimpleImputer(strategy=strategy)
        else:
            return SimpleImputer(strategy='median')

    def _get_scaler(self, method: str):
        """Get scaler based on method"""
        if method == 'standard':
            return StandardScaler()
        elif method == 'minmax':
            return MinMaxScaler()
        elif method == 'robust':
            return RobustScaler()
        else:
            return StandardScaler()

    def _get_encoder(self, method: str):
        """Get encoder based on method"""
        if method == 'onehot':
            return OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        elif method == 'ordinal':
            return OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        else:
            return OneHotEncoder(sparse_output=False, handle_unknown='ignore')

    def _get_feature_names(self) -> List[str]:
        """Extract feature names after preprocessing"""
        try:
            feature_names = []
            for name, transformer, features in self.preprocessor.transformers_:
                if name == 'num':
                    feature_names.extend(features)
                elif name == 'cat':
                    if hasattr(transformer.named_steps['encoder'], 'get_feature_names_out'):
                        cat_features = transformer.named_steps['encoder'].get_feature_names_out(features)
                        feature_names.extend(cat_features)
                    else:
                        feature_names.extend(features)
            return feature_names
        except:
            return [f"feature_{i}" for i in range(self.X_processed.shape[1])]

    def engineer_features(self) -> None:
        """
        Apply feature engineering transformations.
        
        FIX: Store transformers for application to test set.
        """
        feat_config = self.config.get('feature_engineering', {})

        if not feat_config.get('polynomial_features', False) and not feat_config.get('feature_selection', False):
            print("No feature engineering configured")
            return

        print("\n" + "="*60)
        print("FEATURE ENGINEERING")
        print("="*60)

        # Polynomial features
        if feat_config.get('polynomial_features', False):
            degree = feat_config.get('polynomial_degree', 2)
            print(f"Generating polynomial features (degree={degree})")
            
            # FIX: Store transformer for test set application
            self.poly_transformer = PolynomialFeatures(degree=degree, include_bias=False)
            self.X_processed = self.poly_transformer.fit_transform(self.X_processed)
            print(f"New shape after polynomial features: {self.X_processed.shape}")

        # Feature selection
        if feat_config.get('feature_selection', False):
            n_features = feat_config.get('n_features', 20)
            method = feat_config.get('selection_method', 'selectkbest')
            print(f"Selecting top {n_features} features using {method}")

            if method == 'selectkbest':
                self.feature_selector = SelectKBest(f_regression, k=min(n_features, self.X_processed.shape[1]))
            elif method == 'mutual_info':
                self.feature_selector = SelectKBest(mutual_info_regression, k=min(n_features, self.X_processed.shape[1]))
            else:
                self.feature_selector = SelectKBest(f_regression, k=min(n_features, self.X_processed.shape[1]))

            # FIX: Store selector and apply to training data
            self.X_processed = self.feature_selector.fit_transform(self.X_processed, self.y_processed)
            print(f"Final shape after feature selection: {self.X_processed.shape}")

    def train_models(self) -> None:
        """Train all configured models with hyperparameter tuning"""
        print("\n" + "="*60)
        print("TRAINING MODELS")
        print("="*60)

        model_config = self.config.get('model_selection', {})
        tuning_config = self.config.get('hyperparameter_tuning', {})

        estimator_names = model_config.get('estimators', [])
        validation_strategy = model_config.get('validation_strategy', 'cross_validation')
        cv_folds = model_config.get('cv_folds', 5)
        test_size = model_config.get('test_size', 0.2)
        scoring_metric = model_config.get('scoring_metric', DEFAULT_REGRESSION_METRIC)

        # Validate scoring metric
        if scoring_metric not in VALID_REGRESSION_METRICS:
            print(f"⚠ Warning: Invalid scoring metric '{scoring_metric}' for regression.")
            print(f"  Valid options: {', '.join(VALID_REGRESSION_METRICS.keys())}")
            print(f"  Defaulting to '{DEFAULT_REGRESSION_METRIC}'")
            scoring_metric = DEFAULT_REGRESSION_METRIC

        metric_info = VALID_REGRESSION_METRICS[scoring_metric]
        print(f"Training {len(estimator_names)} models")
        print(f"Validation strategy: {validation_strategy}")
        if validation_strategy == 'cross_validation':
            print(f"Cross-validation folds: {cv_folds}")
        else:
            print(f"Validation split: {test_size*100:.0f}%")
        print(f"Scoring metric: {metric_info['name']} ({scoring_metric})")

        # Initialize MLflow if enabled
        mlflow_config = self.config.get('mlflow', {})
        if mlflow_config.get('enabled', True):
            self._init_mlflow(mlflow_config)

        # Train each estimator
        for i, est_name in enumerate(estimator_names, 1):
            print(f"\n[{i}/{len(estimator_names)}] Training {est_name}")

            if est_name not in REGRESSION_ESTIMATORS:
                print(f"  ⚠ Estimator '{est_name}' not found, skipping")
                continue

            try:
                result = self._train_single_model(
                    est_name,
                    cv_folds,
                    scoring_metric,
                    tuning_config,
                    validation_strategy,
                    test_size
                )

                self.results[est_name] = result

                # Log score
                val_score = result['validation_score']
                if validation_strategy == 'cross_validation' and 'validation_std' in result:
                    print(f"  ✓ Score: {val_score:.4f} (±{result['validation_std']:.4f})")
                else:
                    print(f"  ✓ Score: {val_score:.4f}")

            except Exception as e:
                print(f"  ✗ Error: {str(e)}")
                import traceback
                traceback.print_exc()
                continue

        # Select best model AFTER all training completes
        if not self.results:
            raise ValueError("No models were successfully trained!")

        print(f"\n{'='*60}")
        print("SELECTING BEST MODEL")
        print(f"{'='*60}")

        # Use validation_score for model selection (consistent across strategies)
        all_scores = {name: result['validation_score'] for name, result in self.results.items()}

        # Sort by score (higher is better for all our metrics after neg_ conversion)
        sorted_scores = sorted(all_scores.items(), key=lambda x: x[1], reverse=metric_info['higher_is_better'])
        print(f"\n📊 All model scores (sorted by {metric_info['name']}):")
        for rank, (name, score) in enumerate(sorted_scores, 1):
            marker = "🏆" if rank == 1 else f"{rank}."
            result = self.results[name]
            if validation_strategy == 'cross_validation' and 'validation_std' in result:
                print(f"  {marker} {name}: {score:.4f} (±{result['validation_std']:.4f})")
            else:
                print(f"  {marker} {name}: {score:.4f}")

        # Select the model with the best validation score
        self.best_model_name = sorted_scores[0][0]
        self.best_score = sorted_scores[0][1]
        self.best_model = self.results[self.best_model_name]['model']

        print(f"\n✅ Selected best model: {self.best_model_name}")
        print(f"   {metric_info['name']}: {self.best_score:.4f}")
        
        # Show R² for reference if it's not the primary metric
        if scoring_metric != 'r2':
            r2_key = 'train_r2_score' if 'train_r2_score' in self.results[self.best_model_name]['metrics'] else None
            if r2_key:
                print(f"   R² Score: {self.results[self.best_model_name]['metrics'][r2_key]:.4f}")

    def _init_mlflow(self, mlflow_config: Dict) -> None:
        """Initialize MLflow tracking"""
        experiment_name = mlflow_config.get('experiment_name', 'automl_regression')
        tracking_uri = mlflow_config.get('tracking_uri', 'sqlite:///mlflow.db')

        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(experiment_name=experiment_name)

        # Start parent run
        run = mlflow.start_run()
        self.mlflow_run_id = run.info.run_id

        # Log configuration
        mlflow.log_params({
            'dataset': self.dataset_path,
            'target_column': self.target_column,
            'n_samples': len(self.X_train),
            'n_features': self.X_processed.shape[1]
        })

    def _train_single_model(
        self,
        est_name: str,
        cv_folds: int,
        scoring_metric: str,
        tuning_config: Dict,
        validation_strategy: str = "cross_validation",
        test_size: float = 0.2
    ) -> Dict[str, Any]:
        """
        Train a single model with hyperparameter tuning.
        
        Supports two validation strategies:
        1. cross_validation: Use cross-validation for model evaluation
        2. train_test_split: Use a holdout validation set
        
        Returns metrics in a consistent format for both strategies.
        """
        est_info = REGRESSION_ESTIMATORS[est_name]

        # Get base estimator
        base_estimator = est_info['class'](**est_info['default_params'])

        # Hyperparameter tuning
        search_method = tuning_config.get('search_method', 'grid')
        n_iter = tuning_config.get('n_iter', 10)

        # Validate scoring metric
        if scoring_metric not in VALID_REGRESSION_METRICS:
            print(f"  ⚠ Invalid scoring metric '{scoring_metric}', using default 'r2'")
            scoring_metric = DEFAULT_REGRESSION_METRIC
        
        sklearn_scoring = VALID_REGRESSION_METRICS[scoring_metric]['sklearn_name']
        metric_key = VALID_REGRESSION_METRICS[scoring_metric]['metric_key']

        start_time = datetime.now()

        if validation_strategy == "train_test_split":
            # Split training data into train and validation sets
            X_train_inner, X_val_inner, y_train_inner, y_val_inner = train_test_split(
                self.X_processed, self.y_processed,
                test_size=test_size,
                random_state=42
            )

            # Perform hyperparameter search on train_inner
            if search_method == 'grid':
                search = GridSearchCV(
                    base_estimator,
                    param_grid=est_info['param_grid'],
                    cv=3,  # Use small CV for param tuning within train_inner
                    scoring=sklearn_scoring,
                    n_jobs=-1,
                    verbose=0
                )
            else:  # random search
                search = RandomizedSearchCV(
                    base_estimator,
                    param_distributions=est_info['param_grid'],
                    n_iter=n_iter,
                    cv=3,
                    scoring=sklearn_scoring,
                    n_jobs=-1,
                    random_state=42,
                    verbose=0
                )

            # Fit on train_inner
            search.fit(X_train_inner, y_train_inner)
            best_model = search.best_estimator_

            # Calculate metrics on validation set
            val_metrics = self._calculate_metrics(best_model, X_val_inner, y_val_inner)
            train_metrics = self._calculate_metrics(best_model, X_train_inner, y_train_inner)

            training_time = (datetime.now() - start_time).total_seconds()

            # Structure metrics consistently
            validation_score = val_metrics[metric_key]
            train_score = train_metrics[metric_key]

            metrics = {
                'validation_score': validation_score,  # Main score for model selection
                'train_score': train_score,
                **{f'val_{k}': v for k, v in val_metrics.items()},
                **{f'train_{k}': v for k, v in train_metrics.items()}
            }

            # Log to MLflow if enabled
            if self.mlflow_run_id:
                with mlflow.start_run(run_name=est_name, nested=True):
                    mlflow.log_params(search.best_params_)
                    mlflow.log_metrics(metrics)
                    mlflow.log_metric('training_time', training_time)
                    mlflow.sklearn.log_model(best_model, est_name)

            return {
                'model': best_model,
                'estimator_name': est_name,
                'best_params': search.best_params_,
                'validation_score': validation_score,
                'train_score': train_score,
                'metrics': metrics,
                'training_time': training_time,
                'validation_strategy': 'train_test_split'
            }

        else:  # cross_validation strategy
            if search_method == 'grid':
                search = GridSearchCV(
                    base_estimator,
                    param_grid=est_info['param_grid'],
                    cv=KFold(n_splits=cv_folds, shuffle=True, random_state=42),
                    scoring=sklearn_scoring,
                    n_jobs=-1,
                    verbose=0,
                    return_train_score=True
                )
            else:  # random search
                search = RandomizedSearchCV(
                    base_estimator,
                    param_distributions=est_info['param_grid'],
                    n_iter=n_iter,
                    cv=KFold(n_splits=cv_folds, shuffle=True, random_state=42),
                    scoring=sklearn_scoring,
                    n_jobs=-1,
                    random_state=42,
                    verbose=0,
                    return_train_score=True
                )

            # Fit
            search.fit(self.X_processed, self.y_processed)
            training_time = (datetime.now() - start_time).total_seconds()

            # Best model
            best_model = search.best_estimator_

            # Extract CV metrics
            best_idx = search.best_index_
            cv_score = search.best_score_
            cv_std = search.cv_results_['std_test_score'][best_idx]
            train_score_mean = search.cv_results_['mean_train_score'][best_idx]
            train_score_std = search.cv_results_['std_train_score'][best_idx]

            # Calculate full metrics on entire training set for reference
            train_metrics_full = self._calculate_metrics(best_model, self.X_processed, self.y_processed)

            metrics = {
                'validation_score': cv_score,  # Main score for model selection (mean CV score)
                'validation_std': cv_std,
                'train_score': train_score_mean,
                'train_std': train_score_std,
                **{f'train_{k}': v for k, v in train_metrics_full.items()}
            }

            # Log to MLflow if enabled
            if self.mlflow_run_id:
                with mlflow.start_run(run_name=est_name, nested=True):
                    mlflow.log_params(search.best_params_)
                    mlflow.log_metrics(metrics)
                    mlflow.log_metric('training_time', training_time)
                    mlflow.sklearn.log_model(best_model, est_name)

            return {
                'model': best_model,
                'estimator_name': est_name,
                'best_params': search.best_params_,
                'validation_score': cv_score,
                'validation_std': cv_std,
                'train_score': train_score_mean,
                'metrics': metrics,
                'training_time': training_time,
                'validation_strategy': 'cross_validation'
            }

    def _calculate_metrics(self, model, X, y) -> Dict[str, float]:
        """Calculate comprehensive regression metrics"""
        y_pred = model.predict(X)

        # Inverse scale predictions if target was scaled
        if self.target_scaler:
            y_actual = self.target_scaler.inverse_transform(y.reshape(-1, 1)).ravel()
            y_pred_actual = self.target_scaler.inverse_transform(y_pred.reshape(-1, 1)).ravel()
        else:
            y_actual = y
            y_pred_actual = y_pred

        metrics = {
            'r2_score': r2_score(y_actual, y_pred_actual),
            'mse': mean_squared_error(y_actual, y_pred_actual),
            'rmse': np.sqrt(mean_squared_error(y_actual, y_pred_actual)),
            'mae': mean_absolute_error(y_actual, y_pred_actual),
            'median_absolute_error': median_absolute_error(y_actual, y_pred_actual),
            'max_error': max_error(y_actual, y_pred_actual),
            'explained_variance': explained_variance_score(y_actual, y_pred_actual)
        }

        # Add MAPE if no zero values in y
        if not np.any(y_actual == 0):
            try:
                metrics['mape'] = mean_absolute_percentage_error(y_actual, y_pred_actual)
            except:
                pass

        # Calculate adjusted R² if possible
        n = len(y_actual)
        p = X.shape[1]
        if n > p + 1:
            r2 = metrics['r2_score']
            adjusted_r2 = 1 - (1 - r2) * (n - 1) / (n - p - 1)
            metrics['adjusted_r2'] = adjusted_r2

        return metrics

    def evaluate_best_model(self) -> Dict[str, Any]:
        """
        Evaluate best model on test set.
        
        FIX: Apply stored transformers to test set (prevents data leakage).
        Returns None if no test set was configured (test_split = 0).
        """
        # Skip evaluation if no test set
        if self.X_test is None or self.y_test is None:
            print("\n" + "="*60)
            print("NO TEST SET EVALUATION")
            print("="*60)
            print("⚠ No test set configured (test_split = 0)")
            print("  Use validation metrics for model performance assessment")
            return None

        print("\n" + "="*60)
        print("EVALUATING BEST MODEL ON TEST SET")
        print("="*60)

        # Transform test data using fitted preprocessor
        X_test_processed = self.preprocessor.transform(self.X_test)

        # FIX: Apply stored feature engineering transformers (if they exist)
        if self.poly_transformer is not None:
            X_test_processed = self.poly_transformer.transform(X_test_processed)
            print(f"Applied polynomial features to test set: {X_test_processed.shape}")
        
        if self.feature_selector is not None:
            X_test_processed = self.feature_selector.transform(X_test_processed)
            print(f"Applied feature selection to test set: {X_test_processed.shape}")

        # Calculate test metrics
        test_metrics = self._calculate_metrics(self.best_model, X_test_processed, self.y_test.values)

        print(f"Best model: {self.best_model_name}")
        print(f"Test R²: {test_metrics['r2_score']:.4f}")
        print(f"Test RMSE: {test_metrics['rmse']:.4f}")
        print(f"Test MAE: {test_metrics['mae']:.4f}")

        # Get feature importance if available
        feature_importance = self._get_feature_importance()

        # Generate predictions for visualization
        y_pred = self.best_model.predict(X_test_processed)
        if self.target_scaler:
            y_test_actual = self.target_scaler.inverse_transform(self.y_test.values.reshape(-1, 1)).ravel()
            y_pred_actual = self.target_scaler.inverse_transform(y_pred.reshape(-1, 1)).ravel()
        else:
            y_test_actual = self.y_test.values
            y_pred_actual = y_pred

        # Calculate residuals
        residuals = y_test_actual - y_pred_actual

        return {
            'test_metrics': test_metrics,
            'feature_importance': feature_importance,
            'predictions': {
                'y_true': y_test_actual.tolist(),
                'y_pred': y_pred_actual.tolist(),
                'residuals': residuals.tolist()
            }
        }

    def _get_feature_importance(self) -> Dict[str, float]:
        """Extract feature importance from best model"""
        if hasattr(self.best_model, 'feature_importances_'):
            importances = self.best_model.feature_importances_
        elif hasattr(self.best_model, 'coef_'):
            importances = np.abs(self.best_model.coef_)
        else:
            return {}

        # Map to feature names
        n_features = min(len(self.feature_names), len(importances))
        feature_imp = {
            self.feature_names[i]: float(importances[i])
            for i in range(n_features)
        }

        # Sort by importance
        feature_imp = dict(sorted(feature_imp.items(), key=lambda x: x[1], reverse=True))

        return feature_imp

    def save_model(self, job_id: str) -> str:
        """Save best model and artifacts"""
        print("\n" + "="*60)
        print("SAVING MODEL")
        print("="*60)

        model_dir = self.output_dir / job_id
        model_dir.mkdir(exist_ok=True)

        # Save model
        model_path = model_dir / "model.pkl"
        with open(model_path, 'wb') as f:
            pickle.dump(self.best_model, f)

        # Save preprocessor
        preprocessor_path = model_dir / "preprocessor.pkl"
        with open(preprocessor_path, 'wb') as f:
            pickle.dump(self.preprocessor, f)

        # Save target scaler if used
        if self.target_scaler:
            target_scaler_path = model_dir / "target_scaler.pkl"
            with open(target_scaler_path, 'wb') as f:
                pickle.dump(self.target_scaler, f)

        # Save metadata
        metadata = {
            'model_name': self.best_model_name,
            'target_column': self.target_column,
            'feature_names': self.feature_names,
            'config': self.config,
            'target_scaled': self.target_scaler is not None
        }

        metadata_path = model_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)

        print(f"Model saved to: {model_path}")
        
        # Save all trained models for multi-model testing
        all_model_paths = self.save_all_models(job_id)

        return str(model_path)

    def save_all_models(self, job_id: str) -> Dict[str, str]:
        """
        Save all trained models for multi-model testing.
        
        Each model is saved in a subdirectory under all_models/:
        models/{job_id}/all_models/{estimator_name}/model.pkl
        
        Args:
            job_id: The training job ID
            
        Returns:
            Dictionary mapping estimator names to their model paths
        """
        print("\n" + "="*60)
        print("SAVING ALL MODELS")
        print("="*60)
        
        all_model_paths = {}
        model_dir = self.output_dir / job_id / "all_models"
        model_dir.mkdir(parents=True, exist_ok=True)
        
        for est_name, result in self.results.items():
            est_dir = model_dir / est_name
            est_dir.mkdir(exist_ok=True)
            
            model_path = est_dir / "model.pkl"
            with open(model_path, "wb") as f:
                pickle.dump(result["model"], f)
            
            all_model_paths[est_name] = str(model_path)
            print(f"  Saved {est_name} to {model_path}")
        
        print(f"\nSaved {len(all_model_paths)} models to {model_dir}")
        
        return all_model_paths

    def get_results_summary(self) -> Dict[str, Any]:
        """Get comprehensive training results summary"""
        best_result = self.results[self.best_model_name]

        # Split metrics by prefix (val_, train_)
        all_metrics = best_result['metrics']
        val_metrics = {k.replace('val_', ''): v for k, v in all_metrics.items() if k.startswith('val_')}
        train_metrics = {k.replace('train_', ''): v for k, v in all_metrics.items() if k.startswith('train_')}

        # Build best_model dict with fields that actually exist
        best_model_dict = {
            'estimator_name': self.best_model_name,
            'estimator_id': self.best_model_name,
            'hyperparameters': best_result['best_params'],
            'validation_score': float(best_result['validation_score']),
            'validation_strategy': best_result.get('validation_strategy', 'cross_validation')
        }

        # Add separated metrics
        if val_metrics:
            best_model_dict['val_metrics'] = val_metrics
        if train_metrics:
            best_model_dict['train_metrics'] = train_metrics

        # Add strategy-specific fields
        if best_result.get('validation_strategy') == 'cross_validation':
            if 'validation_std' in best_result:
                best_model_dict['validation_std'] = float(best_result['validation_std'])
            if 'train_score' in best_result:
                best_model_dict['train_score'] = float(best_result['train_score'])
        else:  # train_test_split
            if 'train_score' in best_result:
                best_model_dict['train_score'] = float(best_result['train_score'])

        # Add training time if available
        if 'training_time' in best_result:
            best_model_dict['training_time'] = float(best_result['training_time'])

        return {
            'best_model': best_model_dict,
            'all_models': [
                {
                    'estimator_name': name,
                    'metrics': result['metrics'],
                    'validation_score': float(result['validation_score']),
                    'validation_std': float(result.get('validation_std', 0)),
                    'training_time': result.get('training_time', 0),
                    'validation_strategy': result.get('validation_strategy', 'cross_validation')
                }
                for name, result in self.results.items()
            ],
            'mlflow_run_id': self.mlflow_run_id
        }

    def cleanup(self) -> None:
        """Cleanup resources and close MLflow run"""
        if self.mlflow_run_id:
            mlflow.end_run()
