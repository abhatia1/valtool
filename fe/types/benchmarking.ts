/**
 * Benchmarking Stage Type Definitions
 *
 * Types for comparing platform-trained models against external models
 * uploaded as Docker containers.
 */

// Model Source Types
export type ModelSource = "docker" | "native";

// External Model Types
export interface ExternalModel {
  model_id: string;
  name: string;
  description?: string;
  task_type: "classification" | "regression";
  model_source: ModelSource;
  status: "pending" | "building" | "ready" | "failed";
  build_error?: string;
  feature_names?: string[];
  class_names?: string[];
  created_at: string;
  validated_at?: string;
}

export interface ExternalModelUploadRequest {
  name: string;
  description?: string;
  task_type: string;
}

// Native Model Types
export interface NativeModelUploadMetadata {
  name: string;
  description?: string;
  task_type: "classification" | "regression";
  feature_names?: string[];
  class_names?: string[];
}

export interface NativeModelValidationResponse {
  model_id: string;
  is_valid: boolean;
  model_type?: string;
  has_predict: boolean;
  has_predict_proba: boolean;
  has_preprocessor: boolean;
  has_label_encoder: boolean;
  has_target_scaler: boolean;
  feature_count?: number;
  validation_errors: string[];
  validation_warnings: string[];
}

// Container Build Types
export interface ContainerBuildStatus {
  model_id: string;
  status: "pending" | "building" | "ready" | "failed";
  progress: number;
  current_step: string;
  logs: string[];
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface SecurityScanResult {
  passed: boolean;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  vulnerabilities: SecurityVulnerability[];
}

export interface SecurityVulnerability {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  package: string;
  description: string;
}

// Benchmark Configuration and Execution Types
export interface BenchmarkConfig {
  job_id: string;
  external_model_ids: string[];
  platform_model_ids?: string[];
  test_dataset_id?: string;
}

export interface BenchmarkRun {
  benchmark_id: string;
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  current_model?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

// Benchmark Results Types
export interface BenchmarkModelResult {
  model_id: string;
  model_name: string;
  model_type: "platform" | "external";
  estimator_name?: string;
  metrics: Record<string, number>;
  inference_time_ms: number;
}

export interface MetricComparisonDetail {
  metric_name: string;
  platform_values: Record<string, number>;
  external_values: Record<string, number>;
  best_value: number;
  best_model_id: string;
}

export interface BenchmarkComparison {
  benchmark_id: string;
  task_type: "classification" | "regression";
  test_sample_count: number;
  platform_models: BenchmarkModelResult[];
  external_models: BenchmarkModelResult[];
  best_overall: BenchmarkModelResult;
  best_platform: BenchmarkModelResult;
  best_external: BenchmarkModelResult;
  metric_comparisons?: MetricComparisonDetail[];
  visualizations: Record<string, string>;
  completed_at: string;
}

// Platform Model Types (from training job)
export interface PlatformModel {
  model_id: string;
  estimator_name: string;
  metrics: Record<string, number>;
  training_time_seconds: number;
  is_best: boolean;
}

// API Response Types
export interface ExternalModelListResponse {
  models: ExternalModel[];
  total: number;
}

export interface BenchmarkListResponse {
  benchmarks: BenchmarkRun[];
  total: number;
}
