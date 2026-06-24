"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowUp, ArrowDown } from "lucide-react";
import type { BenchmarkModelResult } from "@/types/benchmarking";

interface BenchmarkMetricsTableProps {
  platformModels: BenchmarkModelResult[];
  externalModels: BenchmarkModelResult[];
  taskType: "classification" | "regression";
  bestOverallId: string;
}

// Metric config type
type MetricConfig = {
  key: string;
  label: string;
  higherIsBetter: boolean;
  format: "percent" | "decimal";
};

// Define metrics for each task type
const CLASSIFICATION_METRICS: MetricConfig[] = [
  { key: "accuracy", label: "Accuracy", higherIsBetter: true, format: "percent" },
  { key: "f1", label: "F1 Score", higherIsBetter: true, format: "percent" },
  { key: "precision", label: "Precision", higherIsBetter: true, format: "percent" },
  { key: "recall", label: "Recall", higherIsBetter: true, format: "percent" },
  { key: "roc_auc", label: "ROC AUC", higherIsBetter: true, format: "percent" },
];

const REGRESSION_METRICS: MetricConfig[] = [
  { key: "r2", label: "R²", higherIsBetter: true, format: "percent" },
  { key: "rmse", label: "RMSE", higherIsBetter: false, format: "decimal" },
  { key: "mae", label: "MAE", higherIsBetter: false, format: "decimal" },
  { key: "mape", label: "MAPE", higherIsBetter: false, format: "percent" },
  { key: "adjusted_r2", label: "Adj. R²", higherIsBetter: true, format: "percent" },
];

export function BenchmarkMetricsTable({
  platformModels,
  externalModels,
  taskType,
  bestOverallId,
}: BenchmarkMetricsTableProps) {
  // Get metrics configuration based on task type
  const metrics = taskType === "classification" ? CLASSIFICATION_METRICS : REGRESSION_METRICS;

  // Combine all models
  const allModels = useMemo(
    () => [...platformModels, ...externalModels],
    [platformModels, externalModels]
  );

  // Find best value for each metric
  const bestValues = useMemo(() => {
    const best: Record<string, { value: number; modelId: string }> = {};

    metrics.forEach(({ key, higherIsBetter }) => {
      let bestValue: number | null = null;
      let bestModelId = "";

      allModels.forEach((model) => {
        const value = model.metrics[key];
        if (value !== undefined) {
          if (
            bestValue === null ||
            (higherIsBetter ? value > bestValue : value < bestValue)
          ) {
            bestValue = value;
            bestModelId = model.model_id;
          }
        }
      });

      if (bestValue !== null) {
        best[key] = { value: bestValue, modelId: bestModelId };
      }
    });

    return best;
  }, [allModels, metrics]);

  // Format metric value
  const formatValue = (
    value: number | undefined,
    format: "percent" | "decimal"
  ): string => {
    if (value === undefined || value === null) return "—";
    if (format === "percent") {
      return (value * 100).toFixed(2) + "%";
    }
    return value.toFixed(4);
  };

  // Get cell styling based on whether this is the best value
  const getCellStyle = (
    metricKey: string,
    modelId: string,
    value: number | undefined
  ): string => {
    if (value === undefined) return "text-slate-400";

    const best = bestValues[metricKey];
    if (best && best.modelId === modelId) {
      return "text-emerald-600 font-semibold bg-emerald-50";
    }
    return "text-slate-700";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-[200px]">Model</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            {metrics.map(({ key, label, higherIsBetter }) => (
              <TableHead key={key} className="text-center min-w-[100px]">
                <div className="flex items-center justify-center gap-1">
                  {label}
                  {higherIsBetter ? (
                    <ArrowUp className="h-3 w-3 text-slate-400" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-slate-400" />
                  )}
                </div>
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[100px]">
              Inference Time
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Platform Models Section */}
          {platformModels.length > 0 && (
            <>
              <TableRow className="bg-blue-50/50">
                <TableCell
                  colSpan={metrics.length + 3}
                  className="py-2 font-medium text-blue-700"
                >
                  Platform Models ({platformModels.length})
                </TableCell>
              </TableRow>
              {platformModels.map((model) => (
                <ModelRow
                  key={model.model_id}
                  model={model}
                  metrics={metrics}
                  bestOverallId={bestOverallId}
                  formatValue={formatValue}
                  getCellStyle={getCellStyle}
                />
              ))}
            </>
          )}

          {/* External Models Section */}
          {externalModels.length > 0 && (
            <>
              <TableRow className="bg-amber-50/50">
                <TableCell
                  colSpan={metrics.length + 3}
                  className="py-2 font-medium text-amber-700"
                >
                  External Models ({externalModels.length})
                </TableCell>
              </TableRow>
              {externalModels.map((model) => (
                <ModelRow
                  key={model.model_id}
                  model={model}
                  metrics={metrics}
                  bestOverallId={bestOverallId}
                  formatValue={formatValue}
                  getCellStyle={getCellStyle}
                />
              ))}
            </>
          )}
        </TableBody>
      </Table>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
          <span>Best in category</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowUp className="h-3 w-3" />
          <span>Higher is better</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowDown className="h-3 w-3" />
          <span>Lower is better</span>
        </div>
      </div>
    </div>
  );
}

// Individual Model Row Component
function ModelRow({
  model,
  metrics,
  bestOverallId,
  formatValue,
  getCellStyle,
}: {
  model: BenchmarkModelResult;
  metrics: MetricConfig[];
  bestOverallId: string;
  formatValue: (value: number | undefined, format: "percent" | "decimal") => string;
  getCellStyle: (
    metricKey: string,
    modelId: string,
    value: number | undefined
  ) => string;
}) {
  const isBestOverall = model.model_id === bestOverallId;

  return (
    <TableRow
      className={isBestOverall ? "bg-emerald-50/30" : "hover:bg-slate-50"}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {isBestOverall && (
            <Trophy className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">
              {model.model_name}
            </div>
            {model.estimator_name && (
              <div className="text-xs text-slate-500 truncate">
                {model.estimator_name}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          className={
            model.model_type === "platform" ? "bg-blue-500" : "bg-amber-500"
          }
        >
          {model.model_type === "platform" ? "Platform" : "External"}
        </Badge>
      </TableCell>
      {metrics.map(({ key, format }) => (
        <TableCell
          key={key}
          className={`text-center ${getCellStyle(
            key,
            model.model_id,
            model.metrics[key]
          )}`}
        >
          {formatValue(model.metrics[key], format)}
        </TableCell>
      ))}
      <TableCell className="text-center text-slate-600">
        {model.inference_time_ms.toFixed(1)}ms
      </TableCell>
    </TableRow>
  );
}
