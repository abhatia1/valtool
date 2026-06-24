"""
Pydantic Schemas

Request and response models for API endpoints.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, List, Any
from datetime import datetime


# ============================================================
# Dataset Schemas
# ============================================================

class DatasetUploadResponse(BaseModel):
    """Response schema for dataset upload"""

    dataset_id: str
    name: str
    file_path: str
    rows: int
    columns: int
    column_names: List[str]
    column_types: Dict[str, str]  # column name -> type (numeric, categorical, datetime, text)
    missing_values: Dict[str, int]  # column name -> missing count
    uploaded_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class DatasetListItem(BaseModel):
    """Schema for dataset list item"""

    dataset_id: str
    name: str
    rows: int
    columns: int
    uploaded_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class DatasetListResponse(BaseModel):
    """Response schema for listing datasets"""

    datasets: List[DatasetListItem]


class DatasetDeleteResponse(BaseModel):
    """Response schema for dataset deletion"""

    message: str
    deleted_dataset_id: str


# ============================================================
# EDA Schemas
# ============================================================

class EDAGenerateRequest(BaseModel):
    """Request schema for EDA generation"""

    dataset_id: str
    analysis_types: List[str] = Field(
        default=["univariate", "bivariate", "correlation", "outliers"],
        description="Types of analysis to perform"
    )
    target_column: Optional[str] = None


class EDAGenerateResponse(BaseModel):
    """Response schema for EDA generation"""

    eda_id: str
    dataset_id: str
    status: str
    summary_statistics: Dict[str, Dict[str, Any]]
    visualizations: Dict[str, Any]
    insights: List[str]
    generated_at: datetime
    target_column: Optional[str] = None
    target_insights: Optional[Dict[str, Any]] = None
    missing_data_patterns: Optional[Dict[str, Any]] = None
    data_quality_flags: Optional[Dict[str, Any]] = None
    feature_engineering_suggestions: Optional[Dict[str, Any]] = None
    class_imbalance_analysis: Optional[Dict[str, Any]] = None
    target_leakage_detection: Optional[Dict[str, Any]] = None
    multivariate_outliers: Optional[Dict[str, Any]] = None
    feature_importance: Optional[Dict[str, Any]] = None
    detailed_univariate_analysis: Optional[Dict[str, Any]] = None
    multivariate_analysis: Optional[Dict[str, Any]] = None
    dimensionality_reduction: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class EDAVisualizationResponse(BaseModel):
    """Response schema for individual EDA visualization"""

    plotly_json: Dict[str, Any]
    viz_type: str
    title: str


# ============================================================
# Configuration Schemas
# ============================================================

class PreprocessingConfig(BaseModel):
    """Preprocessing configuration"""

    scaling_method: str = Field(default="standard", pattern="^(standard|minmax|robust|none)$")
    missing_strategy: str = Field(default="median", pattern="^(median|mean|mode|knn|drop)$")
    categorical_encoding: str = Field(default="onehot", pattern="^(onehot|ordinal|target|frequency)$")
    handle_outliers: bool = False
    outlier_method: Optional[str] = Field(default="iqr")


class FeatureEngineeringConfig(BaseModel):
    """Feature engineering configuration"""

    polynomial_features: bool = False
    polynomial_degree: Optional[int] = Field(default=2, ge=2, le=5)
    feature_selection: bool = False
    selection_method: Optional[str] = Field(default="selectkbest")
    n_features: Optional[int] = Field(default=20, ge=1)


class ModelSelectionConfig(BaseModel):
    """Model selection configuration"""

    estimators: List[str]
    validation_strategy: str = Field(
        default="cross_validation",
        pattern="^(cross_validation|train_test_split)$",
        description="Validation strategy: 'cross_validation' or 'train_test_split'"
    )
    cv_folds: int = Field(default=5, ge=2, le=10)
    test_size: float = Field(
        default=0.2,
        ge=0.1,
        le=0.5,
        description="Validation set size (only used with train_test_split strategy)"
    )
    scoring_metric: str


class HyperparameterTuningConfig(BaseModel):
    """Hyperparameter tuning configuration"""

    search_method: str = Field(default="grid", pattern="^(grid|random|bayesian)$")
    n_iter: Optional[int] = Field(default=10, ge=1)
    custom_search_spaces: Optional[Dict[str, Any]] = None


class MLflowConfig(BaseModel):
    """MLflow configuration"""

    enabled: bool = True
    experiment_name: Optional[str] = None
    tracking_uri: Optional[str] = None
    auto_log: bool = True


class TrainingConfigCreate(BaseModel):
    """Request schema for creating training configuration"""

    dataset_id: str
    target_column: str
    task_type: str = Field(pattern="^(classification|regression|timeseries)$")
    preprocessing: PreprocessingConfig
    feature_engineering: FeatureEngineeringConfig
    model_selection: ModelSelectionConfig
    hyperparameter_tuning: HyperparameterTuningConfig
    mlflow: MLflowConfig

    model_config = ConfigDict(protected_namespaces=())


class TrainingConfigResponse(BaseModel):
    """Response schema for training configuration"""

    config_id: str
    dataset_id: str
    task_type: str
    validated: bool
    warnings: List[str]
    estimated_training_time: int  # seconds
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EstimatorInfo(BaseModel):
    """Estimator information schema"""

    id: str
    name: str
    category: str
    description: str
    default_params: Dict[str, Any]
    tunable_params: Dict[str, Any]


class EstimatorsResponse(BaseModel):
    """Response schema for available estimators"""

    task_type: str
    estimators: List[EstimatorInfo]


class ConfigTemplate(BaseModel):
    """Configuration template schema"""

    id: str
    name: str
    description: str
    config: Dict[str, Any]


class ConfigTemplatesResponse(BaseModel):
    """Response schema for configuration templates"""

    templates: List[ConfigTemplate]


class ValidatePreprocessingRequest(BaseModel):
    """Request schema for validating preprocessing configuration"""

    dataset_id: str
    preprocessing: PreprocessingConfig


class ValidationResponse(BaseModel):
    """Response schema for configuration validation"""

    valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]


# ============================================================
# Training Schemas
# ============================================================

class TrainingStartRequest(BaseModel):
    """Request schema for starting training job"""

    config_id: str
    job_name: Optional[str] = None
    notify_on_complete: bool = False


class TrainingProgress(BaseModel):
    """Training progress information"""

    current_model: str
    models_completed: int
    total_models: int
    percent_complete: float
    elapsed_time: int  # seconds
    eta: int  # seconds


class TrainingStartResponse(BaseModel):
    """Response schema for training start"""

    job_id: str
    job_name: str
    status: str
    started_at: datetime
    estimated_completion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TrainingStatusResponse(BaseModel):
    """Response schema for training status"""

    job_id: str
    status: str
    progress: TrainingProgress
    current_step: str
    logs: List[str]

    model_config = ConfigDict(from_attributes=True)


class BestModelInfo(BaseModel):
    """Best model information"""

    estimator_name: str
    estimator_id: str
    metrics: Dict[str, float]  # Test metrics (for display)
    train_metrics: Optional[Dict[str, float]] = None  # Training set metrics
    val_metrics: Optional[Dict[str, float]] = None  # Validation set metrics
    hyperparameters: Dict[str, Any]
    validation_score: float  # Main score used for model selection
    validation_strategy: str  # 'cross_validation' or 'train_test_split'
    validation_std: Optional[float] = None  # Only for cross-validation
    train_score: Optional[float] = None
    training_time: Optional[float] = None


class ModelComparisonItem(BaseModel):
    """Model comparison item"""

    estimator_name: str
    metrics: Dict[str, float]
    validation_score: float
    validation_std: float
    training_time: float
    validation_strategy: str


class TrainingResultsResponse(BaseModel):
    """Response schema for training results"""

    job_id: str
    job_name: str
    task_type: str
    status: str
    best_model: BestModelInfo
    all_models: List[ModelComparisonItem]
    feature_importance: Dict[str, float]
    training_summary: Dict[str, Any]
    mlflow_run_id: Optional[str] = None
    completed_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# Visualization Schemas
# ============================================================

class VisualizationResponse(BaseModel):
    """Generic visualization response"""

    plotly_json: Dict[str, Any]
    viz_type: str
    title: str
    model_name: Optional[str] = None

    model_config = ConfigDict(protected_namespaces=())


class ROCCurvesResponse(BaseModel):
    """ROC curves response"""

    plotly_json: Dict[str, Any]
    viz_type: str = "roc_curves"
    auc_scores: Dict[str, float]


class FeatureImportanceResponse(BaseModel):
    """Feature importance response"""

    plotly_json: Dict[str, Any]
    viz_type: str = "feature_importance"
    top_n: int
    feature_scores: Dict[str, float]


# ============================================================
# Testing Schemas
# ============================================================

class TestRunRequest(BaseModel):
    """Request schema for running model test"""

    test_id: str
    job_id: str


class TestRunResponse(BaseModel):
    """Response schema for test run start"""

    test_run_id: str
    status: str


class MetricComparison(BaseModel):
    """Metric comparison between training and test"""

    training_value: float
    test_value: float
    difference: float
    percent_change: float


class TestResultsResponse(BaseModel):
    """Response schema for test results"""

    test_run_id: str
    status: str
    metrics: Dict[str, Any]  # Changed from Dict[str, float] to support confusion_matrix and probabilities
    predictions: Dict[str, Any]
    comparison_to_training: Dict[str, MetricComparison]
    visualizations: Dict[str, str]
    tested_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModelTestResult(BaseModel):
    """Test result for a single model on out-of-sample data."""

    estimator_name: str
    test_metrics: Dict[str, Any]  # accuracy, precision, recall, f1, confusion_matrix for classification
    validation_score: float  # Original validation score from training
    validation_std: float = 0.0  # Validation score std deviation
    training_time: float = 0.0  # Original training time in seconds
    generalization_gap: float = 0.0  # Difference between validation and test score


class MultiModelTestRequest(BaseModel):
    """Request schema for multi-model testing."""

    job_id: str
    test_dataset_id: str


class MultiModelTestResultsResponse(BaseModel):
    """Response schema for multi-model test results."""

    test_run_id: str
    status: str
    task_type: str  # classification or regression
    best_test_model: ModelTestResult
    best_validation_model: ModelTestResult  # For comparison
    all_models: List[ModelTestResult]
    sample_count: int
    visualizations: Dict[str, str] = {}
    tested_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FinalizeModelRequest(BaseModel):
    """Request to finalize models for benchmarking."""

    job_id: str
    selected_models: List[str]  # Estimator names to keep (e.g., ["random_forest", "xgboost"])
    primary_model: Optional[str] = None  # Which model to use as main model.pkl (defaults to first)  # Estimator name to keep (e.g., "random_forest")


class FinalizedModelInfo(BaseModel):
    """Information about the finalized model package."""

    model_path: str
    estimator_name: str
    task_type: str
    test_metrics: Dict[str, Any]
    validation_score: float
    file_size_mb: float
    includes_preprocessor: bool
    includes_encoder: bool  # label_encoder or target_scaler


class FinalizeModelResponse(BaseModel):
    """Response after model finalization."""

    success: bool
    job_id: str
    primary_model: FinalizedModelInfo  # The main combined pipeline model
    kept_models: List[str]  # All models that were kept
    models_deleted: int  # Number of models removed from all_models/
    space_saved_mb: float
    message: str


class FinalizedModelForBenchmarking(BaseModel):
    """Model info for benchmarking selection."""

    estimator_name: str
    is_primary: bool = False
    test_metrics: Dict[str, Any] = {}
    validation_score: float = 0.0
    training_time_seconds: float = 0.0


class FinalizedModelsResponse(BaseModel):
    """Response with finalized models available for benchmarking."""

    job_id: str
    is_finalized: bool
    task_type: str
    primary_model: Optional[str] = None
    models: List[FinalizedModelForBenchmarking]
    includes_preprocessor: bool = False
    includes_encoder: bool = False
    encoder_type: Optional[str] = None  # "label_encoder" or "target_scaler"
    finalized_at: Optional[datetime] = None
    message: str


# ============================================================
# Monitoring Schemas
# ============================================================

class DriftDetectionRequest(BaseModel):
    """Request schema for drift detection"""

    job_id: str
    current_data_id: str
    drift_threshold: float = Field(default=0.05, ge=0.0, le=1.0)


class FeatureDrift(BaseModel):
    """Feature drift information"""

    drift_detected: bool
    drift_score: float
    statistical_test: str
    p_value: Optional[float] = None
    threshold: float


class DriftReportResponse(BaseModel):
    """Response schema for drift detection"""

    drift_report_id: str
    overall_drift_detected: bool
    feature_drift: Dict[str, FeatureDrift]
    features_with_drift: List[str]
    drift_severity: str
    visualizations: Dict[str, str]
    recommendations: List[str]
    detected_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PerformanceTrend(BaseModel):
    """Performance trend information"""

    trend: str  # improving, stable, degrading
    percent_change: float
    is_significant: bool


class PerformanceHistoryItem(BaseModel):
    """Performance history item"""

    timestamp: datetime
    batch_id: str
    metrics: Dict[str, float]
    sample_count: int


class AlertInfo(BaseModel):
    """Alert information"""

    alert_id: str
    severity: str
    metric: str
    message: str
    triggered_at: datetime


class PerformanceResponse(BaseModel):
    """Response schema for performance tracking"""

    job_id: str
    baseline_metrics: Dict[str, float]
    performance_history: List[PerformanceHistoryItem]
    performance_trend: Dict[str, PerformanceTrend]
    alerts: List[AlertInfo]
    visualizations: Dict[str, str]

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# Benchmarking Schemas
# ============================================================

class ExternalModelUploadRequest(BaseModel):
    """Request schema for external model upload metadata"""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: str = Field(..., pattern="^(classification|regression)$")


class NativeModelUploadRequest(BaseModel):
    """Request schema for native model upload metadata"""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    task_type: str = Field(..., pattern="^(classification|regression)$")
    feature_names: Optional[List[str]] = None  # Expected input feature names
    class_names: Optional[List[str]] = None  # Class names for classification


class NativeModelValidationResponse(BaseModel):
    """Response schema for native model validation"""

    model_id: str
    is_valid: bool
    model_type: Optional[str] = None  # e.g., "RandomForestClassifier"
    has_predict: bool = False
    has_predict_proba: bool = False
    has_preprocessor: bool = False
    has_label_encoder: bool = False
    has_target_scaler: bool = False
    feature_count: Optional[int] = None
    validation_errors: List[str] = []
    validation_warnings: List[str] = []


class ExternalModelResponse(BaseModel):
    """Response schema for external model"""

    model_id: str
    name: str
    description: Optional[str] = None
    task_type: str
    model_source: str = "docker"  # docker, native
    status: str  # pending, building, ready, failed
    build_error: Optional[str] = None
    build_progress: int = 0
    current_build_step: Optional[str] = None
    image_name: Optional[str] = None
    security_scan_status: Optional[str] = None
    vulnerability_count: Optional[Dict[str, int]] = None
    feature_names: Optional[List[str]] = None
    class_names: Optional[List[str]] = None
    created_at: datetime
    validated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


class ExternalModelListResponse(BaseModel):
    """Response schema for listing external models"""

    models: List[ExternalModelResponse]


class ContainerBuildStatus(BaseModel):
    """Response schema for container build status"""

    model_id: str
    status: str  # pending, building, ready, failed
    progress: int = Field(ge=0, le=100)
    current_step: Optional[str] = None
    logs: List[str] = []
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(protected_namespaces=())


class SecurityScanResult(BaseModel):
    """Response schema for security scan results"""

    model_id: str
    status: str  # pending, passed, failed
    vulnerabilities: Dict[str, int] = Field(
        default_factory=lambda: {"critical": 0, "high": 0, "medium": 0, "low": 0}
    )
    passed: bool = True
    details: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(protected_namespaces=())


class EndpointValidationResponse(BaseModel):
    """Response schema for endpoint validation"""

    model_id: str
    valid: bool
    endpoint: str
    response_time_ms: Optional[float] = None
    sample_input: Optional[Dict[str, Any]] = None
    sample_output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(protected_namespaces=())


class ContainerStatusResponse(BaseModel):
    """Response schema for container status"""

    instance_id: str
    model_id: str
    status: str  # stopped, starting, running, stopping, error
    container_id: Optional[str] = None
    host_port: Optional[int] = None
    request_count: int = 0
    last_request_at: Optional[datetime] = None
    uptime_seconds: Optional[float] = None

    model_config = ConfigDict(protected_namespaces=())


class ContainerPredictionRequest(BaseModel):
    """Request schema for container prediction"""

    data: List[Dict[str, Any]]


class ContainerPredictionResponse(BaseModel):
    """Response schema for container prediction"""

    predictions: List[Any]
    inference_time_ms: float
    model_id: str

    model_config = ConfigDict(protected_namespaces=())


class BenchmarkStartRequest(BaseModel):
    """Request schema for starting a benchmark"""

    job_id: str
    external_model_ids: List[str] = Field(..., min_length=1)
    platform_model_ids: Optional[List[str]] = None  # If None, use all trained models
    test_dataset_id: Optional[str] = None  # If None, use training test split
    name: Optional[str] = None


class BenchmarkStatusResponse(BaseModel):
    """Response schema for benchmark status"""

    benchmark_id: str
    job_id: str
    status: str  # pending, running, completed, failed
    progress: int = Field(ge=0, le=100)
    current_model: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class BenchmarkModelResult(BaseModel):
    """Result for a single model in benchmark"""

    model_id: str
    model_name: str
    model_type: str  # platform, external
    estimator_name: Optional[str] = None  # For platform models
    metrics: Dict[str, float]
    inference_time_ms: float
    predictions: Optional[List[Any]] = None

    model_config = ConfigDict(protected_namespaces=())


class MetricComparisonDetail(BaseModel):
    """Detailed metric comparison between models"""

    metric_name: str
    platform_value: float
    external_value: float
    difference: float
    percent_difference: float
    winner: str  # platform, external, tie


class BenchmarkComparisonSummary(BaseModel):
    """Summary of benchmark comparison"""

    total_metrics: int
    platform_wins: int
    external_wins: int
    ties: int
    overall_winner: str  # platform, external, tie
    primary_metric: str
    primary_metric_difference: float


class BenchmarkResultsResponse(BaseModel):
    """Response schema for benchmark results"""

    benchmark_id: str
    name: Optional[str] = None
    job_id: str
    task_type: str
    test_sample_count: int
    status: str

    # Model results
    platform_models: List[BenchmarkModelResult]
    external_models: List[BenchmarkModelResult]

    # Best models
    best_overall: BenchmarkModelResult
    best_platform: BenchmarkModelResult
    best_external: BenchmarkModelResult

    # Comparison
    comparison_summary: BenchmarkComparisonSummary
    metric_comparisons: List[MetricComparisonDetail]

    # Visualizations (Plotly JSON strings)
    visualizations: Dict[str, Any] = {}

    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BenchmarkListItem(BaseModel):
    """Schema for benchmark list item"""

    benchmark_id: str
    name: Optional[str] = None
    job_id: str
    status: str
    winner: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BenchmarkListResponse(BaseModel):
    """Response schema for listing benchmarks"""

    benchmarks: List[BenchmarkListItem]


# ============================================================
# Experiment Schemas
# ============================================================


class ExperimentCreate(BaseModel):
    """Request schema for creating a new experiment"""

    name: str = Field(..., description="User-friendly experiment name")
    description: Optional[str] = Field(None, description="Optional description")
    dataset_id: str = Field(..., description="ID of the dataset used")
    task_type: str = Field(..., description="Task type: classification, regression, timeseries")
    target_column: str = Field(..., description="Target column name")


class ExperimentUpdate(BaseModel):
    """Request schema for updating an experiment"""

    name: Optional[str] = Field(None, description="Update experiment name")
    description: Optional[str] = Field(None, description="Update description")
    status: Optional[str] = Field(None, description="Update status: in_progress, completed, archived")
    config_id: Optional[str] = Field(None, description="Link to training config")
    training_job_id: Optional[str] = Field(None, description="Link to training job")
    best_model_name: Optional[str] = Field(None, description="Name of best model")
    best_metric_name: Optional[str] = Field(None, description="Name of best metric")
    best_metric_value: Optional[float] = Field(None, description="Value of best metric")
    total_models_trained: Optional[int] = Field(None, description="Total models trained")
    models_saved_for_benchmarking: Optional[int] = Field(None, description="Models saved for benchmarking")
    training_duration_seconds: Optional[float] = Field(None, description="Training duration")


class ExperimentResponse(BaseModel):
    """Response schema for a single experiment"""

    experiment_id: str
    name: str
    description: Optional[str]
    dataset_id: str
    task_type: str
    target_column: str
    status: str

    # Linked records
    config_id: Optional[str]
    training_job_id: Optional[str]

    # Quick stats for dashboard
    best_model_name: Optional[str]
    best_metric_name: Optional[str]
    best_metric_value: Optional[float]
    total_models_trained: int
    models_saved_for_benchmarking: int

    # Training duration
    training_duration_seconds: Optional[float]

    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ExperimentListItem(BaseModel):
    """Schema for experiment list item (dashboard card)"""

    experiment_id: str
    name: str
    description: Optional[str]
    task_type: str
    status: str

    # Quick stats for card display
    best_model_name: Optional[str]
    best_metric_name: Optional[str]
    best_metric_value: Optional[float]
    total_models_trained: int
    models_saved_for_benchmarking: int

    # Timestamps
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExperimentListResponse(BaseModel):
    """Response schema for listing experiments"""

    experiments: List[ExperimentListItem]
    total: int


class SaveModelsRequest(BaseModel):
    """Request schema for saving models for benchmarking"""

    model_names: List[str] = Field(..., description="List of model names to save for benchmarking")
