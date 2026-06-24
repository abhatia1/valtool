// fe/types/testing.ts

export interface TestUploadResponse {
  test_id: string;
  filename: string;
  file_path: string;
  rows: number;
  columns: number;
  column_names: string[];
  status: string;
}

export interface TestRunRequest {
  test_id: string;
  job_id: string;
}

export interface TestRunResponse {
  test_run_id: string;
  status: string;
}

export interface MetricComparison {
  training_value: number;
  test_value: number;
  difference: number;
  percent_change: number;
}

export interface TestResultsResponse {
  test_run_id: string;
  status: string;
  metrics: Record<string, number>;
  predictions: {
    predictions: number[];
    actual: number[];
    sample_count: number;
    comparison_to_training: Record<string, MetricComparison>;
  };
  comparison_to_training: Record<string, MetricComparison>;
  visualizations: Record<string, string>;
  tested_at: string;
}

export interface TestRunListItem {
  test_run_id: string;
  test_dataset_path: string;
  metrics: Record<string, number>;
  tested_at: string;
}

export interface TestRunListResponse {
  job_id: string;
  total: number;
  test_runs: TestRunListItem[];
}

// Multi-model testing types

export interface ModelTestResult {
  estimator_name: string;
  test_metrics: Record<string, number | number[][]>; // accuracy, precision, recall, f1, confusion_matrix
  validation_score: number;
  validation_std: number;
  training_time: number;
  generalization_gap: number; // Difference between validation and test score
}

export interface MultiModelTestRequest {
  job_id: string;
  test_dataset_id: string;
}

export interface MultiModelTestResultsResponse {
  test_run_id: string;
  status: string;
  task_type: "classification" | "regression";
  best_test_model: ModelTestResult;
  best_validation_model: ModelTestResult;
  all_models: ModelTestResult[];
  sample_count: number;
  visualizations: Record<string, string>;
  tested_at: string;
}

// Model finalization types

export interface FinalizeModelRequest {
  job_id: string;
  selected_models: string[]; // Estimator names to keep (e.g., ["random_forest", "xgboost"])
  primary_model?: string; // Optional: which model to use as the main model.pkl (defaults to first in list)
}

export interface FinalizedModelInfo {
  model_path: string;
  estimator_name: string;
  task_type: string;
  test_metrics: Record<string, number | number[][]>;
  validation_score: number;
  file_size_mb: number;
  includes_preprocessor: boolean;
  includes_encoder: boolean;
}

export interface FinalizeModelResponse {
  success: boolean;
  job_id: string;
  primary_model: FinalizedModelInfo; // The main combined pipeline model
  kept_models: string[]; // All models that were kept
  models_deleted: number;
  space_saved_mb: number;
  message: string;
}

// Finalized models for benchmarking types

export interface FinalizedModelForBenchmarking {
  estimator_name: string;
  is_primary: boolean;
  test_metrics: Record<string, number | number[][]>;
  validation_score: number;
  training_time_seconds: number;
}

export interface FinalizedModelsResponse {
  job_id: string;
  is_finalized: boolean;
  task_type: string;
  primary_model: string | null;
  models: FinalizedModelForBenchmarking[];
  includes_preprocessor: boolean;
  includes_encoder: boolean;
  encoder_type: string | null;
  finalized_at: string | null;
  message: string;
}
