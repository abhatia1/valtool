// ============================================================
// Experiments Dashboard - TypeScript Type Definitions
// ============================================================

export type ExperimentStatus = "in_progress" | "completed" | "archived";
export type TaskType = "classification" | "regression" | "timeseries";

// ============================================================
// Request Schemas
// ============================================================

export interface ExperimentCreate {
  name: string;
  description?: string;
  dataset_id: string;
  task_type: TaskType;
  target_column: string;
}

export interface ExperimentUpdate {
  name?: string;
  description?: string;
  status?: ExperimentStatus;
  config_id?: string;
  training_job_id?: string;
  best_model_name?: string;
  best_metric_name?: string;
  best_metric_value?: number;
  total_models_trained?: number;
  models_saved_for_benchmarking?: number;
  training_duration_seconds?: number;
}

export interface SaveModelsRequest {
  model_ids: string[];
}

// ============================================================
// Response Schemas
// ============================================================

export interface ExperimentResponse {
  experiment_id: string;
  name: string;
  description?: string;
  dataset_id: string;
  task_type: TaskType;
  target_column: string;
  status: ExperimentStatus;

  // Linked records
  config_id?: string;
  training_job_id?: string;

  // Quick stats for dashboard
  best_model_name?: string;
  best_metric_name?: string;
  best_metric_value?: number;
  total_models_trained: number;
  models_saved_for_benchmarking: number;

  // Training duration
  training_duration_seconds?: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ExperimentListItem {
  experiment_id: string;
  name: string;
  description?: string;
  task_type: TaskType;
  status: ExperimentStatus;

  // Quick stats for card display
  best_model_name?: string;
  best_metric_name?: string;
  best_metric_value?: number;
  total_models_trained: number;
  models_saved_for_benchmarking: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ExperimentListResponse {
  experiments: ExperimentListItem[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================
// Filter Types
// ============================================================

export interface ExperimentFilters {
  status?: ExperimentStatus;
  task_type?: TaskType;
  search?: string;
}
