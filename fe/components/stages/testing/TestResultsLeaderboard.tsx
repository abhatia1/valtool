"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  CheckCircle,
  AlertTriangle,
  FlaskConical,
  Zap,
  BarChart3,
  Package,
  Trash2,
  Loader2,
  HardDrive,
  CheckSquare,
} from "lucide-react";
import { useState, useCallback } from "react";
import type { MultiModelTestResultsResponse, FinalizeModelResponse } from "@/types/testing";
import { TestVisualizationGrid } from "./TestVisualizationGrid";
import { TestingAPI } from "@/lib/api/testing";

interface TestResultsLeaderboardProps {
  results: MultiModelTestResultsResponse;
  jobId: string;
  onFinalized?: (response: FinalizeModelResponse) => void;
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  color: string;
}

function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-lg p-6 border border-slate-200/60 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <Icon className="h-8 w-8 opacity-80" strokeWidth={2} />
      </div>
      <div className="text-sm font-medium opacity-90 mb-1">{label}</div>
      <div className="text-3xl font-bold training-mono">{value}</div>
    </div>
  );
}

function GeneralizationIndicator({ gap }: { gap: number }) {
  const absGap = Math.abs(gap);

  if (absGap < 0.02) {
    return (
      <div className="flex items-center gap-1 text-green-600" title="Good generalization">
        <Minus className="h-4 w-4" />
        <span className="text-xs">Stable</span>
      </div>
    );
  } else if (gap > 0.05) {
    return (
      <div className="flex items-center gap-1 text-red-600" title="Potential overfitting">
        <TrendingDown className="h-4 w-4" />
        <span className="text-xs">-{(gap * 100).toFixed(1)}%</span>
      </div>
    );
  } else if (gap > 0) {
    return (
      <div className="flex items-center gap-1 text-amber-600" title="Slight overfitting">
        <TrendingDown className="h-4 w-4" />
        <span className="text-xs">-{(gap * 100).toFixed(1)}%</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-1 text-green-600" title="Excellent generalization">
        <TrendingUp className="h-4 w-4" />
        <span className="text-xs">+{(absGap * 100).toFixed(1)}%</span>
      </div>
    );
  }
}

export function TestResultsLeaderboard({ results, jobId, onFinalized }: TestResultsLeaderboardProps) {
  const [activeMetricSet, setActiveMetricSet] = useState<'test' | 'validation'>('test');
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set([results.best_test_model.estimator_name]));
  const [primaryModel, setPrimaryModel] = useState<string>(results.best_test_model.estimator_name);
  const [isFinalizingLoading, setIsFinalizingLoading] = useState(false);
  const [finalizationResult, setFinalizationResult] = useState<FinalizeModelResponse | null>(null);
  const [finalizationError, setFinalizationError] = useState<string | null>(null);

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(
      (seconds % 3600) / 60
    )}m`;
  };

  const isClassification = results.task_type === "classification";
  const primaryMetric = isClassification ? "accuracy" : "r2";

  // Check if best test model differs from best validation model
  const bestTestDiffersFromValidation =
    results.best_test_model.estimator_name !== results.best_validation_model.estimator_name;

  // Get metrics for the best test model
  const bestTestMetrics = results.best_test_model.test_metrics;

  const toggleModelSelection = useCallback((modelName: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(modelName)) {
        next.delete(modelName);
        // If we deselected the primary model, set a new primary
        if (primaryModel === modelName && next.size > 0) {
          setPrimaryModel(Array.from(next)[0]);
        }
      } else {
        next.add(modelName);
      }
      return next;
    });
  }, [primaryModel]);

  const selectAllModels = useCallback(() => {
    setSelectedModels(new Set(results.all_models.map(m => m.estimator_name)));
  }, [results.all_models]);

  const deselectAllModels = useCallback(() => {
    setSelectedModels(new Set());
    setPrimaryModel("");
  }, []);

  const handleFinalize = useCallback(async () => {
    if (selectedModels.size === 0) {
      setFinalizationError("Please select at least one model to keep.");
      return;
    }

    setIsFinalizingLoading(true);
    setFinalizationError(null);

    try {
      const response = await TestingAPI.finalizeModels({
        job_id: jobId,
        selected_models: Array.from(selectedModels),
        primary_model: primaryModel || Array.from(selectedModels)[0],
      });

      setFinalizationResult(response);
      if (onFinalized) {
        onFinalized(response);
      }
    } catch (error) {
      setFinalizationError(error instanceof Error ? error.message : "Failed to finalize models");
    } finally {
      setIsFinalizingLoading(false);
    }
  }, [selectedModels, primaryModel, jobId, onFinalized]);

  // If already finalized, show success state
  if (finalizationResult) {
    return (
      <div className="space-y-6">
        <Card className="training-card rounded-xl shadow-sm border-green-200 bg-green-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-500 rounded-full p-3">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl training-heading text-green-900">
                  Models Finalized for Benchmarking!
                </h2>
                <p className="text-green-700 mt-1">
                  {finalizationResult.message}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Primary Model</span>
                </div>
                <div className="text-lg font-bold text-green-900">
                  {finalizationResult.primary_model.estimator_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
                <div className="text-sm text-green-600 mt-1">
                  {finalizationResult.primary_model.file_size_mb.toFixed(2)} MB
                </div>
              </div>

              <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckSquare className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Models Kept</span>
                </div>
                <div className="text-lg font-bold text-green-900">
                  {finalizationResult.kept_models.length}
                </div>
                <div className="text-sm text-green-600 mt-1">
                  {finalizationResult.kept_models.slice(0, 3).map(m => m.replace(/_/g, ' ')).join(', ')}
                  {finalizationResult.kept_models.length > 3 && ` +${finalizationResult.kept_models.length - 3} more`}
                </div>
              </div>

              <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Storage Saved</span>
                </div>
                <div className="text-lg font-bold text-green-900">
                  {finalizationResult.space_saved_mb.toFixed(1)} MB
                </div>
                <div className="text-sm text-green-600 mt-1">
                  {finalizationResult.models_deleted} model(s) deleted
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-500 rounded-full p-3">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl training-heading text-slate-900">
                Multi-Model Testing Complete!
              </h2>
              <p className="text-slate-600 mt-1">
                Evaluated {results.all_models.length} models on {results.sample_count.toLocaleString()} out-of-sample test records
              </p>
            </div>
            <Badge className="bg-blue-600 text-white px-4 py-2 text-sm training-mono">
              Test Run: {results.test_run_id.slice(0, 8)}...
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Best Test Model vs Best Validation Model Alert */}
      {bestTestDiffersFromValidation && (
        <Card className="training-card rounded-xl shadow-sm border-amber-200 bg-amber-50/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 rounded-full p-3">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-900">
                  Best Model Changed on Test Data
                </h3>
                <p className="text-amber-700 mt-1">
                  The best model on test data (<strong>{results.best_test_model.estimator_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>)
                  differs from the best model during validation (<strong>{results.best_validation_model.estimator_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>).
                  This may indicate overfitting in the validation-best model.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Test Model Highlight */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-green-50/30 pb-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-emerald-600" strokeWidth={2} />
            <CardTitle className="text-2xl training-heading text-emerald-900">Best Model on Test Data</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-gradient-to-br from-emerald-50/60 to-green-50/40 rounded-lg p-6 border border-emerald-200/60">
            <div className="flex items-center gap-3 mb-4">
              <Award className="h-8 w-8 text-emerald-600" strokeWidth={2} />
              <div>
                <div className="text-3xl font-bold training-heading text-emerald-900">
                  {results.best_test_model.estimator_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/60 rounded-lg p-3 border border-blue-200/60">
                <div className="text-xs text-blue-700 font-medium">Test {isClassification ? 'Accuracy' : 'R²'}</div>
                <div className="text-xl font-bold text-blue-900 training-mono">
                  {formatPercentage(bestTestMetrics[primaryMetric] as number || 0)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/60 rounded-lg p-3 border border-purple-200/60">
                <div className="text-xs text-purple-700 font-medium">Validation Score</div>
                <div className="text-xl font-bold text-purple-900 training-mono">
                  {results.best_test_model.validation_score.toFixed(4)}
                  {results.best_test_model.validation_std > 0 && (
                    <span className="text-sm text-purple-600 ml-1">
                      ± {results.best_test_model.validation_std.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Finalization Section */}
      <Card className="training-card rounded-xl shadow-sm border-indigo-200">
        <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-violet-50/30 pb-4">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-indigo-600" strokeWidth={2} />
            <CardTitle className="text-2xl training-heading text-indigo-900">
              Finalize Models for Benchmarking
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-slate-600 mb-4">
            Select the models you want to keep for benchmarking. Unselected models will be deleted to save storage space.
            The primary model will be used as the main model for inference.
          </p>

          {finalizationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <span>{finalizationError}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAllModels}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllModels}>
                Deselect All
              </Button>
            </div>
            <div className="text-sm text-slate-600">
              {selectedModels.size} of {results.all_models.length} model(s) selected
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="w-12 py-3 px-4 text-left">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-slate-700">Model</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-slate-700">
                    Test {isClassification ? 'Accuracy' : 'R²'}
                  </th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-slate-700">Primary</th>
                </tr>
              </thead>
              <tbody>
                {results.all_models.map((model, index) => {
                  const isSelected = selectedModels.has(model.estimator_name);
                  const isPrimary = primaryModel === model.estimator_name;
                  const metrics = model.test_metrics;

                  return (
                    <tr
                      key={model.estimator_name}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                        isSelected ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleModelSelection(model.estimator_name)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="h-4 w-4 text-emerald-600" />}
                          <span className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {model.estimator_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center training-mono">
                        {formatPercentage(metrics[primaryMetric] as number || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isSelected && (
                          <Button
                            variant={isPrimary ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setPrimaryModel(model.estimator_name)}
                            className={isPrimary ? "bg-indigo-600 text-white" : "text-slate-600"}
                          >
                            {isPrimary ? "Primary" : "Set as Primary"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              <Trash2 className="h-4 w-4 inline mr-1" />
              {results.all_models.length - selectedModels.size} model(s) will be deleted
            </div>
            <Button
              onClick={handleFinalize}
              disabled={selectedModels.size === 0 || isFinalizingLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isFinalizingLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finalizing...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Finalize {selectedModels.size} Model(s)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Leaderboard, Metrics, and Visualizations */}
      <Tabs defaultValue="leaderboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
          <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">

      {/* Test Performance Leaderboard */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-purple-50/30 pb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-indigo-600" strokeWidth={2} />
            <CardTitle className="text-2xl training-heading text-indigo-900">
              Test Performance Leaderboard
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Model</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">
                    Test {isClassification ? 'Accuracy' : 'R²'}
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Val Score</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Gen. Gap</th>
                  {isClassification && (
                    <>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">F1</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Precision</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Recall</th>
                    </>
                  )}
                  {!isClassification && (
                    <>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">RMSE</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">MAE</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">MAPE</th>
                    </>
                  )}
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Train Time</th>
                </tr>
              </thead>
              <tbody>
                {results.all_models.map((model, index) => {
                  const isTopModel = index === 0;
                  const wasValidationBest = model.estimator_name === results.best_validation_model.estimator_name;
                  const metrics = model.test_metrics;

                  return (
                    <tr
                      key={model.estimator_name}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                        isTopModel ? 'bg-emerald-50/30' : wasValidationBest && !isTopModel ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        {isTopModel ? (
                          <div className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-emerald-600" />
                            <span className="font-bold text-emerald-900 training-mono">#{index + 1}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 training-mono">#{index + 1}</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {model.estimator_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                          {wasValidationBest && !isTopModel && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              Val Best
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="training-mono font-bold text-slate-900">
                          {formatPercentage(metrics[primaryMetric] as number || 0)}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="training-mono text-slate-700">
                          {model.validation_score.toFixed(4)}
                        </div>
                        {model.validation_std > 0 && (
                          <div className="text-xs text-slate-500 training-mono">
                            ± {model.validation_std.toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <GeneralizationIndicator gap={model.generalization_gap} />
                      </td>
                      {isClassification && (
                        <>
                          <td className="py-4 px-4 text-center training-mono text-slate-700">
                            {metrics.f1 !== undefined ? (metrics.f1 as number).toFixed(4) : '-'}
                          </td>
                          <td className="py-4 px-4 text-center training-mono text-slate-700">
                            {metrics.precision !== undefined ? (metrics.precision as number).toFixed(4) : '-'}
                          </td>
                          <td className="py-4 px-4 text-center training-mono text-slate-700">
                            {metrics.recall !== undefined ? (metrics.recall as number).toFixed(4) : '-'}
                          </td>
                        </>
                      )}
                      {!isClassification && (
                        <>
                          <td className="py-4 px-4 text-center training-mono text-slate-700">
                            {metrics.rmse !== undefined ? (metrics.rmse as number).toFixed(4) : '-'}
                          </td>
                          <td className="py-4 px-4 text-center training-mono text-slate-700">
                            {metrics.mae !== undefined ? (metrics.mae as number).toFixed(4) : '-'}
                          </td>
                          <td className="py-4 px-4 text-center training-mono text-slate-700">
                            {metrics.mape !== undefined ? `${(metrics.mape as number).toFixed(2)}%` : '-'}
                          </td>
                        </>
                      )}
                      <td className="py-4 px-4 text-right training-mono text-slate-700">
                        {formatTime(model.training_time)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="metrics" className="mt-4 space-y-6">
      {/* Best Model Test Metrics with Toggle */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50/50 to-slate-50/30 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg training-heading">Best Test Model Performance Metrics</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={activeMetricSet === 'test' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetricSet('test')}
              >
                Test
              </Button>
              <Button
                variant={activeMetricSet === 'validation' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetricSet('validation')}
                disabled={!results.best_test_model.validation_score}
              >
                Validation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isClassification ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={Target}
                label={activeMetricSet === 'test' ? "Test Accuracy" : "Val Accuracy"}
                value={activeMetricSet === 'test'
                  ? formatPercentage(bestTestMetrics.accuracy as number || 0)
                  : formatPercentage(results.best_test_model.validation_score || 0)
                }
                color="from-blue-500/10 to-cyan-500/10 text-blue-900"
              />
              <MetricCard
                icon={TrendingUp}
                label="F1 Score (Weighted)"
                value={(bestTestMetrics.f1 as number || 0).toFixed(4)}
                color="from-purple-500/10 to-pink-500/10 text-purple-900"
              />
              <MetricCard
                icon={Zap}
                label="Precision (Weighted)"
                value={(bestTestMetrics.precision as number || 0).toFixed(4)}
                color="from-green-500/10 to-emerald-500/10 text-green-900"
              />
              <MetricCard
                icon={TrendingUp}
                label="Recall (Weighted)"
                value={(bestTestMetrics.recall as number || 0).toFixed(4)}
                color="from-orange-500/10 to-red-500/10 text-orange-900"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={Target}
                label={activeMetricSet === 'test' ? "Test R²" : "Val R²"}
                value={activeMetricSet === 'test'
                  ? (bestTestMetrics.r2 as number || 0).toFixed(4)
                  : results.best_test_model.validation_score.toFixed(4)
                }
                color="from-blue-500/10 to-cyan-500/10 text-blue-900"
              />
              <MetricCard
                icon={TrendingUp}
                label="RMSE"
                value={(bestTestMetrics.rmse as number || 0).toFixed(4)}
                color="from-purple-500/10 to-pink-500/10 text-purple-900"
              />
              <MetricCard
                icon={Target}
                label="MAE"
                value={(bestTestMetrics.mae as number || 0).toFixed(4)}
                color="from-green-500/10 to-emerald-500/10 text-green-900"
              />
              <MetricCard
                icon={TrendingUp}
                label="MAPE"
                value={`${(bestTestMetrics.mape as number || 0).toFixed(2)}%`}
                color="from-orange-500/10 to-red-500/10 text-orange-900"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Summary */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-slate-50/30">
          <CardTitle className="text-xl training-heading">Test Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/60 rounded-lg p-5 border border-blue-200/60">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-blue-600" strokeWidth={2} />
                <div className="text-sm text-blue-700 font-medium">
                  Models Tested
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-900 training-mono">
                {results.all_models.length}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/60 rounded-lg p-5 border border-green-200/60">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-green-600" strokeWidth={2} />
                <div className="text-sm text-green-700 font-medium">
                  Best Test {isClassification ? 'Accuracy' : 'R²'}
                </div>
              </div>
              <div className="text-3xl font-bold text-green-900 training-mono">
                {formatPercentage(bestTestMetrics[primaryMetric] as number || 0)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/60 rounded-lg p-5 border border-purple-200/60">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-5 w-5 text-purple-600" strokeWidth={2} />
                <div className="text-sm text-purple-700 font-medium">
                  Test Samples
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-900 training-mono">
                {results.sample_count.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="visualizations" className="mt-4">
          <Card className="training-card rounded-xl shadow-sm">
            <CardHeader className="bg-gradient-to-r from-violet-50/50 to-purple-50/30 pb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-violet-600" strokeWidth={2} />
                <CardTitle className="text-2xl training-heading text-violet-900">
                  Best Model Visualizations
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <TestVisualizationGrid
                testRunId={results.test_run_id}
                taskType={results.task_type}
                models={results.all_models}
                bestModelName={results.best_test_model?.estimator_name}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
