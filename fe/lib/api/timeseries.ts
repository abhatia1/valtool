// fe/lib/api/timeseries.ts

import {
  StationarityTestResponse,
  DecompositionResponse,
  TimeSeriesTrainingResults,
  TimeSeriesConfig
} from '@/types/timeseries';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const timeseriesApi = {
  /**
   * Get stationarity test results
   */
  async getStationarityTest(
    datasetId: string,
    targetColumn: string,
    dateColumn?: string
  ): Promise<StationarityTestResponse> {
    const params = new URLSearchParams({
      target_column: targetColumn,
      ...(dateColumn && { date_column: dateColumn })
    });

    const response = await fetch(
      `${API_BASE}/api/eda/timeseries/stationarity/${datasetId}?${params}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      throw new Error(`Stationarity test failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get seasonal decomposition
   */
  async getSeasonalDecomposition(
    datasetId: string,
    targetColumn: string,
    options?: {
      dateColumn?: string;
      model?: 'additive' | 'multiplicative';
      period?: number;
    }
  ): Promise<DecompositionResponse> {
    const params = new URLSearchParams({
      target_column: targetColumn,
      ...(options?.dateColumn && { date_column: options.dateColumn }),
      ...(options?.model && { model: options.model }),
      ...(options?.period && { period: options.period.toString() })
    });

    const response = await fetch(
      `${API_BASE}/api/eda/timeseries/decompose/${datasetId}?${params}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      throw new Error(`Decomposition failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Create time series configuration
   */
  async createConfig(config: TimeSeriesConfig): Promise<{ config_id: string }> {
    const response = await fetch(`${API_BASE}/api/config/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });

    if (!response.ok) {
      throw new Error(`Config creation failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Start time series training job
   */
  async startTraining(configId: string): Promise<{ job_id: string }> {
    const response = await fetch(`${API_BASE}/api/training/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_id: configId })
    });

    if (!response.ok) {
      throw new Error(`Training start failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get training results
   */
  async getResults(jobId: string): Promise<TimeSeriesTrainingResults> {
    const response = await fetch(`${API_BASE}/api/training/job/${jobId}/results`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to get results: ${response.statusText}`);
    }

    return response.json();
  }
};
