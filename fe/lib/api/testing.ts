// fe/lib/api/testing.ts

import {
  TestUploadResponse,
  TestRunRequest,
  TestRunResponse,
  TestResultsResponse,
  TestRunListResponse,
  MultiModelTestRequest,
  MultiModelTestResultsResponse,
  FinalizeModelRequest,
  FinalizeModelResponse,
  FinalizedModelsResponse,
} from "@/types/testing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class TestingAPI {
  /**
   * Upload test dataset
   */
  static async uploadTestDataset(
    file: File,
    jobId?: string
  ): Promise<TestUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (jobId) {
      formData.append("job_id", jobId);
    }

    const response = await fetch(`${API_BASE}/api/testing/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to upload test dataset");
    }

    return response.json();
  }

  /**
   * Run model evaluation on test data
   */
  static async runTest(request: TestRunRequest): Promise<TestRunResponse> {
    const response = await fetch(`${API_BASE}/api/testing/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to run test");
    }

    return response.json();
  }

  /**
   * Get test results
   */
  static async getResults(testRunId: string): Promise<TestResultsResponse> {
    const response = await fetch(
      `${API_BASE}/api/testing/results/${testRunId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get test results");
    }

    return response.json();
  }

  /**
   * List test runs for a job
   */
  static async listTestRuns(jobId: string): Promise<TestRunListResponse> {
    const response = await fetch(`${API_BASE}/api/testing/list/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to list test runs");
    }

    return response.json();
  }

  /**
   * Delete a test run
   */
  static async deleteTestRun(testRunId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/testing/${testRunId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to delete test run");
    }
  }

  /**
   * Run multi-model evaluation on test data
   * Tests ALL trained models, not just the best one
   */
  static async runAllModelsTest(
    request: MultiModelTestRequest
  ): Promise<MultiModelTestResultsResponse> {
    const response = await fetch(`${API_BASE}/api/testing/run-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to run multi-model test");
    }

    return response.json();
  }

  /**
   * Finalize selected models for benchmarking
   * Keeps selected models, creates combined pipeline package, deletes unused models
   */
  static async finalizeModels(
    request: FinalizeModelRequest
  ): Promise<FinalizeModelResponse> {
    const response = await fetch(`${API_BASE}/api/testing/finalize-model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to finalize models");
    }

    return response.json();
  }

  /**
   * Get finalized models available for benchmarking
   * Returns finalized models if available, otherwise all trained models
   */
  static async getFinalizedModels(
    jobId: string
  ): Promise<FinalizedModelsResponse> {
    const response = await fetch(
      `${API_BASE}/api/testing/finalized-models/${jobId}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to get finalized models");
    }

    return response.json();
  }
}
