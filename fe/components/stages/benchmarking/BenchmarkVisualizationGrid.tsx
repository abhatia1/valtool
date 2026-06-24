"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, BarChart3, LineChart, Grid3X3, Timer } from "lucide-react";

// Dynamic import to avoid SSR issues with Plotly
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface BenchmarkVisualizationGridProps {
  visualizations: Record<string, string>;
  taskType: "classification" | "regression";
}

// Define visualization metadata for each task type
const CLASSIFICATION_VISUALIZATIONS = [
  {
    key: "metrics_comparison",
    label: "Metrics Comparison",
    icon: BarChart3,
    description: "Side-by-side comparison of accuracy, F1, precision, and recall",
  },
  {
    key: "roc_curve",
    label: "ROC Curves",
    icon: LineChart,
    description: "Receiver Operating Characteristic curves for all models",
  },
  {
    key: "pr_curve",
    label: "PR Curves",
    icon: LineChart,
    description: "Precision-Recall curves comparing model performance",
  },
  {
    key: "confusion_matrix",
    label: "Confusion Matrices",
    icon: Grid3X3,
    description: "Confusion matrices for each evaluated model",
  },
  {
    key: "inference_time",
    label: "Inference Time",
    icon: Timer,
    description: "Model speed comparison for batch predictions",
  },
];

const REGRESSION_VISUALIZATIONS = [
  {
    key: "metrics_comparison",
    label: "Metrics Comparison",
    icon: BarChart3,
    description: "Side-by-side comparison of R², RMSE, MAE, and MAPE",
  },
  {
    key: "predicted_vs_actual",
    label: "Predicted vs Actual",
    icon: LineChart,
    description: "Scatter plot comparing predictions to ground truth",
  },
  {
    key: "residual_distribution",
    label: "Residual Distribution",
    icon: BarChart3,
    description: "Distribution of prediction errors for each model",
  },
  {
    key: "inference_time",
    label: "Inference Time",
    icon: Timer,
    description: "Model speed comparison for batch predictions",
  },
];

export function BenchmarkVisualizationGrid({
  visualizations,
  taskType,
}: BenchmarkVisualizationGridProps) {
  const vizConfigs =
    taskType === "classification"
      ? CLASSIFICATION_VISUALIZATIONS
      : REGRESSION_VISUALIZATIONS;

  // Filter to only show visualizations that exist
  const availableVizConfigs = useMemo(
    () => vizConfigs.filter((viz) => visualizations[viz.key]),
    [vizConfigs, visualizations]
  );

  const [activeViz, setActiveViz] = useState(
    availableVizConfigs[0]?.key || "metrics_comparison"
  );

  if (Object.keys(visualizations).length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No visualizations available for this benchmark.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visualization Selector */}
      <Tabs value={activeViz} onValueChange={setActiveViz}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
          {availableVizConfigs.map((viz) => {
            const Icon = viz.icon;
            return (
              <TabsTrigger
                key={viz.key}
                value={viz.key}
                className="flex items-center gap-2 px-4 py-2"
              >
                <Icon className="h-4 w-4" />
                {viz.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Visualization Content */}
        {availableVizConfigs.map((viz) => (
          <TabsContent key={viz.key} value={viz.key} className="mt-4">
            <VisualizationPanel
              title={viz.label}
              description={viz.description}
              plotlyJson={visualizations[viz.key]}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Fallback for unknown visualizations */}
      {Object.keys(visualizations)
        .filter((key) => !vizConfigs.some((v) => v.key === key))
        .map((key) => (
          <VisualizationPanel
            key={key}
            title={formatVisualizationKey(key)}
            description=""
            plotlyJson={visualizations[key]}
          />
        ))}
    </div>
  );
}

// Individual Visualization Panel
function VisualizationPanel({
  title,
  description,
  plotlyJson,
}: {
  title: string;
  description: string;
  plotlyJson: string;
}) {
  const parsedData = useMemo(() => {
    try {
      return JSON.parse(plotlyJson);
    } catch (err) {
      console.error("Failed to parse visualization JSON:", err);
      return null;
    }
  }, [plotlyJson]);

  if (!parsedData) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load visualization: Invalid data format
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="w-full">
          <Plot
            data={parsedData.data || []}
            layout={{
              ...parsedData.layout,
              autosize: true,
              margin: { t: 40, r: 20, b: 60, l: 60 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "white",
              font: { family: "Inter, sans-serif", size: 12 },
            }}
            config={{
              responsive: true,
              displayModeBar: true,
              displaylogo: false,
              modeBarButtonsToRemove: ["pan2d", "lasso2d", "select2d"],
            }}
            style={{ width: "100%", height: 500 }}
            useResizeHandler
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to format visualization keys as readable titles
function formatVisualizationKey(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
