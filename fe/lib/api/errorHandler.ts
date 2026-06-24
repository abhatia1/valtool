import { AxiosError } from 'axios';

export const handleApiError = (error: unknown): string => {
  if (error instanceof AxiosError) {
    if (error.response) {
      // Server responded with error
      const detail = error.response.data?.detail || error.response.statusText;
      return typeof detail === 'string' ? detail : JSON.stringify(detail);
    } else if (error.request) {
      // Request made but no response
      return 'No response from server. Please check your connection.';
    }
  }
  return 'An unexpected error occurred.';
};
