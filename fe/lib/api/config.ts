// ============================================================
// Phase 3: Configuration Management - API Client
// ============================================================

import axios from "axios";
import type {
  ConfigTemplatesResponse,
  EstimatorsResponse,
  TaskType,
  ValidatePreprocessingRequest,
  ValidationResponse,
  TrainingConfigCreate,
  TrainingConfigResponse,
} from "@/types/config";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Configuration API Client
 * Handles all API calls for Phase 3: Configuration Management
 */
export const configApi = {
  /**
   * Get all configuration templates (Quick Start, Standard, Deep Search)
   */
  getTemplates: async (): Promise<ConfigTemplatesResponse> => {
    const response = await axios.get<ConfigTemplatesResponse>(
      `${API_BASE_URL}/api/config/templates`
    );
    return response.data;
  },

  /**
   * Get estimators for a specific task type
   * @param taskType - "classification" | "regression" | "timeseries"
   */
  getEstimators: async (taskType: TaskType): Promise<EstimatorsResponse> => {
    const response = await axios.get<EstimatorsResponse>(
      `${API_BASE_URL}/api/config/estimators/${taskType}`
    );
    return response.data;
  },

  /**
   * Validate preprocessing configuration against a dataset
   * @param request - Dataset ID and preprocessing config
   */
  validatePreprocessing: async (
    request: ValidatePreprocessingRequest
  ): Promise<ValidationResponse> => {
    const response = await axios.post<ValidationResponse>(
      `${API_BASE_URL}/api/config/validate-preprocessing`,
      request
    );
    return response.data;
  },

  /**
   * Create a complete training configuration
   * @param config - Full training configuration
   */
  createConfig: async (
    config: TrainingConfigCreate
  ): Promise<TrainingConfigResponse> => {
    const response = await axios.post<TrainingConfigResponse>(
      `${API_BASE_URL}/api/config/create`,
      config
    );
    return response.data;
  },

  /**
   * Get configuration by ID
   * @param configId - UUID of the configuration
   */
  getConfig: async (configId: string): Promise<TrainingConfigResponse> => {
    const response = await axios.get<TrainingConfigResponse>(
      `${API_BASE_URL}/api/config/config/${configId}`
    );
    return response.data;
  },

  /**
   * Delete configuration
   * @param configId - UUID of the configuration
   */
  deleteConfig: async (configId: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/api/config/config/${configId}`);
  },
};
