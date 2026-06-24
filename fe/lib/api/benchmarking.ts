/**
 * Benchmarking API Client
 *
 * API client for external model management and benchmark execution.
 */

import type {
  ExternalModel,
  ExternalModelUploadRequest,
  ContainerBuildStatus,
  BenchmarkConfig,
  BenchmarkRun,
  BenchmarkComparison,
  ExternalModelListResponse,
  BenchmarkListResponse,
  NativeModelUploadMetadata,
  NativeModelValidationResponse,
} from "@/types/benchmarking";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class BenchmarkingAPI {
  // ==========================================
  // External Model Management
  // ==========================================

  /**
   * Upload an external model with Dockerfile and model files
   */
  static async uploadExternalModel(
    metadata: ExternalModelUploadRequest,
    dockerfile: File,
    requirements: File | null,
    modelFiles: File[]
  ): Promise<ExternalModel> {
    const formData = new FormData();
    formData.append("metadata", JSON.stringify(metadata));
    formData.append("dockerfile", dockerfile);
    if (requirements) {
      formData.append("requirements", requirements);
    }
    modelFiles.forEach((file) => formData.append("model_files", file));

    const response = await fetch(
      `${API_BASE}/api/benchmarking/external-models/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload external model");
    }

    return response.json();
  }

  /**
   * Upload a native sklearn model (pickle/joblib) for benchmarking
   * Native models are immediately ready - no Docker build required
   */
  static async uploadNativeModel(
    metadata: NativeModelUploadMetadata,
    modelFile: File,
    preprocessorFile?: File,
    labelEncoderFile?: File,
    targetScalerFile?: File
  ): Promise<ExternalModel> {
    const formData = new FormData();
    formData.append("name", metadata.name);
    formData.append("task_type", metadata.task_type);
    if (metadata.description) {
      formData.append("description", metadata.description);
    }
    if (metadata.feature_names) {
      formData.append("feature_names", JSON.stringify(metadata.feature_names));
    }
    if (metadata.class_names) {
      formData.append("class_names", JSON.stringify(metadata.class_names));
    }
    formData.append("model_file", modelFile);
    if (preprocessorFile) {
      formData.append("preprocessor_file", preprocessorFile);
    }
    if (labelEncoderFile) {
      formData.append("label_encoder_file", labelEncoderFile);
    }
    if (targetScalerFile) {
      formData.append("target_scaler_file", targetScalerFile);
    }

    const response = await fetch(
      `${API_BASE}/api/benchmarking/external-models/upload-native`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload native model");
    }

    return response.json();
  }

  /**
   * Validate a native model's capabilities
   */
  static async validateNativeModel(
    modelId: string
  ): Promise<NativeModelValidationResponse> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/external-models/${modelId}/validate-native`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to validate native model");
    }

    return response.json();
  }

  /**
   * Get build status for an external model
   */
  static async getBuildStatus(modelId: string): Promise<ContainerBuildStatus> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/external-models/${modelId}/build-status`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get build status");
    }

    return response.json();
  }

  /**
   * Trigger container build for an external model
   */
  static async buildContainer(modelId: string): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/external-models/${modelId}/build`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to start container build");
    }

    return response.json();
  }

  /**
   * List all external models
   */
  static async listExternalModels(
    taskType?: "classification" | "regression"
  ): Promise<ExternalModel[]> {
    const url = new URL(`${API_BASE}/api/benchmarking/external-models`);
    if (taskType) {
      url.searchParams.append("task_type", taskType);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to list external models");
    }

    const data: ExternalModelListResponse = await response.json();
    return data.models;
  }

  /**
   * Get a specific external model
   */
  static async getExternalModel(modelId: string): Promise<ExternalModel> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/external-models/${modelId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get external model");
    }

    return response.json();
  }

  /**
   * Delete an external model
   */
  static async deleteExternalModel(modelId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/external-models/${modelId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete external model");
    }
  }

  // ==========================================
  // Container Runtime
  // ==========================================

  /**
   * Start a container for an external model
   */
  static async startContainer(
    modelId: string
  ): Promise<{ container_id: string; port: number }> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/containers/${modelId}/start`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to start container");
    }

    return response.json();
  }

  /**
   * Stop a running container
   */
  static async stopContainer(modelId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/containers/${modelId}/stop`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to stop container");
    }
  }

  /**
   * Get container status
   */
  static async getContainerStatus(
    modelId: string
  ): Promise<{ status: string; port?: number }> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/containers/${modelId}/status`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get container status");
    }

    return response.json();
  }

  // ==========================================
  // Benchmark Execution
  // ==========================================

  /**
   * Start a benchmark run
   */
  static async startBenchmark(config: BenchmarkConfig): Promise<BenchmarkRun> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/benchmarks/start`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to start benchmark");
    }

    return response.json();
  }

  /**
   * Get benchmark status
   */
  static async getBenchmarkStatus(benchmarkId: string): Promise<BenchmarkRun> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/benchmarks/${benchmarkId}/status`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get benchmark status");
    }

    return response.json();
  }

  /**
   * Get benchmark results
   */
  static async getBenchmarkResults(
    benchmarkId: string
  ): Promise<BenchmarkComparison> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/benchmarks/${benchmarkId}/results`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get benchmark results");
    }

    return response.json();
  }

  /**
   * Cancel a running benchmark
   */
  static async cancelBenchmark(benchmarkId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/benchmarks/${benchmarkId}/cancel`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to cancel benchmark");
    }
  }

  /**
   * List benchmarks for a training job
   */
  static async listBenchmarks(jobId: string): Promise<BenchmarkRun[]> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/benchmarks?job_id=${jobId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to list benchmarks");
    }

    const data: BenchmarkListResponse = await response.json();
    return data.benchmarks;
  }

  /**
   * Delete a benchmark
   */
  static async deleteBenchmark(benchmarkId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/benchmarks/${benchmarkId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete benchmark");
    }
  }

  // ==========================================
  // Export
  // ==========================================

  /**
   * Export benchmark report
   */
  static async exportReport(
    benchmarkId: string,
    format: "pdf" | "json" | "csv"
  ): Promise<Blob> {
    const response = await fetch(
      `${API_BASE}/api/benchmarking/benchmarks/${benchmarkId}/export?format=${format}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to export report");
    }

    return response.blob();
  }

  /**
   * Download exported report
   */
  static async downloadReport(
    benchmarkId: string,
    format: "pdf" | "json" | "csv"
  ): Promise<void> {
    const blob = await this.exportReport(benchmarkId, format);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benchmark-report-${benchmarkId}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
