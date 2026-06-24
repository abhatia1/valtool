// lib/api/training.ts
// Phase 4: Classification Training - API Client

import axios from "axios";
import type {
  StartTrainingRequest,
  StartTrainingResponse,
  TrainingStatusResponse,
  TrainingResults,
  ModelComparisonResponse,
  TrainingJobsResponse,
  CancelTrainingResponse,
  DeleteTrainingResponse,
} from "@/types/training";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export class TrainingAPI {
  /**
   * Start a new training job
   */
  static async startTraining(
    request: StartTrainingRequest
  ): Promise<StartTrainingResponse> {
    const response = await apiClient.post<StartTrainingResponse>(
      "/api/training/start",
      request
    );
    return response.data;
  }

  /**
   * Get training job status with real-time progress
   */
  static async getStatus(jobId: string): Promise<TrainingStatusResponse> {
    const response = await apiClient.get<TrainingStatusResponse>(
      `/api/training/job/${jobId}/status`
    );
    return response.data;
  }

  /**
   * Get comprehensive training results (only available when status is "completed")
   */
  static async getResults(jobId: string): Promise<TrainingResults> {
    const response = await apiClient.get<TrainingResults>(
      `/api/training/job/${jobId}/results`
    );
    return response.data;
  }

  /**
   * Get detailed comparison of all trained models
   */
  static async getComparison(
    jobId: string
  ): Promise<ModelComparisonResponse> {
    const response = await apiClient.get<ModelComparisonResponse>(
      `/api/training/job/${jobId}/comparison`
    );
    return response.data;
  }

  /**
   * Cancel a queued or running training job
   */
  static async cancelJob(jobId: string): Promise<CancelTrainingResponse> {
    const response = await apiClient.post<CancelTrainingResponse>(
      `/api/training/job/${jobId}/cancel`
    );
    return response.data;
  }

  /**
   * List all training jobs with optional filtering
   */
  static async listJobs(
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TrainingJobsResponse> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await apiClient.get<TrainingJobsResponse>(
      `/api/training/jobs?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Delete a training job (cannot delete running jobs)
   */
  static async deleteJob(jobId: string): Promise<DeleteTrainingResponse> {
    const response = await apiClient.delete<DeleteTrainingResponse>(
      `/api/training/job/${jobId}`
    );
    return response.data;
  }
}
