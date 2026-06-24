// fe/types/timeseries.ts

export interface StationarityTest {
  adf_test: {
    statistic: number;
    p_value: number;
    used_lag: number;
    n_obs: number;
    critical_values: {
      '1%': number;
      '5%': number;
      '10%': number;
    };
    is_stationary: boolean;
  };
  kpss_test: {
    statistic: number;
    p_value: number;
    used_lag: number;
    critical_values: {
      '1%': number;
      '5%': number;
      '10%': number;
    };
    is_stationary: boolean;
  };
  interpretation: 'stationary' | 'non_stationary' | 'unclear';
  recommendation: string;
}

export interface StationarityTestResponse {
  dataset_id: string;
  target_column: string;
  frequency: string;
  stationarity_tests: StationarityTest;
  summary: {
    is_stationary: boolean;
    recommendation: string;
  };
}

export interface Decomposition {
  observed: number[];
  trend: number[];
  seasonal: number[];
  residual: number[];
  dates: string[];
}

export interface DecompositionResponse {
  dataset_id: string;
  target_column: string;
  model: 'additive' | 'multiplicative';
  period: number;
  decomposition: Decomposition;
  error?: string;
}

export interface TimeSeriesMetrics {
  mae: number;
  mse: number;
  rmse: number;
  mape: number;
  smape: number;
  wape: number;
  directional_accuracy: number;
  forecast_bias: number;
}

export interface TimeSeriesModelResult {
  model_name: string;
  estimator_id: string;
  category: 'statistical' | 'ml';
  metrics: TimeSeriesMetrics;
  params: Record<string, any>;
}

export interface TimeSeriesPredictions {
  y_true: number[];
  y_pred: number[];
  dates: string[];
}

export interface TimeSeriesTrainingResults {
  job_id: string;
  status: 'completed' | 'failed';
  best_model: {
    name: string;
    estimator_id: string;
    category: 'statistical' | 'ml';
    metrics: TimeSeriesMetrics;
  };
  all_models: TimeSeriesModelResult[];
  test_metrics: TimeSeriesMetrics;
  predictions: TimeSeriesPredictions;
  feature_importance?: Record<string, number>;
}

export interface TimeSeriesConfig {
  dataset_id: string;
  task_type: 'timeseries';
  target_column: string;
  date_column?: string;
  preprocessing: {
    lag_periods?: number[];
    rolling_windows?: number[];
  };
  feature_engineering: {
    create_time_features?: boolean;
  };
  model_selection: {
    estimators: string[];
    cv_folds?: number;
    scoring_metric?: string;
  };
  hyperparameter_tuning?: {
    search_method?: 'grid' | 'random';
    n_iter?: number;
    cv_folds?: number;
  };
}
