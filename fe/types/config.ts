// ============================================================
// Phase 3: Configuration Management - TypeScript Type Definitions
// ============================================================

export type TaskType = "classification" | "regression" | "timeseries";
export type ScalingMethod = "standard" | "minmax" | "robust" | "none";
export type MissingStrategy = "median" | "mean" | "mode" | "knn" | "drop";
export type CategoricalEncoding = "onehot" | "ordinal" | "target" | "frequency";
export type OutlierMethod = "iqr" | "zscore" | "isolation_forest";
export type SearchMethod = "grid" | "random" | "bayesian";
export type SelectionMethod = "selectkbest" | "mutual_info" | "tree_based";

// ============================================================
// Configuration Sections
// ============================================================

export interface PreprocessingConfig {
  scaling_method: ScalingMethod;
  missing_strategy: MissingStrategy;
  categorical_encoding: CategoricalEncoding;
  handle_outliers: boolean;
  outlier_method?: OutlierMethod;
}

export interface FeatureEngineeringConfig {
  polynomial_features: boolean;
  polynomial_degree?: number;  // 2-5
  feature_selection: boolean;
  selection_method?: SelectionMethod;
  n_features?: number;
}

export interface ModelSelectionConfig {
  estimators: string[];
  validation_strategy: "cross_validation" | "train_test_split";
  cv_folds: number;  // 2-10
  test_size: number;  // 0.1-0.5 (only for train_test_split, this is validation size)
  scoring_metric: string;
}

export interface HyperparameterTuningConfig {
  search_method: SearchMethod;
  n_iter?: number;
  custom_search_spaces?: Record<string, any>;
}

export interface MLflowConfig {
  enabled: boolean;
  experiment_name?: string;
  tracking_uri?: string;
  auto_log: boolean;
}

// ============================================================
// Configuration Template
// ============================================================

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  config: {
    preprocessing: PreprocessingConfig;
    feature_engineering: FeatureEngineeringConfig;
    model_selection: ModelSelectionConfig;
    hyperparameter_tuning: HyperparameterTuningConfig;
    mlflow: MLflowConfig;
  };
}

export interface ConfigTemplatesResponse {
  templates: ConfigTemplate[];
}

// ============================================================
// Estimator Information
// ============================================================

export interface EstimatorParam {
  type: "int" | "float" | "categorical";
  range?: [number, number];
  values?: any[];
  log_scale?: boolean;
}

export interface EstimatorInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  default_params: Record<string, any>;
  tunable_params: Record<string, EstimatorParam>;
}

export interface EstimatorsResponse {
  task_type: string;
  estimators: EstimatorInfo[];
}

// ============================================================
// Configuration Creation
// ============================================================

export interface TrainingConfigCreate {
  dataset_id: string;
  target_column: string;
  task_type: TaskType;
  preprocessing: PreprocessingConfig;
  feature_engineering: FeatureEngineeringConfig;
  model_selection: ModelSelectionConfig;
  hyperparameter_tuning: HyperparameterTuningConfig;
  mlflow: MLflowConfig;
}

export interface TrainingConfigResponse {
  config_id: string;
  dataset_id: string;
  task_type: string;
  validated: boolean;
  warnings: string[];
  estimated_training_time: number;
  created_at: string;
}

// ============================================================
// Validation
// ============================================================

export interface ValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidatePreprocessingRequest {
  dataset_id: string;
  preprocessing: PreprocessingConfig;
}

// ============================================================
// UI State
// ============================================================

export type WizardStep =
  | "experiment"
  | "template"
  | "task"
  | "preprocessing"
  | "features"
  | "models"
  | "tuning"
  | "summary";

export interface ConfigurationState {
  currentStep: WizardStep;
  selectedTemplate: ConfigTemplate | null;
  taskType: TaskType | null;
  targetColumn: string | null;
  preprocessing: PreprocessingConfig;
  featureEngineering: FeatureEngineeringConfig;
  modelSelection: ModelSelectionConfig;
  hyperparameterTuning: HyperparameterTuningConfig;
  mlflow: MLflowConfig;
  validation: ValidationResponse | null;
}

// ============================================================
// Default Values
// ============================================================

export const DEFAULT_PREPROCESSING: PreprocessingConfig = {
  scaling_method: "standard",
  missing_strategy: "median",
  categorical_encoding: "onehot",
  handle_outliers: false,
};

export const DEFAULT_FEATURE_ENGINEERING: FeatureEngineeringConfig = {
  polynomial_features: false,
  feature_selection: false,
};

export const DEFAULT_MODEL_SELECTION: ModelSelectionConfig = {
  estimators: [],
  validation_strategy: "cross_validation",
  cv_folds: 5,
  test_size: 0.2,
  scoring_metric: "accuracy",
};

export const DEFAULT_HYPERPARAMETER_TUNING: HyperparameterTuningConfig = {
  search_method: "random",
  n_iter: 10,
};

export const DEFAULT_MLFLOW: MLflowConfig = {
  enabled: true,
  auto_log: true,
};
