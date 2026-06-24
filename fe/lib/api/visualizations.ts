// fe/lib/api/visualizations.ts

import { VisualizationResponse, VisualizationType } from "@/types/visualizations";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class VisualizationAPI {
  /**
   * Fetch any visualization by type
   */
  static async getVisualization(
    jobId: string,
    vizType: VisualizationType,
    params?: Record<string, string | number>
  ): Promise<VisualizationResponse> {
    const queryParams = params
      ? "?" + new URLSearchParams(
          Object.entries(params).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Record<string, string>)
        ).toString()
      : "";

    const response = await fetch(
      `${API_BASE}/api/training/job/${jobId}/visualizations/${vizType}${queryParams}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch visualization");
    }

    return response.json();
  }

  // Convenience methods for each visualization type

  static async getConfusionMatrix(
    jobId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(jobId, "confusion-matrix", params);
  }

  static async getROCCurves(
    jobId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(jobId, "roc-curves", params);
  }

  static async getPRCurves(
    jobId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(jobId, "pr-curves", params);
  }

  static async getFeatureImportance(
    jobId: string,
    topN: number = 20
  ): Promise<VisualizationResponse> {
    return this.getVisualization(jobId, "feature-importance", { top_n: topN });
  }

  static async getCalibrationPlot(
    jobId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(jobId, "calibration", params);
  }

  static async getPredictedVsActual(jobId: string): Promise<VisualizationResponse> {
    return this.getVisualization(jobId, "predicted-vs-actual");
  }

  static async getResidualPlot(jobId: string): Promise<VisualizationResponse> {
    return this.getVisualization(jobId, "residual-plot");
  }

  static async getQQPlot(jobId: string): Promise<VisualizationResponse> {
    return this.getVisualization(jobId, "qq-plot");
  }
}

/**
 * Test Visualization API
 * Fetches visualizations from test run results via dedicated endpoints
 */
export class TestVisualizationAPI {
  /**
   * Fetch any test visualization by type
   */
  static async getVisualization(
    testRunId: string,
    vizType: VisualizationType,
    params?: Record<string, string | number>
  ): Promise<VisualizationResponse> {
    const queryParams = params
      ? "?" + new URLSearchParams(
          Object.entries(params).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Record<string, string>)
        ).toString()
      : "";

    const response = await fetch(
      `${API_BASE}/api/testing/results/${testRunId}/visualizations/${vizType}${queryParams}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to fetch test visualization");
    }

    return response.json();
  }

  // Classification visualization methods

  static async getConfusionMatrix(
    testRunId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(testRunId, "confusion-matrix", params);
  }

  static async getROCCurves(
    testRunId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(testRunId, "roc-curves", params);
  }

  static async getPRCurves(
    testRunId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(testRunId, "pr-curves", params);
  }

  // Regression visualization methods

  static async getPredictedVsActual(
    testRunId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(testRunId, "predicted-vs-actual", params);
  }

  static async getResidualPlot(
    testRunId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(testRunId, "residual-plot", params);
  }

  static async getQQPlot(
    testRunId: string,
    estimatorName?: string
  ): Promise<VisualizationResponse> {
    const params = estimatorName ? { estimator_name: estimatorName } : undefined;
    return this.getVisualization(testRunId, "qq-plot", params);
  }

  // Common visualization methods

  static async getFeatureImportance(
    testRunId: string,
    estimatorName?: string,
    topN: number = 20
  ): Promise<VisualizationResponse> {
    const params: Record<string, string | number> = { top_n: topN };
    if (estimatorName) {
      params.estimator_name = estimatorName;
    }
    return this.getVisualization(testRunId, "feature-importance", params);
  }
}
