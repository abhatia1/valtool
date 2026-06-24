"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trophy,
  Medal,
  Crown,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  Clock,
  Zap,
  BarChart3,
} from "lucide-react";
import type {
  BenchmarkComparison,
  BenchmarkModelResult,
} from "@/types/benchmarking";
import { BenchmarkMetricsTable } from "./BenchmarkMetricsTable";
import { BenchmarkVisualizationGrid } from "./BenchmarkVisualizationGrid";

interface BenchmarkComparisonViewProps {
  results: BenchmarkComparison;
  taskType: "classification" | "regression";
  onExport: (format: "pdf" | "json" | "csv") => void;
  onContinue: () => void;
}

// Color scheme for model types
const COLORS = {
  platform: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-500",
  },
  external: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-500",
  },
  best: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-700",
    badge: "bg-emerald-500",
  },
};

export function BenchmarkComparisonView({
  results,
  taskType,
  onExport,
  onContinue,
}: BenchmarkComparisonViewProps) {
  const [activeTab, setActiveTab] = useState("leaderboard");

  // Combine and sort all models by primary metric
  const leaderboard = useMemo(() => {
    const allModels = [...results.platform_models, ...results.external_models];
    const primaryMetric = taskType === "classification" ? "accuracy" : "r2";

    return allModels.sort((a, b) => {
      const aMetric = a.metrics[primaryMetric] ?? 0;
      const bMetric = b.metrics[primaryMetric] ?? 0;
      return bMetric - aMetric;
    });
  }, [results, taskType]);

  // Get primary metric name for display
  const primaryMetricName = taskType === "classification" ? "Accuracy" : "R²";
  const primaryMetricKey = taskType === "classification" ? "accuracy" : "r2";

  // Format metric value
  const formatMetric = (value: number | undefined): string => {
    if (value === undefined) return "N/A";
    return (value * 100).toFixed(2) + "%";
  };

  // Check if model is the best overall
  const isBestOverall = (model: BenchmarkModelResult): boolean => {
    return model.model_id === results.best_overall.model_id;
  };

  return (
    <div className="space-y-6">
      {/* Winner Banner */}
      <Card className={`${COLORS.best.bg} ${COLORS.best.border} border-2`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-4">
            <Trophy className="h-12 w-12 text-emerald-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">
                Best Performing Model
              </p>
              <h2 className="text-2xl font-bold text-emerald-800 mt-1">
                {results.best_overall.model_name}
              </h2>
              <div className="flex items-center justify-center gap-3 mt-2">
                <Badge
                  className={
                    results.best_overall.model_type === "platform"
                      ? COLORS.platform.badge
                      : COLORS.external.badge
                  }
                >
                  {results.best_overall.model_type === "platform"
                    ? "Platform Model"
                    : "External Model"}
                </Badge>
                <span className="text-emerald-700 font-semibold">
                  {primaryMetricName}:{" "}
                  {formatMetric(results.best_overall.metrics[primaryMetricKey])}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Best Overall */}
        <SummaryCard
          title="Best Overall"
          icon={<Trophy className="h-5 w-5 text-emerald-500" />}
          model={results.best_overall}
          metricKey={primaryMetricKey}
          metricLabel={primaryMetricName}
        />

        {/* Best Platform */}
        <SummaryCard
          title="Best Platform"
          icon={<Medal className="h-5 w-5 text-blue-500" />}
          model={results.best_platform}
          metricKey={primaryMetricKey}
          metricLabel={primaryMetricName}
          colorScheme="platform"
        />

        {/* Best External */}
        <SummaryCard
          title="Best External"
          icon={<Crown className="h-5 w-5 text-amber-500" />}
          model={results.best_external}
          metricKey={primaryMetricKey}
          metricLabel={primaryMetricName}
          colorScheme="external"
        />
      </div>

      {/* Benchmark Info */}
      <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
        <span className="flex items-center gap-1">
          <BarChart3 className="h-4 w-4" />
          {results.test_sample_count.toLocaleString()} test samples
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-4 w-4" />
          {results.platform_models.length + results.external_models.length}{" "}
          models compared
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          Completed: {new Date(results.completed_at).toLocaleString()}
        </span>
      </div>

      {/* Tabbed Content */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmark Results</CardTitle>
          <CardDescription>
            Detailed comparison of all evaluated models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
              <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard" className="mt-6">
              <div className="space-y-3">
                {leaderboard.map((model, index) => (
                  <LeaderboardRow
                    key={model.model_id}
                    rank={index + 1}
                    model={model}
                    isBest={isBestOverall(model)}
                    primaryMetricKey={primaryMetricKey}
                    taskType={taskType}
                  />
                ))}
              </div>
            </TabsContent>

            {/* Detailed Metrics Tab */}
            <TabsContent value="metrics" className="mt-6">
              <BenchmarkMetricsTable
                platformModels={results.platform_models}
                externalModels={results.external_models}
                taskType={taskType}
                bestOverallId={results.best_overall.model_id}
              />
            </TabsContent>

            {/* Visualizations Tab */}
            <TabsContent value="visualizations" className="mt-6">
              <BenchmarkVisualizationGrid
                visualizations={results.visualizations}
                taskType={taskType}
              />
            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="mt-6">
              <div className="grid grid-cols-3 gap-4">
                <ExportCard
                  title="PDF Report"
                  description="Complete benchmark report with visualizations"
                  icon={<FileText className="h-8 w-8 text-red-500" />}
                  onClick={() => onExport("pdf")}
                />
                <ExportCard
                  title="JSON Data"
                  description="Raw benchmark data for programmatic use"
                  icon={<FileJson className="h-8 w-8 text-blue-500" />}
                  onClick={() => onExport("json")}
                />
                <ExportCard
                  title="CSV Export"
                  description="Metrics spreadsheet for analysis"
                  icon={<FileSpreadsheet className="h-8 w-8 text-emerald-500" />}
                  onClick={() => onExport("csv")}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button onClick={onContinue} size="lg">
          Continue to Monitoring
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  icon,
  model,
  metricKey,
  metricLabel,
  colorScheme = "best",
}: {
  title: string;
  icon: React.ReactNode;
  model: BenchmarkModelResult;
  metricKey: string;
  metricLabel: string;
  colorScheme?: "platform" | "external" | "best";
}) {
  const colors = COLORS[colorScheme];
  const metricValue = model.metrics[metricKey];

  return (
    <Card className={`${colors.bg} ${colors.border} border`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-xs font-medium uppercase ${colors.text}`}>
              {title}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 mt-1">
              {model.model_name}
            </h3>
            {model.estimator_name && (
              <p className="text-sm text-slate-500">{model.estimator_name}</p>
            )}
          </div>
          {icon}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{metricLabel}</span>
            <span className="font-semibold text-slate-900">
              {metricValue !== undefined
                ? (metricValue * 100).toFixed(2) + "%"
                : "N/A"}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-500">Inference Time</span>
            <span className="font-medium text-slate-700">
              {model.inference_time_ms.toFixed(1)}ms
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Leaderboard Row Component
function LeaderboardRow({
  rank,
  model,
  isBest,
  primaryMetricKey,
  taskType,
}: {
  rank: number;
  model: BenchmarkModelResult;
  isBest: boolean;
  primaryMetricKey: string;
  taskType: "classification" | "regression";
}) {
  const modelColors =
    model.model_type === "platform" ? COLORS.platform : COLORS.external;

  const getRankIcon = () => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return null;
  };

  // Get relevant metrics based on task type
  const getDisplayMetrics = (): { label: string; key: string }[] => {
    if (taskType === "classification") {
      return [
        { label: "Accuracy", key: "accuracy" },
        { label: "F1", key: "f1" },
        { label: "Precision", key: "precision" },
        { label: "Recall", key: "recall" },
      ];
    } else {
      return [
        { label: "R²", key: "r2" },
        { label: "RMSE", key: "rmse" },
        { label: "MAE", key: "mae" },
        { label: "MAPE", key: "mape" },
      ];
    }
  };

  const formatMetricValue = (key: string, value: number | undefined): string => {
    if (value === undefined) return "N/A";
    // For error metrics (RMSE, MAE), show as-is; for others, show as percentage
    if (["rmse", "mae"].includes(key)) {
      return value.toFixed(4);
    }
    if (key === "mape") {
      return (value * 100).toFixed(2) + "%";
    }
    return (value * 100).toFixed(2) + "%";
  };

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border ${
        isBest
          ? `${COLORS.best.bg} ${COLORS.best.border} border-2`
          : "bg-white border-slate-200"
      }`}
    >
      {/* Rank */}
      <div className="flex items-center justify-center w-10 h-10">
        {getRankIcon() || (
          <span className="text-lg font-bold text-slate-400">#{rank}</span>
        )}
      </div>

      {/* Model Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-slate-900 truncate">
            {model.model_name}
          </h4>
          <Badge className={modelColors.badge}>
            {model.model_type === "platform" ? "Platform" : "External"}
          </Badge>
          {isBest && (
            <Badge className={COLORS.best.badge}>Best Overall</Badge>
          )}
        </div>
        {model.estimator_name && (
          <p className="text-sm text-slate-500 truncate">
            {model.estimator_name}
          </p>
        )}
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-6">
        {getDisplayMetrics().map(({ label, key }) => (
          <div key={key} className="text-center min-w-[70px]">
            <p className="text-xs text-slate-500">{label}</p>
            <p
              className={`font-semibold ${
                key === primaryMetricKey ? "text-emerald-600" : "text-slate-700"
              }`}
            >
              {formatMetricValue(key, model.metrics[key])}
            </p>
          </div>
        ))}

        {/* Inference Time */}
        <div className="text-center min-w-[70px]">
          <p className="text-xs text-slate-500">Time</p>
          <p className="font-medium text-slate-600">
            {model.inference_time_ms.toFixed(1)}ms
          </p>
        </div>
      </div>
    </div>
  );
}

// Export Card Component
function ExportCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-6 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors text-left"
    >
      <div className="flex items-start gap-4">
        {icon}
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm text-blue-600 mt-4">
        <Download className="h-4 w-4" />
        Download
      </div>
    </button>
  );
}
