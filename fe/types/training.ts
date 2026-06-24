// types/training.ts
// Phase 4: Classification Training - Type Definitions

export type TrainingStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskType = 'classification' | 'regression' | 'timeseries';

// Training Request & Response Types

export interface StartTrainingRequest {
  config_id: string;
  job_name?: string;
  notify_on_complete?: boolean;
}

export interface StartTrainingResponse {
  job_id: string;
  job_name: string;
  status: TrainingStatus;
  started_at: string;
  estimated_completion?: string;
}

// Training Progress Types

export interface TrainingProgress {
  current_model: string;
  models_completed: number;
  total_models: number;
  percent_complete: number;
  elapsed_time: number;
  eta: number;
}

export interface TrainingStatusResponse {
  job_id: string;
  status: TrainingStatus;
  progress: TrainingProgress;
  current_step: string;
  logs: string[];
}

// Model Metrics Types

export interface ModelMetrics {
  accuracy: number;
  precision_weighted: number;
  recall_weighted: number;
  f1_weighted: number;
  cohen_kappa: number;
  matthews_corrcoef: number;
  roc_auc?: number;
  roc_auc_ovr?: number;
  roc_auc_ovo?: number;
  precision_macro?: number;
  precision_micro?: number;
  recall_macro?: number;
  recall_micro?: number;
  f1_macro?: number;
  f1_micro?: number;
}

export interface BestModel {
  estimator_name: string;
  estimator_id: string;
  metrics: ModelMetrics;  // Test metrics for display
  train_metrics?: ModelMetrics;  // Training set metrics
  val_metrics?: ModelMetrics;  // Validation set metrics
  hyperparameters: Record<string, any>;
  validation_score: number;  // Main score used for model selection
  validation_strategy: 'cross_validation' | 'train_test_split';
  validation_std?: number;  // Only for cross-validation
  train_score?: number;
  training_time?: number;
}

export interface ModelComparison {
  estimator_name: string;
  metrics: ModelMetrics | Record<string, number>; // Can include prefixed metrics (val_, train_)
  validation_score: number;
  validation_std: number;
  training_time: number;
  validation_strategy: 'cross_validation' | 'train_test_split';
}

// Training Summary Types

export interface ClassificationReportItem {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface TrainingSummary {
  total_models_trained: number;
  best_validation_score: number;
  training_duration: number;
  test_metrics: ModelMetrics;
  confusion_matrix: number[][];
  classification_report: Record<string, ClassificationReportItem>;
}

// Training Results

export interface TrainingResults {
  job_id: string;
  job_name: string;
  task_type: TaskType;
  status: TrainingStatus;
  best_model: BestModel;
  all_models: ModelComparison[];
  feature_importance: Record<string, number>;
  training_summary: TrainingSummary;
  mlflow_run_id?: string;
  completed_at: string;
}

// Model Comparison Response

export interface ModelComparisonResponse {
  job_id: string;
  models: ModelComparison[];
  best_model: BestModel;
  comparison_metric: string;
}

// Training Job List Types

export interface TrainingJobListItem {
  job_id: string;
  job_name: string;
  status: TrainingStatus;
  started_at: string;
  completed_at?: string;
  config_id: string;
}

export interface TrainingJobsResponse {
  jobs: TrainingJobListItem[];
  total: number;
  limit: number;
  offset: number;
}

// Cancel & Delete Responses

export interface CancelTrainingResponse {
  message: string;
  job_id: string;
  status: 'cancelled';
}

export interface DeleteTrainingResponse {
  message: string;
  deleted_job_id: string;
}
