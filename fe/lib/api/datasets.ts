import axios from 'axios';
import type { Dataset, DatasetListItem, DatasetPreview, ColumnStats } from '@/types/dataset';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const datasetsApi = {
  // Upload dataset
  upload: async (file: File, name: string, description?: string): Promise<Dataset> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) formData.append('description', description);

    const { data } = await api.post('/api/upload/dataset', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // List datasets
  list: async (skip = 0, limit = 100): Promise<{ datasets: DatasetListItem[] }> => {
    const { data } = await api.get('/api/upload/datasets', {
      params: { skip, limit },
    });
    return data;
  },

  // Get dataset details
  getDetails: async (datasetId: string): Promise<Dataset> => {
    const { data } = await api.get(`/api/upload/dataset/${datasetId}`);
    return data;
  },

  // Preview dataset
  preview: async (datasetId: string, nRows = 10): Promise<DatasetPreview> => {
    const { data } = await api.get(`/api/upload/dataset/${datasetId}/preview`, {
      params: { n_rows: nRows },
    });
    return data;
  },

  // Get column statistics
  getColumnStats: async (datasetId: string, columnName: string): Promise<ColumnStats> => {
    const { data } = await api.get(
      `/api/upload/dataset/${datasetId}/column/${columnName}/stats`
    );
    return data;
  },

  // Delete dataset
  delete: async (datasetId: string): Promise<{ message: string; deleted_dataset_id: string }> => {
    const { data } = await api.delete(`/api/upload/dataset/${datasetId}`);
    return data;
  },
};
