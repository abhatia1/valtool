"""
Database Models

SQLAlchemy ORM models for database tables.
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from core.database import Base


def generate_uuid():
    """Generate a UUID string for primary keys"""
    return str(uuid.uuid4())


class Dataset(Base):
    """Dataset model - stores uploaded dataset metadata"""

    __tablename__ = "datasets"

    dataset_id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(512), nullable=False)
    rows = Column(Integer, nullable=True)
    columns = Column(Integer, nullable=True)
    column_names = Column(JSON, nullable=True)  # List of column names
    column_types = Column(JSON, nullable=True)  # Dict of column name -> type
    missing_values = Column(JSON, nullable=True)  # Dict of column name -> missing count
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="uploaded")

    # Relationships
    eda_reports = relationship("EDAReport", back_populates="dataset", cascade="all, delete-orphan")
    training_configs = relationship("TrainingConfig", back_populates="dataset", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="dataset", cascade="all, delete-orphan")


class EDAReport(Base):
    """EDA Report model - stores exploratory data analysis results"""

    __tablename__ = "eda_reports"

    eda_id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.dataset_id"), nullable=False)
    summary_statistics = Column(JSON, nullable=True)  # Statistical summaries
    visualizations = Column(JSON, nullable=True)  # Plotly JSON visualizations
    insights = Column(JSON, nullable=True)  # Auto-generated insights
    generated_at = Column(DateTime, default=datetime.utcnow)

    # Target-specific analyses
    target_column = Column(String(255), nullable=True)
    target_insights = Column(JSON, nullable=True)
    missing_data_patterns = Column(JSON, nullable=True)
    data_quality_flags = Column(JSON, nullable=True)
    feature_engineering_suggestions = Column(JSON, nullable=True)
    class_imbalance_analysis = Column(JSON, nullable=True)
    target_leakage_detection = Column(JSON, nullable=True)
    multivariate_outliers = Column(JSON, nullable=True)

    # Advanced analyses
    feature_importance = Column(JSON, nullable=True)
    detailed_univariate_analysis = Column(JSON, nullable=True)
    multivariate_analysis = Column(JSON, nullable=True)
    dimensionality_reduction = Column(JSON, nullable=True)

    # Relationships
    dataset = relationship("Dataset", back_populates="eda_reports")


class TrainingConfig(Base):
    """Training Configuration model - stores ML training configuration"""

    __tablename__ = "training_configs"

    config_id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.dataset_id"), nullable=False)
    target_column = Column(String(255), nullable=False)
    task_type = Column(String(50), nullable=False)  # classification, regression, timeseries
    preprocessing = Column(JSON, nullable=True)
    feature_engineering = Column(JSON, nullable=True)
    model_selection = Column(JSON, nullable=True)
    hyperparameter_tuning = Column(JSON, nullable=True)
    mlflow_config = Column(JSON, nullable=True)
    validated = Column(Boolean, default=False)
    warnings = Column(JSON, nullable=True)
    estimated_training_time = Column(Integer, nullable=True)  # seconds
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    dataset = relationship("Dataset", back_populates="training_configs")
    training_jobs = relationship("TrainingJob", back_populates="config", cascade="all, delete-orphan")
    experiment = relationship("Experiment", back_populates="training_config", uselist=False)


class TrainingJob(Base):
    """Training Job model - stores ML training job information"""

    __tablename__ = "training_jobs"

    job_id = Column(String(36), primary_key=True, default=generate_uuid)
    config_id = Column(String(36), ForeignKey("training_configs.config_id"), nullable=False)
    job_name = Column(String(255), nullable=True)
    status = Column(String(50), default="queued")  # queued, running, completed, failed
    progress = Column(JSON, nullable=True)  # Progress tracking data
    results = Column(JSON, nullable=True)  # Training results and metrics
    best_model_path = Column(String(512), nullable=True)
    mlflow_run_id = Column(String(255), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    config = relationship("TrainingConfig", back_populates="training_jobs")
    test_runs = relationship("TestRun", back_populates="job", cascade="all, delete-orphan")
    monitoring_batches = relationship("MonitoringBatch", back_populates="job", cascade="all, delete-orphan")
    benchmark_runs = relationship("BenchmarkRun", back_populates="job", cascade="all, delete-orphan")
    experiment = relationship("Experiment", back_populates="training_job", uselist=False)


class TestRun(Base):
    """Test Run model - stores model testing results"""

    __tablename__ = "test_runs"

    test_run_id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("training_jobs.job_id"), nullable=False)
    experiment_id = Column(String(36), ForeignKey("experiments.experiment_id"), nullable=True)
    test_dataset_path = Column(String(512), nullable=False)
    metrics = Column(JSON, nullable=True)
    predictions = Column(JSON, nullable=True)
    tested_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    job = relationship("TrainingJob", back_populates="test_runs")
    experiment = relationship("Experiment", back_populates="test_runs")


class MonitoringBatch(Base):
    """Monitoring Batch model - stores monitoring data batches"""

    __tablename__ = "monitoring_batches"

    batch_id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("training_jobs.job_id"), nullable=False)
    data_type = Column(String(50), nullable=False)  # predictions, actuals
    file_path = Column(String(512), nullable=False)
    rows = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    job = relationship("TrainingJob", back_populates="monitoring_batches")
    drift_reports = relationship("DriftReport", back_populates="batch", cascade="all, delete-orphan")
    performance_logs = relationship("PerformanceLog", back_populates="batch", cascade="all, delete-orphan")


class DriftReport(Base):
    """Drift Report model - stores data drift detection results"""

    __tablename__ = "drift_reports"

    drift_report_id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("training_jobs.job_id"), nullable=False)
    batch_id = Column(String(36), ForeignKey("monitoring_batches.batch_id"), nullable=False)
    overall_drift_detected = Column(Boolean, default=False)
    feature_drift = Column(JSON, nullable=True)  # Per-feature drift analysis
    drift_severity = Column(String(50), nullable=True)  # low, medium, high
    detected_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    batch = relationship("MonitoringBatch", back_populates="drift_reports")


class PerformanceLog(Base):
    """Performance Log model - stores model performance tracking over time"""

    __tablename__ = "performance_logs"

    log_id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("training_jobs.job_id"), nullable=False)
    batch_id = Column(String(36), ForeignKey("monitoring_batches.batch_id"), nullable=False)
    metrics = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    batch = relationship("MonitoringBatch", back_populates="performance_logs")


class Alert(Base):
    """Alert model - stores monitoring alerts"""

    __tablename__ = "alerts"

    alert_id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("training_jobs.job_id"), nullable=False)
    alert_type = Column(String(50), nullable=False)  # drift, performance_degradation, etc.
    severity = Column(String(50), nullable=False)  # warning, critical
    message = Column(Text, nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)


class ExternalModel(Base):
    """External Model - stores externally uploaded Docker container models for benchmarking"""

    __tablename__ = "external_models"

    model_id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), nullable=False)  # classification, regression

    # File paths
    dockerfile_path = Column(String(512), nullable=True)
    requirements_path = Column(String(512), nullable=True)
    model_files_path = Column(String(512), nullable=True)  # Directory containing model files

    # Model source type
    model_source = Column(String(50), default="docker")  # docker, native

    # Native model file paths (for direct sklearn model uploads)
    native_model_path = Column(String(512), nullable=True)  # model.pkl or model.joblib
    native_preprocessor_path = Column(String(512), nullable=True)  # preprocessor.pkl
    native_label_encoder_path = Column(String(512), nullable=True)  # label_encoder.pkl (classification)
    native_target_scaler_path = Column(String(512), nullable=True)  # target_scaler.pkl (regression)

    # Native model metadata
    feature_names = Column(JSON, nullable=True)  # List of expected input feature names
    class_names = Column(JSON, nullable=True)  # List of class names (classification only)

    # Container configuration
    predict_endpoint = Column(String(255), default="/predict")
    input_schema = Column(JSON, nullable=True)
    output_schema = Column(JSON, nullable=True)

    # Build status
    build_status = Column(String(50), default="pending")  # pending, building, ready, failed
    build_logs = Column(Text, nullable=True)
    build_progress = Column(Integer, default=0)
    current_build_step = Column(String(255), nullable=True)
    image_name = Column(String(255), nullable=True)
    image_id = Column(String(255), nullable=True)

    # Security scan results
    security_scan_status = Column(String(50), nullable=True)  # pending, passed, failed
    vulnerability_count = Column(JSON, nullable=True)  # {"critical": 0, "high": 0, "medium": 0, "low": 0}

    # Resource limits
    cpu_limit = Column(String(50), default="1.0")
    memory_limit = Column(String(50), default="512m")
    timeout_seconds = Column(Integer, default=30)
    idle_timeout_seconds = Column(Integer, default=300)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    validated_at = Column(DateTime, nullable=True)

    # Relationships
    container_instances = relationship("ContainerInstance", back_populates="external_model", cascade="all, delete-orphan")
    benchmark_runs = relationship("BenchmarkRun", back_populates="external_model", cascade="all, delete-orphan")


class BenchmarkRun(Base):
    """Benchmark Run - stores comparison results between platform and external models"""

    __tablename__ = "benchmark_runs"

    benchmark_id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=True)

    # References
    job_id = Column(String(36), ForeignKey("training_jobs.job_id"), nullable=False)
    external_model_id = Column(String(36), ForeignKey("external_models.model_id"), nullable=False)
    test_dataset_path = Column(String(512), nullable=True)

    # Status tracking
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    progress = Column(Integer, default=0)
    current_model = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)

    # Platform model results
    platform_metrics = Column(JSON, nullable=True)  # {"accuracy": 0.95, "f1": 0.92, ...}
    platform_predictions = Column(JSON, nullable=True)
    platform_inference_time_ms = Column(Float, nullable=True)

    # External model results
    external_metrics = Column(JSON, nullable=True)
    external_predictions = Column(JSON, nullable=True)
    external_inference_time_ms = Column(Float, nullable=True)

    # Comparison
    comparison_summary = Column(JSON, nullable=True)
    winner = Column(String(50), nullable=True)  # platform, external, tie
    performance_report = Column(JSON, nullable=True)
    visualizations = Column(JSON, nullable=True)  # Plotly JSON for comparison charts

    # Timestamps
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    job = relationship("TrainingJob", back_populates="benchmark_runs")
    external_model = relationship("ExternalModel", back_populates="benchmark_runs")
    request_logs = relationship("BenchmarkRequestLog", back_populates="benchmark_run", cascade="all, delete-orphan")


class ContainerInstance(Base):
    """Container Instance - tracks running Docker container instances"""

    __tablename__ = "container_instances"

    instance_id = Column(String(36), primary_key=True, default=generate_uuid)
    external_model_id = Column(String(36), ForeignKey("external_models.model_id"), nullable=False)

    # Docker container info
    container_id = Column(String(255), nullable=True)
    container_name = Column(String(255), nullable=True)
    status = Column(String(50), default="stopped")  # stopped, starting, running, stopping, error

    # Network
    host_port = Column(Integer, nullable=True)
    internal_port = Column(Integer, default=8080)

    # Usage tracking
    last_request_at = Column(DateTime, nullable=True)
    request_count = Column(Integer, default=0)
    total_inference_time_ms = Column(Float, default=0.0)
    error_count = Column(Integer, default=0)

    # Timestamps
    started_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    external_model = relationship("ExternalModel", back_populates="container_instances")
    request_logs = relationship("BenchmarkRequestLog", back_populates="container_instance", cascade="all, delete-orphan")


class BenchmarkRequestLog(Base):
    """Benchmark Request Log - logs individual prediction requests during benchmarking"""

    __tablename__ = "benchmark_request_logs"

    log_id = Column(String(36), primary_key=True, default=generate_uuid)
    benchmark_id = Column(String(36), ForeignKey("benchmark_runs.benchmark_id"), nullable=True)
    external_model_id = Column(String(36), ForeignKey("external_models.model_id"), nullable=True)
    instance_id = Column(String(36), ForeignKey("container_instances.instance_id"), nullable=True)

    # Request details
    request_type = Column(String(50), nullable=False)  # predict, batch_predict, health_check
    input_size = Column(Integer, nullable=True)  # Number of samples
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)

    # Timestamps
    requested_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    benchmark_run = relationship("BenchmarkRun", back_populates="request_logs")
    container_instance = relationship("ContainerInstance", back_populates="request_logs")


class Experiment(Base):
    """Experiment model - stores user-saved experiment metadata and progress"""

    __tablename__ = "experiments"

    experiment_id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    dataset_id = Column(String(36), ForeignKey("datasets.dataset_id"), nullable=False)
    task_type = Column(String(50), nullable=False)  # classification, regression, timeseries
    target_column = Column(String(255), nullable=False)
    status = Column(String(50), default="in_progress")  # in_progress, completed, archived

    # Linked records (optional - linked after creation)
    config_id = Column(String(36), ForeignKey("training_configs.config_id"), nullable=True)
    training_job_id = Column(String(36), ForeignKey("training_jobs.job_id"), nullable=True)

    # Quick stats for dashboard cards
    best_model_name = Column(String(100), nullable=True)
    best_metric_name = Column(String(50), nullable=True)
    best_metric_value = Column(Float, nullable=True)
    total_models_trained = Column(Integer, default=0)
    models_saved_for_benchmarking = Column(Integer, default=0)

    # Training duration
    training_duration_seconds = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    dataset = relationship("Dataset", back_populates="experiments")
    training_config = relationship("TrainingConfig", back_populates="experiment", uselist=False)
    training_job = relationship("TrainingJob", back_populates="experiment", uselist=False)
    test_runs = relationship("TestRun", back_populates="experiment")
