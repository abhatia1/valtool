// types/eda.ts

export interface SummaryStatistics {
  [column: string]: NumericStats | CategoricalStats;
}

export interface NumericStats {
  count: number;
  null_count: number;
  null_percentage: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q25: number;
  q75: number;
  skewness: number;
  kurtosis: number;
  outliers: {
    iqr_count: number;
    iqr_percentage: number;
  };
}

export interface CategoricalStats {
  count: number;
  null_count: number;
  null_percentage: number;
  unique_values: number;
  top_value: string;
  top_value_count: number;
  cardinality_percentage: number;
}

export interface EDAGenerateRequest {
  dataset_id: string;
  analysis_types: ("univariate" | "correlation" | "bivariate" | "outliers" | "dimensionality_reduction" | "multivariate")[];
  target_column?: string;
}

export interface TargetInsights {
  column_name: string;
  missing_values: number;
  missing_percentage: number;
  target_type: "classification" | "regression";
  distribution: any;
  imbalance_analysis?: any;
}

export interface MissingDataPatterns {
  summary: {
    total_missing: number;
    total_cells: number;
    missing_percentage: number;
  };
  by_column: { [key: string]: { missing_count: number; missing_percentage: number } };
  missing_correlations: any;
}

export interface DataQualityFlags {
  constant_features: any[];
  quasi_constant_features: any[];
  highly_correlated_pairs: any[];
  mixed_type_columns: any[];
  inconsistent_categories: any[];
}

export interface FeatureEngineeringSuggestions {
  datetime_features: any[];
  binning_candidates: any[];
  normalization_candidates: any[];
}

export interface ClassImbalanceAnalysis {
  class_distribution: { [key: string]: number };
  class_percentages: { [key: string]: number };
  imbalance_metrics: any;
  recommended_weights: any;
  severity: string;
  error?: string;
}

export interface TargetLeakageDetection {
  perfect_correlations: any[];
  high_correlations: any[];
  suspicious_columns: any[];
  summary: any;
}

export interface FeatureImportance {
  method: string;
  numerical_features: { [key: string]: number };
  categorical_features: { [key: string]: number };
  top_features: Array<{ feature: string; importance: number }>;
  mutual_information: { [key: string]: number };
  task_type: "classification" | "regression";
}

export interface DetailedUnivariateAnalysis {
  numerical: {
    [key: string]: {
      mean: number;
      median: number;
      std: number;
      min: number;
      max: number;
      q1: number;
      q3: number;
      iqr: number;
      skewness: number;
      kurtosis: number;
      missing_count: number;
      missing_percentage: number;
      outliers: {
        iqr_count: number;
        iqr_percentage: number;
        zscore_count: number;
        zscore_percentage: number;
      };
      histogram: {
        counts: number[];
        bins: number[];
      };
      kde: {
        x: number[];
        y: number[];
      } | null;
      boxplot: {
        min: number;
        q1: number;
        median: number;
        q3: number;
        max: number;
        outliers: number[];
      };
    };
  };
  categorical: {
    [key: string]: {
      unique_values: number;
      cardinality: number;
      missing_count: number;
      missing_percentage: number;
      value_counts: { [key: string]: number };
      value_percentages: { [key: string]: number };
      rare_categories: Array<{
        category: string;
        count: number;
        percentage: number;
      }>;
    };
  };
}

export interface MultivariateAnalysis {
  correlation_matrix?: {
    matrix: { [key: string]: { [key: string]: number } };
    high_correlation_pairs: Array<{
      feature1: string;
      feature2: string;
      correlation: number;
    }>;
  };
  pca?: {
    explained_variance_ratio: number[];
    cumulative_variance_ratio: number[];
    components: number[][];
    feature_names: string[];
  };
}

export interface DimensionalityReductionAnalysis {
  pca: {
    n_components: number;
    explained_variance_ratio: number[];
    explained_variance: number[];
    cumulative_variance_ratio: number[];
    n_components_for_95_variance: number;
    feature_names: string[];
    components: number[][];
    component_contributions: {
      [key: string]: Array<{
        feature: string;
        loading: number;
        abs_loading: number;
      }>;
    };
  };
  tsne: {
    n_components: number;
    perplexity: number;
    kl_divergence: number;
    n_iter: number;
    coordinates: {
      tsne_1: number[];
      tsne_2: number[];
    };
    note: string;
  } | { error: string };
  dimensionality_assessment: {
    original_dimensions: number;
    intrinsic_dimensions: number;
    dimensionality_reduction_potential: number;
    variance_preserved_95: number;
  };
  recommendations: string[];
}

export interface MultivariateOutliers {
  isolation_forest?: {
    outlier_count: number;
    outlier_percentage: number;
    outlier_indices: number[];
    anomaly_scores: {
      min: number;
      max: number;
      threshold: number;
    };
  };
  local_outlier_factor?: {
    outlier_count: number;
    outlier_percentage: number;
    outlier_indices: number[];
    lof_scores: {
      min: number;
      max: number;
      threshold: number;
    };
  };
  mahalanobis?: {
    outlier_count: number;
    outlier_percentage: number;
    outlier_indices: number[];
    threshold: number;
    min_score: number;
    max_score: number;
  };
  dbscan?: {
    outlier_count: number;
    outlier_percentage: number;
    outlier_indices: number[];
    n_clusters: number;
  };
}

export interface EDAReport {
  eda_id: string;
  dataset_id: string;
  status: "completed";
  summary_statistics: SummaryStatistics;
  visualizations: {
    univariate: string[];
    bivariate: string[];
    correlation_matrix: string | null;
    outlier_detection: string[];
    dimensionality_reduction_viz: string[];
  };
  insights: string[];
  generated_at: string;
  target_column?: string;
  target_insights?: TargetInsights;
  missing_data_patterns?: MissingDataPatterns;
  data_quality_flags?: DataQualityFlags;
  feature_engineering_suggestions?: FeatureEngineeringSuggestions;
  class_imbalance_analysis?: ClassImbalanceAnalysis;
  target_leakage_detection?: TargetLeakageDetection;
  multivariate_outliers?: MultivariateOutliers;
  feature_importance?: FeatureImportance;
  detailed_univariate_analysis?: DetailedUnivariateAnalysis;
  multivariate_analysis?: MultivariateAnalysis;
  dimensionality_reduction?: DimensionalityReductionAnalysis;
}

export interface VisualizationResponse {
  plotly_json: {
    data: any[];
    layout: any;
    frames?: any[];
  };
  viz_type: string;
  title: string;
}

// Helper type guards
export function isNumericStats(
  stats: NumericStats | CategoricalStats
): stats is NumericStats {
  return "mean" in stats;
}

export function isCategoricalStats(
  stats: NumericStats | CategoricalStats
): stats is CategoricalStats {
  return "unique_values" in stats;
}
