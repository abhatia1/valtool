// fe/types/regression.ts

export type RegressionEstimator =
  | 'linear_regression'
  | 'ridge'
  | 'lasso'
  | 'elasticnet'
  | 'sgd_regressor'
  | 'bayesian_ridge'
  | 'huber'
  | 'decision_tree_regressor'
  | 'random_forest_regressor'
  | 'extra_trees_regressor'
  | 'gradient_boosting_regressor'
  | 'hist_gradient_boosting_regressor'
  | 'adaboost_regressor'
  | 'svr'
  | 'nu_svr'
  | 'linear_svr'
  | 'knn_regressor'
  | 'mlp_regressor'
  | 'kernel_ridge'
  | 'gaussian_process'
  | 'xgboost'
  | 'lightgbm';

export interface RegressionMetrics {
  r2: number;                                  // R² score (-∞ to 1, higher is better)
  adjusted_r2: number;                         // Adjusted R² score
  mse: number;                                 // Mean Squared Error (lower is better)
  rmse: number;                                // Root Mean Squared Error
  mae: number;                                 // Mean Absolute Error
  mape: number | null;                         // Mean Absolute Percentage Error (0-100%, null if y has zeros)
  median_absolute_error: number;
  max_error: number;
  explained_variance: number;
}

export interface RegressionPredictions {
  y_true: number[];                            // Actual values
  y_pred: number[];                            // Predicted values
  residuals: number[];                         // Errors (y_true - y_pred)
}

export interface RegressionConfig {
  dataset_id: string;
  task_type: 'regression';
  target_column: string;
  preprocessing: {
    scaling_method: 'standard' | 'minmax' | 'robust' | 'none';
    missing_strategy: 'mean' | 'median' | 'mode' | 'knn' | 'drop';
    categorical_encoding: 'onehot' | 'ordinal' | 'target' | 'frequency';
    handle_outliers: boolean;
    outlier_method: 'iqr' | 'zscore' | 'isolation_forest';
  };
  feature_engineering: {
    polynomial_features: boolean;
    polynomial_degree: number;
    feature_selection: boolean;
    selection_method: 'mutual_info' | 'f_regression';
    k_features: number;
  };
  model_selection: {
    estimators: RegressionEstimator[];
    cv_folds: number;
    scoring_metric: 'neg_mean_squared_error' | 'neg_mean_absolute_error' | 'r2';
  };
  hyperparameter_tuning: {
    search_method: 'grid' | 'random';
    n_iter?: number;
  };
  mlflow_config: {
    enabled: boolean;
    tracking_uri?: string;
    experiment_name?: string;
  };
}

export interface RegressionTrainingJob {
  job_id: string;
  job_name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  config_id: string;
  started_at: string;
  completed_at: string | null;
  progress: {
    current_model: string;
    models_completed: number;
    total_models: number;
    percent_complete: number;
    elapsed_time: number;
    eta: number;
  };
  best_model: {
    estimator_name: string;
    estimator_id: string;
    metrics: RegressionMetrics;
    hyperparameters: Record<string, any>;
    validation_score: number;
    validation_strategy: 'cross_validation' | 'train_test_split';
    validation_std?: number;
    train_score?: number;
    training_time?: number;
  } | null;
  all_models: Array<{
    estimator_name: string;
    metrics: RegressionMetrics;
    validation_score: number;
    validation_std: number;
    training_time: number;
    validation_strategy: 'cross_validation' | 'train_test_split';
  }>;
  test_metrics: RegressionMetrics | null;
  feature_importance: Record<string, number>;
  predictions: RegressionPredictions | null;
  mlflow_run_id: string | null;
  error_message: string | null;
}
