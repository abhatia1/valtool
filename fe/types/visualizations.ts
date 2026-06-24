// fe/types/visualizations.ts

export type VisualizationType =
  | "confusion-matrix"
  | "roc-curves"
  | "pr-curves"
  | "feature-importance"
  | "calibration"
  | "predicted-vs-actual"
  | "residual-plot"
  | "qq-plot";

export interface PlotlyTrace {
  x?: unknown[];
  y?: unknown[];
  z?: unknown[][];
  type?: string;
  mode?: string;
  name?: string;
  marker?: Record<string, unknown>;
  line?: Record<string, unknown>;
  text?: unknown;
  hovertemplate?: string;
  [key: string]: unknown;
}

export interface PlotlyLayout {
  title?: string | { text: string; [key: string]: unknown };
  xaxis?: { title?: string; [key: string]: unknown };
  yaxis?: { title?: string; [key: string]: unknown };
  width?: number;
  height?: number;
  showlegend?: boolean;
  legend?: Record<string, unknown>;
  annotations?: unknown[];
  [key: string]: unknown;
}

export interface PlotlyJSON {
  data: PlotlyTrace[];
  layout: PlotlyLayout;
  frames?: unknown[];
  config?: {
    responsive?: boolean;
    displayModeBar?: boolean;
    displaylogo?: boolean;
    [key: string]: unknown;
  };
}

export interface VisualizationResponse {
  plotly_json: PlotlyJSON;
  viz_type: VisualizationType;
  title: string;
}

export interface VisualizationError {
  detail: string;
  status_code?: number;
}
