// fe/lib/api/regression.ts
import axios from 'axios';
import type { RegressionConfig, RegressionTrainingJob, RegressionMetrics } from '@/types/regression';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const regressionApi = {
  /**
   * Create a regression training configuration
   */
  async createConfig(config: Omit<RegressionConfig, 'task_type'>): Promise<RegressionConfig & { config_id: string }> {
    const response = await axios.post(`${API_BASE}/api/config/create`, {
      ...config,
      task_type: 'regression'
    });
    return response.data;
  },

  /**
   * Start regression training
   */
  async startTraining(configId: string, jobName?: string): Promise<{ job_id: string; job_name: string; status: string }> {
    const response = await axios.post(`${API_BASE}/api/training/start`, {
      config_id: configId,
      job_name: jobName
    });
    return response.data;
  },

  /**
   * Get training job status
   */
  async getStatus(jobId: string): Promise<Pick<RegressionTrainingJob, 'job_id' | 'job_name' | 'status' | 'progress'>> {
    const response = await axios.get(`${API_BASE}/api/training/job/${jobId}/status`);
    return response.data;
  },

  /**
   * Get complete training results
   */
  async getResults(jobId: string): Promise<RegressionTrainingJob> {
    const response = await axios.get(`${API_BASE}/api/training/job/${jobId}/results`);
    return response.data;
  },

  /**
   * Get model comparison
   */
  async getComparison(jobId: string) {
    const response = await axios.get(`${API_BASE}/api/training/job/${jobId}/comparison`);
    return response.data;
  },

  /**
   * Cancel training job
   */
  async cancelJob(jobId: string): Promise<{ message: string }> {
    const response = await axios.post(`${API_BASE}/api/training/job/${jobId}/cancel`);
    return response.data;
  },

  /**
   * Delete training job
   */
  async deleteJob(jobId: string): Promise<{ message: string }> {
    const response = await axios.delete(`${API_BASE}/api/training/job/${jobId}`);
    return response.data;
  },

  /**
   * List all training jobs (filtered by regression)
   */
  async listJobs(limit = 50, offset = 0): Promise<{ jobs: RegressionTrainingJob[]; total: number }> {
    const response = await axios.get(`${API_BASE}/api/training/jobs`, {
      params: { task_type: 'regression', limit, offset }
    });
    return response.data;
  }
};
