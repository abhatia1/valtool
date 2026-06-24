// fe/types/monitoring.ts

export interface MonitoringUploadResponse {
  batch_id: string;
  job_id: string;
  filename: string;
  file_path: string;
  data_type: string;
  rows: number;
  columns: number;
  column_names: string[];
  status: string;
  uploaded_at: string;
}

export interface FeatureDrift {
  drift_detected: boolean;
  drift_score: number;
  statistical_test: string;
  p_value: number | null;
  threshold: number;
}

export interface DriftReportResponse {
  drift_report_id: string;
  overall_drift_detected: boolean;
  feature_drift: Record<string, FeatureDrift>;
  features_with_drift: string[];
  drift_severity: "none" | "low" | "medium" | "high";
  visualizations: Record<string, string>;
  recommendations: string[];
  detected_at: string;
}

export interface PerformanceTrend {
  trend: "improving" | "stable" | "degrading";
  percent_change: number;
  is_significant: boolean;
}

export interface AlertInfo {
  alert_id: string;
  severity: "warning" | "critical";
  metric: string;
  message: string;
  triggered_at: string;
}

export interface PerformanceHistoryItem {
  timestamp: string;
  batch_id: string;
  metrics: Record<string, number>;
  sample_count: number;
}

export interface PerformanceResponse {
  job_id: string;
  baseline_metrics: Record<string, number>;
  performance_history: PerformanceHistoryItem[];
  performance_trend: Record<string, PerformanceTrend>;
  alerts: AlertInfo[];
  visualizations: Record<string, string>;
}

export type HealthStatus = "healthy" | "caution" | "warning" | "critical";

export interface MonitoringDashboard {
  job_id: string;
  job_name: string;
  task_type: string;
  health_status: HealthStatus;
  baseline_metrics: Record<string, number>;
  monitoring_summary: {
    total_batches: number;
    total_rows_monitored: number;
    latest_batch_at: string | null;
  };
  drift_summary: {
    overall_drift_detected: boolean;
    drift_severity: string;
    features_with_drift: string[];
    last_checked: string | null;
  };
  performance_summary: {
    latest_metrics: Record<string, number>;
    entries_count: number;
  };
  alerts_summary: {
    unresolved_count: number;
    critical_count: number;
    warning_count: number;
  };
  recent_batches: Array<{
    batch_id: string;
    data_type: string;
    rows: number;
    uploaded_at: string;
  }>;
  recent_alerts: Array<{
    alert_id: string;
    alert_type: string;
    severity: string;
    message: string;
    triggered_at: string;
  }>;
}

export interface AlertsResponse {
  job_id: string;
  total: number;
  alerts: Array<{
    alert_id: string;
    alert_type: string;
    severity: string;
    message: string;
    triggered_at: string;
    resolved: boolean;
  }>;
}

export interface DriftReportsListResponse {
  job_id: string;
  total: number;
  drift_reports: Array<{
    drift_report_id: string;
    batch_id: string;
    overall_drift_detected: boolean;
    drift_severity: string;
    detected_at: string;
  }>;
}

export interface LogPerformanceResponse {
  log_id: string;
  job_id: string;
  batch_id: string;
  metrics: Record<string, number>;
  alerts_generated: number;
  timestamp: string;
}
