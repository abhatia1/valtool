// lib/api/eda.ts

import axios from "axios";
import type {
  EDAGenerateRequest,
  EDAReport,
  VisualizationResponse,
} from "@/types/eda";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class EDAClient {
  /**
   * Generate a new EDA report
   */
  static async generate(request: EDAGenerateRequest): Promise<EDAReport> {
    const response = await axios.post<EDAReport>(
      `${API_BASE_URL}/api/eda/generate`,
      request
    );
    return response.data;
  }

  /**
   * Get an existing EDA report
   */
  static async getReport(edaId: string): Promise<EDAReport> {
    const response = await axios.get<EDAReport>(
      `${API_BASE_URL}/api/eda/${edaId}`
    );
    return response.data;
  }

  /**
   * Get correlation matrix visualization
   */
  static async getCorrelationMatrix(
    edaId: string
  ): Promise<VisualizationResponse> {
    const response = await axios.get<VisualizationResponse>(
      `${API_BASE_URL}/api/eda/${edaId}/visualization/correlation`
    );
    return response.data;
  }

  /**
   * Get a specific visualization
   */
  static async getVisualization(
    edaId: string,
    category: "univariate" | "bivariate" | "outlier" | "dimensionality_reduction",
    index: number
  ): Promise<VisualizationResponse> {
    const response = await axios.get<VisualizationResponse>(
      `${API_BASE_URL}/api/eda/${edaId}/visualization/${category}/${index}`
    );
    return response.data;
  }

  /**
   * Delete an EDA report
   */
  static async delete(edaId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/api/eda/${edaId}`);
  }
}
