// fe/lib/api/monitoring.ts

import {
  MonitoringUploadResponse,
  DriftReportResponse,
  PerformanceResponse,
  MonitoringDashboard,
  AlertsResponse,
  DriftReportsListResponse,
  LogPerformanceResponse,
} from "@/types/monitoring";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class MonitoringAPI {
  /**
   * Upload monitoring data batch
   */
  static async uploadBatch(
    file: File,
    jobId: string,
    dataType: "predictions" | "actuals" | "features" = "predictions"
  ): Promise<MonitoringUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_id", jobId);
    formData.append("data_type", dataType);

    const response = await fetch(`${API_BASE}/api/monitoring/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload monitoring data");
    }

    return response.json();
  }

  /**
   * Detect data drift
   */
  static async detectDrift(
    jobId: string,
    currentDataId: string,
    driftThreshold: number = 0.05
  ): Promise<DriftReportResponse> {
    const response = await fetch(`${API_BASE}/api/monitoring/detect-drift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        current_data_id: currentDataId,
        drift_threshold: driftThreshold,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to detect drift");
    }

    return response.json();
  }

  /**
   * Get performance history
   */
  static async getPerformance(jobId: string): Promise<PerformanceResponse> {
    const response = await fetch(
      `${API_BASE}/api/monitoring/performance/${jobId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get performance");
    }

    return response.json();
  }

  /**
   * Get monitoring dashboard
   */
  static async getDashboard(jobId: string): Promise<MonitoringDashboard> {
    const response = await fetch(
      `${API_BASE}/api/monitoring/dashboard/${jobId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get dashboard");
    }

    return response.json();
  }

  /**
   * Get alerts for a job
   */
  static async getAlerts(
    jobId: string,
    includeResolved: boolean = false
  ): Promise<AlertsResponse> {
    const response = await fetch(
      `${API_BASE}/api/monitoring/alerts/${jobId}?include_resolved=${includeResolved}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get alerts");
    }

    return response.json();
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/api/monitoring/alerts/${alertId}/resolve`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to resolve alert");
    }
  }

  /**
   * Log performance metrics
   */
  static async logPerformance(
    jobId: string,
    batchId: string,
    metrics: Record<string, number>
  ): Promise<LogPerformanceResponse> {
    const formData = new FormData();
    formData.append("job_id", jobId);
    formData.append("batch_id", batchId);
    formData.append("metrics", JSON.stringify(metrics));

    const response = await fetch(`${API_BASE}/api/monitoring/log-performance`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to log performance");
    }

    return response.json();
  }

  /**
   * List drift reports
   */
  static async listDriftReports(
    jobId: string
  ): Promise<DriftReportsListResponse> {
    const response = await fetch(
      `${API_BASE}/api/monitoring/drift-reports/${jobId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to list drift reports");
    }

    return response.json();
  }
}
