// ============================================================
// Experiments Dashboard - API Client
// ============================================================

import axios from "axios";
import type {
  ExperimentCreate,
  ExperimentUpdate,
  ExperimentResponse,
  ExperimentListResponse,
  ExperimentFilters,
  SaveModelsRequest,
} from "@/types/experiment";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Experiments API Client
 * Handles all API calls for experiments management
 */
export const experimentsApi = {
  /**
   * Create a new experiment
   * @param experiment - Experiment creation data
   */
  create: async (experiment: ExperimentCreate): Promise<ExperimentResponse> => {
    const response = await axios.post<ExperimentResponse>(
      `${API_BASE_URL}/api/experiments`,
      experiment
    );
    return response.data;
  },

  /**
   * List all experiments with optional filters
   * @param filters - Optional filters for status, task_type, search
   * @param page - Page number (default 1)
   * @param pageSize - Page size (default 20)
   */
  list: async (
    filters?: ExperimentFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ExperimentListResponse> => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("page_size", pageSize.toString());

    if (filters?.status) {
      params.append("status", filters.status);
    }
    if (filters?.task_type) {
      params.append("task_type", filters.task_type);
    }
    if (filters?.search) {
      params.append("search", filters.search);
    }

    const response = await axios.get<ExperimentListResponse>(
      `${API_BASE_URL}/api/experiments?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get experiment details by ID
   * @param experimentId - UUID of the experiment
   */
  get: async (experimentId: string): Promise<ExperimentResponse> => {
    const response = await axios.get<ExperimentResponse>(
      `${API_BASE_URL}/api/experiments/${experimentId}`
    );
    return response.data;
  },

  /**
   * Update an experiment
   * @param experimentId - UUID of the experiment
   * @param update - Fields to update
   */
  update: async (
    experimentId: string,
    update: ExperimentUpdate
  ): Promise<ExperimentResponse> => {
    const response = await axios.patch<ExperimentResponse>(
      `${API_BASE_URL}/api/experiments/${experimentId}`,
      update
    );
    return response.data;
  },

  /**
   * Delete an experiment
   * @param experimentId - UUID of the experiment
   */
  delete: async (experimentId: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/api/experiments/${experimentId}`);
  },

  /**
   * Mark an experiment as completed
   * @param experimentId - UUID of the experiment
   */
  complete: async (experimentId: string): Promise<ExperimentResponse> => {
    const response = await axios.post<ExperimentResponse>(
      `${API_BASE_URL}/api/experiments/${experimentId}/complete`
    );
    return response.data;
  },

  /**
   * Get all trained models for an experiment
   * @param experimentId - UUID of the experiment
   */
  getModels: async (experimentId: string): Promise<unknown[]> => {
    const response = await axios.get<unknown[]>(
      `${API_BASE_URL}/api/experiments/${experimentId}/models`
    );
    return response.data;
  },

  /**
   * Save selected models for benchmarking
   * @param experimentId - UUID of the experiment
   * @param modelIds - Array of model IDs to save
   */
  saveModels: async (
    experimentId: string,
    modelIds: string[]
  ): Promise<ExperimentResponse> => {
    const request: SaveModelsRequest = { model_ids: modelIds };
    const response = await axios.post<ExperimentResponse>(
      `${API_BASE_URL}/api/experiments/${experimentId}/save-models`,
      request
    );
    return response.data;
  },
};

/**
 * Generate an auto-suggested experiment name
 * @param datasetName - Name of the dataset
 * @param taskType - Task type (classification, regression, timeseries)
 */
export function generateExperimentName(
  datasetName: string,
  taskType: string
): string {
  // Remove file extension if present
  const baseName = datasetName.replace(/\.[^/.]+$/, "");

  // Create timestamp in format YYYYMMDD_HHMM
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/(\d{8})(\d{4})/, "$1_$2");

  // Combine: dataset_tasktype_timestamp
  return `${baseName}_${taskType}_${timestamp}`;
}
