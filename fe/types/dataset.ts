// Type definitions for dataset-related API responses

export type ColumnType = "numeric" | "categorical" | "datetime" | "text";

export interface Dataset {
  dataset_id: string;
  name: string;
  description?: string;
  file_path: string;
  rows: number;
  columns: number;
  column_names: string[];
  column_types: Record<string, ColumnType>;
  missing_values: Record<string, number>;
  uploaded_at: string;
  status: string;
}

export interface DatasetListItem {
  dataset_id: string;
  name: string;
  rows: number;
  columns: number;
  uploaded_at: string;
  status: string;
}

export interface DatasetPreview {
  dataset_id: string;
  name: string;
  rows: number;
  columns: number;
  preview_data: Record<string, any>[];
  column_info: Record<string, {
    type: ColumnType;
    missing: number;
    sample_values: any[];
  }>;
}

export interface NumericColumnStats {
  column_name: string;
  type: "numeric";
  total_count: number;
  missing_count: number;
  missing_percentage: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
  q25: number | null;
  q75: number | null;
}

export interface CategoricalColumnStats {
  column_name: string;
  type: "categorical" | "text";
  total_count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  most_common: Record<string, number>;
}

export type ColumnStats = NumericColumnStats | CategoricalColumnStats;
