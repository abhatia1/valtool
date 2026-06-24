"""
Monitoring API - Model Monitoring Endpoints

Provides endpoints for production model monitoring:
- Upload monitoring data batches
- Detect data drift
- Track model performance
- View monitoring dashboard
- Manage alerts
"""

import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from models.database import (
    Alert,
    Dataset,
    DriftReport,
    MonitoringBatch,
    PerformanceLog,
    TrainingConfig,
    TrainingJob,
)
from models.schemas import (
    AlertInfo,
    DriftDetectionRequest,
    DriftReportResponse,
    FeatureDrift,
    PerformanceHistoryItem,
    PerformanceResponse,
    PerformanceTrend,
)
from services.monitoring_service import (
    DataDriftDetector,
    MonitoringService,
    PerformanceTracker,
    monitoring_service,
)
from utils.file_utils import save_upload_file

router = APIRouter()


@router.post("/upload", response_model=Dict[str, Any])
async def upload_monitoring_data(
    file: UploadFile = File(...),
    job_id: str = Form(...),
    data_type: str = Form(default="predictions"),
    db: Session = Depends(get_db),
):
    """
    Upload monitoring data batch for drift detection and performance tracking.

    Args:
        file: CSV/Excel file containing monitoring data
        job_id: Training job ID to monitor
        data_type: Type of data ('predictions' or 'actuals')
        db: Database session

    Returns:
        Upload confirmation with batch_id
    """
    # Validate file extension
    allowed_extensions = [".csv", ".xlsx", ".xls"]
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}",
        )

    # Validate data_type
    valid_data_types = ["predictions", "actuals", "features"]
    if data_type not in valid_data_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid data_type. Allowed: {', '.join(valid_data_types)}",
        )

    # Validate job exists
    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Training job must be completed before monitoring",
        )

    # Generate batch ID and save file
    batch_id = str(uuid.uuid4())
    monitoring_dir = os.path.join(settings.STORAGE_PATH, "monitoring", job_id)
    os.makedirs(monitoring_dir, exist_ok=True)

    file_path = os.path.join(monitoring_dir, f"{batch_id}{file_ext}")

    # Save file
    await save_upload_file(file, file_path)

    # Load and validate dataset
    try:
        if file_ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Create monitoring batch record
    batch = MonitoringBatch(
        batch_id=batch_id,
        job_id=job_id,
        data_type=data_type,
        file_path=file_path,
        rows=len(df),
        uploaded_at=datetime.utcnow(),
    )

    db.add(batch)
    db.commit()
    db.refresh(batch)

    return {
        "batch_id": batch_id,
        "job_id": job_id,
        "filename": file.filename,
        "file_path": file_path,
        "data_type": data_type,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": df.columns.tolist(),
        "status": "uploaded",
        "uploaded_at": batch.uploaded_at.isoformat(),
    }


@router.post("/detect-drift", response_model=DriftReportResponse)
async def detect_drift(
    request: DriftDetectionRequest,
    db: Session = Depends(get_db),
):
    """
    Detect data drift between training data and monitoring data.

    Uses statistical tests (KS test for numerical, Chi-square for categorical)
    to identify distribution shifts in features.

    Args:
        request: Drift detection request with job_id and current_data_id
        db: Database session

    Returns:
        Drift report with per-feature analysis and recommendations
    """
    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == request.job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    # Get monitoring batch
    batch = (
        db.query(MonitoringBatch)
        .filter(MonitoringBatch.batch_id == request.current_data_id)
        .first()
    )

    if not batch:
        raise HTTPException(status_code=404, detail="Monitoring batch not found")

    # Get config and original dataset for reference
    config = (
        db.query(TrainingConfig)
        .filter(TrainingConfig.config_id == job.config_id)
        .first()
    )

    if not config:
        raise HTTPException(status_code=404, detail="Training configuration not found")

    dataset = db.query(Dataset).filter(Dataset.dataset_id == config.dataset_id).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Original dataset not found")

    # Load reference (training) data
    try:
        if dataset.file_path.endswith(".csv"):
            reference_df = pd.read_csv(dataset.file_path)
        else:
            reference_df = pd.read_excel(dataset.file_path)

        # Drop target column for drift detection (we compare features only)
        if config.target_column in reference_df.columns:
            reference_df = reference_df.drop(columns=[config.target_column])
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load reference data: {str(e)}"
        )

    # Load current (monitoring) data
    try:
        if batch.file_path.endswith(".csv"):
            current_df = pd.read_csv(batch.file_path)
        else:
            current_df = pd.read_excel(batch.file_path)

        # Drop target column if present
        if config.target_column in current_df.columns:
            current_df = current_df.drop(columns=[config.target_column])
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load monitoring data: {str(e)}"
        )

    # Detect drift
    try:
        drift_results = monitoring_service.detect_drift(
            job_id=request.job_id,
            current_data=current_df,
            reference_data=reference_df,
            drift_threshold=request.drift_threshold,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drift detection failed: {str(e)}")

    # Convert results to schema format
    feature_drift = {}
    for feature, result in drift_results.get("feature_drift", {}).items():
        feature_drift[feature] = FeatureDrift(
            drift_detected=result.get("drift_detected", False),
            drift_score=result.get("drift_score", 0.0),
            statistical_test=result.get("statistical_test", "unknown"),
            p_value=result.get("p_value"),
            threshold=result.get("threshold", request.drift_threshold),
        )

    # Generate visualizations
    visualizations = _generate_drift_visualizations(
        reference_df, current_df, drift_results.get("feature_drift", {})
    )

    # Generate recommendations
    recommendations = monitoring_service.generate_recommendations(
        drift_results, []
    )

    # Create drift report record
    drift_report = DriftReport(
        job_id=request.job_id,
        batch_id=request.current_data_id,
        overall_drift_detected=drift_results.get("overall_drift_detected", False),
        feature_drift=drift_results.get("feature_drift", {}),
        drift_severity=drift_results.get("drift_severity", "none"),
        detected_at=datetime.utcnow(),
    )

    db.add(drift_report)

    # Create alerts if drift detected
    if drift_results.get("overall_drift_detected"):
        severity = drift_results.get("drift_severity", "low")
        alert_severity = "critical" if severity == "high" else "warning"

        alert = Alert(
            job_id=request.job_id,
            alert_type="drift",
            severity=alert_severity,
            message=f"Data drift detected: {severity} severity. "
            f"Features affected: {', '.join(drift_results.get('features_with_drift', []))}",
            triggered_at=datetime.utcnow(),
            resolved=False,
        )
        db.add(alert)

    db.commit()
    db.refresh(drift_report)

    return DriftReportResponse(
        drift_report_id=drift_report.drift_report_id,
        overall_drift_detected=drift_report.overall_drift_detected,
        feature_drift=feature_drift,
        features_with_drift=drift_results.get("features_with_drift", []),
        drift_severity=drift_report.drift_severity,
        visualizations=visualizations,
        recommendations=recommendations,
        detected_at=drift_report.detected_at,
    )


@router.get("/performance/{job_id}", response_model=PerformanceResponse)
async def get_performance(
    job_id: str,
    db: Session = Depends(get_db),
):
    """
    Get model performance tracking data.

    Returns performance history, trends, and alerts for the specified job.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        Performance data with history, trends, and alerts
    """
    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    # Get baseline metrics from training results
    baseline_metrics = {}
    if job.results and "best_model" in job.results:
        baseline_metrics = job.results["best_model"].get("metrics", {})

    # Get performance logs
    performance_logs = (
        db.query(PerformanceLog)
        .filter(PerformanceLog.job_id == job_id)
        .order_by(PerformanceLog.timestamp)
        .all()
    )

    # Build performance history
    history = []
    for log in performance_logs:
        batch = (
            db.query(MonitoringBatch)
            .filter(MonitoringBatch.batch_id == log.batch_id)
            .first()
        )

        history.append(
            PerformanceHistoryItem(
                timestamp=log.timestamp,
                batch_id=log.batch_id,
                metrics=log.metrics or {},
                sample_count=batch.rows if batch else 0,
            )
        )

    # Calculate trends
    trends = {}
    if len(history) >= 2:
        tracker = PerformanceTracker(baseline_metrics)
        for item in history:
            tracker.log_performance(
                metrics=item.metrics,
                batch_id=item.batch_id,
                sample_count=item.sample_count,
                timestamp=item.timestamp,
            )

        # Calculate trend for each metric in baseline
        for metric in baseline_metrics.keys():
            trend_data = tracker.get_performance_trend(metric)
            trends[metric] = PerformanceTrend(
                trend=trend_data.get("trend", "stable"),
                percent_change=trend_data.get("percent_change", 0.0),
                is_significant=trend_data.get("is_significant", False),
            )

    # Get alerts
    alerts_query = (
        db.query(Alert)
        .filter(Alert.job_id == job_id)
        .order_by(Alert.triggered_at.desc())
        .limit(20)
        .all()
    )

    alerts = [
        AlertInfo(
            alert_id=alert.alert_id,
            severity=alert.severity,
            metric=alert.alert_type,
            message=alert.message,
            triggered_at=alert.triggered_at,
        )
        for alert in alerts_query
    ]

    # Generate visualizations
    visualizations = _generate_performance_visualizations(history, baseline_metrics)

    return PerformanceResponse(
        job_id=job_id,
        baseline_metrics=baseline_metrics,
        performance_history=history,
        performance_trend=trends,
        alerts=alerts,
        visualizations=visualizations,
    )


@router.get("/dashboard/{job_id}", response_model=Dict[str, Any])
async def get_monitoring_dashboard(
    job_id: str,
    db: Session = Depends(get_db),
):
    """
    Get comprehensive monitoring dashboard data.

    Combines drift detection, performance tracking, and alerts
    into a single dashboard view.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        Dashboard data with all monitoring metrics
    """
    # Get training job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    # Get config
    config = (
        db.query(TrainingConfig)
        .filter(TrainingConfig.config_id == job.config_id)
        .first()
    )

    # Get monitoring batches
    batches = (
        db.query(MonitoringBatch)
        .filter(MonitoringBatch.job_id == job_id)
        .order_by(MonitoringBatch.uploaded_at.desc())
        .all()
    )

    # Get latest drift report
    latest_drift = (
        db.query(DriftReport)
        .filter(DriftReport.job_id == job_id)
        .order_by(DriftReport.detected_at.desc())
        .first()
    )

    # Get performance logs
    performance_logs = (
        db.query(PerformanceLog)
        .filter(PerformanceLog.job_id == job_id)
        .order_by(PerformanceLog.timestamp.desc())
        .limit(10)
        .all()
    )

    # Get unresolved alerts
    unresolved_alerts = (
        db.query(Alert)
        .filter(Alert.job_id == job_id, Alert.resolved == False)
        .order_by(Alert.triggered_at.desc())
        .all()
    )

    # Get baseline metrics
    baseline_metrics = {}
    if job.results and "best_model" in job.results:
        baseline_metrics = job.results["best_model"].get("metrics", {})

    # Calculate overall health status
    health_status = _calculate_health_status(
        latest_drift, performance_logs, unresolved_alerts
    )

    return {
        "job_id": job_id,
        "job_name": job.job_name,
        "task_type": config.task_type if config else "unknown",
        "health_status": health_status,
        "baseline_metrics": baseline_metrics,
        "monitoring_summary": {
            "total_batches": len(batches),
            "total_rows_monitored": sum(b.rows or 0 for b in batches),
            "latest_batch_at": batches[0].uploaded_at.isoformat() if batches else None,
        },
        "drift_summary": {
            "overall_drift_detected": latest_drift.overall_drift_detected
            if latest_drift
            else False,
            "drift_severity": latest_drift.drift_severity if latest_drift else "none",
            "features_with_drift": (
                list(
                    k
                    for k, v in (latest_drift.feature_drift or {}).items()
                    if v.get("drift_detected")
                )
                if latest_drift
                else []
            ),
            "last_checked": (
                latest_drift.detected_at.isoformat() if latest_drift else None
            ),
        },
        "performance_summary": {
            "latest_metrics": (
                performance_logs[0].metrics if performance_logs else {}
            ),
            "entries_count": len(performance_logs),
        },
        "alerts_summary": {
            "unresolved_count": len(unresolved_alerts),
            "critical_count": sum(
                1 for a in unresolved_alerts if a.severity == "critical"
            ),
            "warning_count": sum(
                1 for a in unresolved_alerts if a.severity == "warning"
            ),
        },
        "recent_batches": [
            {
                "batch_id": b.batch_id,
                "data_type": b.data_type,
                "rows": b.rows,
                "uploaded_at": b.uploaded_at.isoformat(),
            }
            for b in batches[:5]
        ],
        "recent_alerts": [
            {
                "alert_id": a.alert_id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "triggered_at": a.triggered_at.isoformat(),
            }
            for a in unresolved_alerts[:5]
        ],
    }


@router.get("/alerts/{job_id}", response_model=Dict[str, Any])
async def get_alerts(
    job_id: str,
    include_resolved: bool = False,
    db: Session = Depends(get_db),
):
    """
    Get alerts for a training job.

    Args:
        job_id: Training job ID
        include_resolved: Whether to include resolved alerts
        db: Database session

    Returns:
        List of alerts
    """
    query = db.query(Alert).filter(Alert.job_id == job_id)

    if not include_resolved:
        query = query.filter(Alert.resolved == False)

    alerts = query.order_by(Alert.triggered_at.desc()).all()

    return {
        "job_id": job_id,
        "total": len(alerts),
        "alerts": [
            {
                "alert_id": a.alert_id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "triggered_at": a.triggered_at.isoformat(),
                "resolved": a.resolved,
            }
            for a in alerts
        ],
    }


@router.post("/alerts/{alert_id}/resolve", response_model=Dict[str, Any])
async def resolve_alert(
    alert_id: str,
    db: Session = Depends(get_db),
):
    """
    Mark an alert as resolved.

    Args:
        alert_id: Alert ID
        db: Database session

    Returns:
        Confirmation
    """
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.resolved = True
    db.commit()

    return {
        "alert_id": alert_id,
        "resolved": True,
        "message": "Alert resolved successfully",
    }


@router.post("/log-performance", response_model=Dict[str, Any])
async def log_performance(
    job_id: str = Form(...),
    batch_id: str = Form(...),
    metrics: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Log performance metrics for a monitoring batch.

    Args:
        job_id: Training job ID
        batch_id: Monitoring batch ID
        metrics: JSON string of metrics dictionary
        db: Database session

    Returns:
        Performance log confirmation
    """
    # Validate job
    job = db.query(TrainingJob).filter(TrainingJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    # Validate batch
    batch = (
        db.query(MonitoringBatch)
        .filter(MonitoringBatch.batch_id == batch_id)
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Monitoring batch not found")

    # Parse metrics
    try:
        metrics_dict = json.loads(metrics)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid metrics JSON")

    # Create performance log
    log = PerformanceLog(
        job_id=job_id,
        batch_id=batch_id,
        metrics=metrics_dict,
        timestamp=datetime.utcnow(),
    )

    db.add(log)

    # Check for alerts
    baseline_metrics = {}
    if job.results and "best_model" in job.results:
        baseline_metrics = job.results["best_model"].get("metrics", {})

    tracker = PerformanceTracker(baseline_metrics)
    tracker.log_performance(
        metrics=metrics_dict,
        batch_id=batch_id,
        sample_count=batch.rows or 0,
    )

    alerts = tracker.check_alerts()

    # Create alert records
    for alert_data in alerts:
        alert = Alert(
            job_id=job_id,
            alert_type=alert_data["alert_type"],
            severity=alert_data["severity"],
            message=alert_data["message"],
            triggered_at=datetime.utcnow(),
            resolved=False,
        )
        db.add(alert)

    db.commit()
    db.refresh(log)

    return {
        "log_id": log.log_id,
        "job_id": job_id,
        "batch_id": batch_id,
        "metrics": metrics_dict,
        "alerts_generated": len(alerts),
        "timestamp": log.timestamp.isoformat(),
    }


@router.get("/drift-reports/{job_id}", response_model=Dict[str, Any])
async def list_drift_reports(
    job_id: str,
    db: Session = Depends(get_db),
):
    """
    List all drift reports for a training job.

    Args:
        job_id: Training job ID
        db: Database session

    Returns:
        List of drift reports
    """
    reports = (
        db.query(DriftReport)
        .filter(DriftReport.job_id == job_id)
        .order_by(DriftReport.detected_at.desc())
        .all()
    )

    return {
        "job_id": job_id,
        "total": len(reports),
        "drift_reports": [
            {
                "drift_report_id": r.drift_report_id,
                "batch_id": r.batch_id,
                "overall_drift_detected": r.overall_drift_detected,
                "drift_severity": r.drift_severity,
                "detected_at": r.detected_at.isoformat(),
            }
            for r in reports
        ],
    }


def _generate_drift_visualizations(
    reference_df: pd.DataFrame,
    current_df: pd.DataFrame,
    feature_drift: Dict[str, Any],
) -> Dict[str, str]:
    """Generate drift visualizations using Plotly."""
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots

    visualizations = {}

    # Drift score bar chart
    features = list(feature_drift.keys())[:10]  # Limit to 10 features
    scores = [feature_drift[f].get("drift_score", 0) for f in features]
    colors = [
        "red" if feature_drift[f].get("drift_detected") else "green"
        for f in features
    ]

    fig = go.Figure(
        data=[
            go.Bar(
                x=features,
                y=scores,
                marker_color=colors,
                text=[f"{s:.3f}" for s in scores],
                textposition="auto",
            )
        ]
    )
    fig.update_layout(
        title="Feature Drift Scores",
        xaxis_title="Feature",
        yaxis_title="Drift Score",
        template="plotly_white",
    )
    visualizations["drift_scores"] = json.dumps(fig.to_dict())

    # Distribution comparison for top drifted features
    drifted_features = [f for f in features if feature_drift[f].get("drift_detected")][:3]

    if drifted_features:
        fig = make_subplots(
            rows=1, cols=len(drifted_features),
            subplot_titles=drifted_features
        )

        for i, feature in enumerate(drifted_features, 1):
            if feature in reference_df.columns and feature in current_df.columns:
                ref_values = reference_df[feature].dropna()
                curr_values = current_df[feature].dropna()

                if pd.api.types.is_numeric_dtype(ref_values):
                    fig.add_trace(
                        go.Histogram(
                            x=ref_values,
                            name="Reference",
                            opacity=0.7,
                            marker_color="blue",
                        ),
                        row=1, col=i
                    )
                    fig.add_trace(
                        go.Histogram(
                            x=curr_values,
                            name="Current",
                            opacity=0.7,
                            marker_color="red",
                        ),
                        row=1, col=i
                    )

        fig.update_layout(
            title="Distribution Comparison for Drifted Features",
            template="plotly_white",
            barmode="overlay",
            showlegend=True,
        )
        visualizations["distribution_comparison"] = json.dumps(fig.to_dict())

    return visualizations


def _generate_performance_visualizations(
    history: List[PerformanceHistoryItem],
    baseline_metrics: Dict[str, float],
) -> Dict[str, str]:
    """Generate performance visualizations using Plotly."""
    import plotly.graph_objects as go

    visualizations = {}

    if not history:
        return visualizations

    # Performance over time
    timestamps = [h.timestamp for h in history]
    metrics_to_plot = list(baseline_metrics.keys())[:4]  # Limit to 4 metrics

    fig = go.Figure()

    for metric in metrics_to_plot:
        values = [h.metrics.get(metric) for h in history]
        fig.add_trace(
            go.Scatter(
                x=timestamps,
                y=values,
                mode="lines+markers",
                name=metric,
            )
        )

        # Add baseline as horizontal line
        if metric in baseline_metrics:
            fig.add_hline(
                y=baseline_metrics[metric],
                line_dash="dash",
                line_color="gray",
                annotation_text=f"{metric} baseline",
            )

    fig.update_layout(
        title="Performance Over Time",
        xaxis_title="Timestamp",
        yaxis_title="Metric Value",
        template="plotly_white",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
    )
    visualizations["performance_timeline"] = json.dumps(fig.to_dict())

    return visualizations


def _calculate_health_status(
    latest_drift: Optional[DriftReport],
    performance_logs: List[PerformanceLog],
    unresolved_alerts: List[Alert],
) -> str:
    """Calculate overall model health status."""
    # Check for critical alerts
    critical_alerts = [a for a in unresolved_alerts if a.severity == "critical"]
    if critical_alerts:
        return "critical"

    # Check for high severity drift
    if latest_drift and latest_drift.drift_severity == "high":
        return "warning"

    # Check for moderate issues
    if len(unresolved_alerts) > 5:
        return "warning"

    if latest_drift and latest_drift.overall_drift_detected:
        return "caution"

    return "healthy"
