"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  Award,
  Zap,
  CheckCircle,
  FlaskConical,
} from "lucide-react";
import { useState } from "react";
import type { TrainingResults as TrainingResultsType } from "@/types/training";

interface TrainingResultsProps {
  results: TrainingResultsType;
}

type MetricSet = 'val' | 'train';

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

export function TrainingResults({ results }: TrainingResultsProps) {
  // Default to 'val' if available, otherwise 'train'
  const [activeMetricSet, setActiveMetricSet] = useState<MetricSet>(
    results.best_model.val_metrics ? 'val' : 'train'
  );

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(
      (seconds % 3600) / 60
    )}m`;
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;

  // Get the appropriate metrics based on toggle
  const displayMetrics =
    activeMetricSet === 'val' ? results.best_model.val_metrics :
    results.best_model.train_metrics;

  // Check what metric sets are available
  const hasValMetrics = !!results.best_model.val_metrics;
  const hasTrainMetrics = !!results.best_model.train_metrics;
  const isCrossValidation = results.best_model.validation_strategy === 'cross_validation';

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
                Training Completed Successfully!
              </h2>
              <p className="text-slate-600 mt-1">
                {results.job_name} - {results.task_type} task
              </p>
            </div>
            <Badge className="bg-blue-600 text-white px-4 py-2 text-sm training-mono">
              Job ID: {results.job_id.slice(0, 8)}...
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Best Model Highlight */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-amber-50/50 to-yellow-50/30 pb-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-amber-600" strokeWidth={2} />
            <CardTitle className="text-2xl training-heading text-amber-900">Best Model</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-gradient-to-br from-amber-50/60 to-yellow-50/40 rounded-lg p-6 border border-amber-200/60">
            <div className="flex items-center gap-3 mb-4">
              <Award className="h-8 w-8 text-amber-600" strokeWidth={2} />
              <div>
                <div className="text-3xl font-bold training-heading text-amber-900">
                  {results.best_model.estimator_name}
                </div>
                <div className="text-sm text-amber-700 training-mono mt-1">
                  ID: {results.best_model.estimator_id}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/60 rounded-lg p-3 border border-blue-200/60">
                <div className="text-xs text-blue-700 font-medium">Validation Score</div>
                <div className="text-xl font-bold text-blue-900 training-mono">
                  {results.best_model.validation_score.toFixed(4)}
                  {results.best_model.validation_std && (
                    <span className="text-sm text-blue-600 ml-1">
                      ± {results.best_model.validation_std.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/60 rounded-lg p-3 border border-purple-200/60">
                <div className="text-xs text-purple-700 font-medium">Strategy</div>
                <div className="text-sm font-bold text-purple-900 training-mono pt-1">
                  {results.best_model.validation_strategy === 'cross_validation' ? 'Cross-Validation' : 'Train-Test Split'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Leaderboard */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-purple-50/30 pb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-indigo-600" strokeWidth={2} />
            <CardTitle className="text-2xl training-heading text-indigo-900">
              Model Leaderboard
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
                    {isCrossValidation ? 'CV Score' : 'Validation Score'}
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Accuracy</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">F1 Weighted</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">F1 Macro</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Precision</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Recall</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Training Time</th>
                </tr>
              </thead>
              <tbody>
                {results.all_models
                  .sort((a, b) => b.validation_score - a.validation_score)
                  .map((model, index) => {
                    // Backend's _extract_clean_metrics already provides clean metrics
                    // (accuracy, f1_weighted, precision_weighted, etc.) without prefixes
                    const modelMetrics = model.metrics as Record<string, number>;

                    const isTopModel = index === 0;

                    return (
                      <tr
                        key={model.estimator_name}
                        className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                          isTopModel ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-4 px-4">
                          {isTopModel ? (
                            <div className="flex items-center gap-2">
                              <Trophy className="h-5 w-5 text-amber-600" />
                              <span className="font-bold text-amber-900 training-mono">#{index + 1}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 training-mono">#{index + 1}</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-900">
                            {model.estimator_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="training-mono font-bold text-slate-900">
                            {model.validation_score.toFixed(4)}
                          </div>
                          {isCrossValidation && model.validation_std > 0 && (
                            <div className="text-xs text-slate-600 training-mono">
                              ± {model.validation_std.toFixed(4)}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center training-mono text-slate-700">
                          {modelMetrics.accuracy !== undefined ? formatPercentage(modelMetrics.accuracy) : '-'}
                        </td>
                        <td className="py-4 px-4 text-center training-mono text-slate-700">
                          {modelMetrics.f1_weighted !== undefined ? modelMetrics.f1_weighted.toFixed(4) : '-'}
                        </td>
                        <td className="py-4 px-4 text-center training-mono text-slate-700">
                          {modelMetrics.f1_macro !== undefined ? modelMetrics.f1_macro.toFixed(4) : '-'}
                        </td>
                        <td className="py-4 px-4 text-center training-mono text-slate-700">
                          {modelMetrics.precision_weighted !== undefined ? modelMetrics.precision_weighted.toFixed(4) : '-'}
                        </td>
                        <td className="py-4 px-4 text-center training-mono text-slate-700">
                          {modelMetrics.recall_weighted !== undefined ? modelMetrics.recall_weighted.toFixed(4) : '-'}
                        </td>
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

      {/* Best Model Performance Metrics */}
      {(hasValMetrics || hasTrainMetrics) && (
        <Card className="training-card rounded-xl shadow-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50/50 to-slate-50/30 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg training-heading">Best Model Performance Metrics</CardTitle>
              <div className="flex gap-2">
                {hasValMetrics && (
                  <Button
                    variant={activeMetricSet === 'val' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveMetricSet('val')}
                  >
                    Validation
                  </Button>
                )}
                {hasTrainMetrics && (
                  <Button
                    variant={activeMetricSet === 'train' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveMetricSet('train')}
                  >
                    Training
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {displayMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={Target}
                  label="Accuracy"
                  value={formatPercentage(displayMetrics.accuracy || 0)}
                  color="from-blue-500/10 to-cyan-500/10 text-blue-900"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="F1 Score (Weighted)"
                  value={(displayMetrics.f1_weighted || 0).toFixed(4)}
                  color="from-purple-500/10 to-pink-500/10 text-purple-900"
                />
                <MetricCard
                  icon={Zap}
                  label="Precision (Weighted)"
                  value={(displayMetrics.precision_weighted || 0).toFixed(4)}
                  color="from-green-500/10 to-emerald-500/10 text-green-900"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Recall (Weighted)"
                  value={(displayMetrics.recall_weighted || 0).toFixed(4)}
                  color="from-orange-500/10 to-red-500/10 text-orange-900"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Metrics */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-slate-50/30">
          <CardTitle className="text-xl training-heading">Additional Metrics</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {displayMetrics && (
              <>
                <div className="bg-slate-50/80 rounded-lg p-4 border border-slate-200/60">
                  <div className="text-sm text-slate-600 mb-1">Cohen's Kappa</div>
                  <div className="text-xl font-bold text-slate-900 training-mono">
                    {(displayMetrics.cohen_kappa || 0).toFixed(4)}
                  </div>
                </div>
                <div className="bg-slate-50/80 rounded-lg p-4 border border-slate-200/60">
                  <div className="text-sm text-slate-600 mb-1">Matthews Corr</div>
                  <div className="text-xl font-bold text-slate-900 training-mono">
                    {(displayMetrics.matthews_corrcoef || 0).toFixed(4)}
                  </div>
                </div>
              </>
            )}
            {displayMetrics?.roc_auc && (
              <div className="bg-slate-50/80 rounded-lg p-4 border border-slate-200/60">
                <div className="text-sm text-slate-600 mb-1">ROC AUC</div>
                <div className="text-xl font-bold text-slate-900 training-mono">
                  {displayMetrics?.roc_auc.toFixed(4)}
                </div>
              </div>
            )}
            {displayMetrics?.roc_auc_ovr && (
              <div className="bg-slate-50/80 rounded-lg p-4 border border-slate-200/60">
                <div className="text-sm text-slate-600 mb-1">ROC AUC (OvR)</div>
                <div className="text-xl font-bold text-slate-900 training-mono">
                  {displayMetrics?.roc_auc_ovr.toFixed(4)}
                </div>
              </div>
            )}
            {displayMetrics?.roc_auc_ovo && (
              <div className="bg-slate-50/80 rounded-lg p-4 border border-slate-200/60">
                <div className="text-sm text-slate-600 mb-1">ROC AUC (OvO)</div>
                <div className="text-xl font-bold text-slate-900 training-mono">
                  {displayMetrics?.roc_auc_ovo.toFixed(4)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Training Summary */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-slate-50/30">
          <CardTitle className="text-xl training-heading">Training Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/60 rounded-lg p-5 border border-blue-200/60">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-blue-600" strokeWidth={2} />
                <div className="text-sm text-blue-700 font-medium">
                  Models Trained
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-900 training-mono">
                {results.training_summary.total_models_trained}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/60 rounded-lg p-5 border border-green-200/60">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-green-600" strokeWidth={2} />
                <div className="text-sm text-green-700 font-medium">
                  Best CV Score
                </div>
              </div>
              <div className="text-3xl font-bold text-green-900 training-mono">
                {results.training_summary.best_validation_score.toFixed(4)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/60 rounded-lg p-5 border border-purple-200/60">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-purple-600" strokeWidth={2} />
                <div className="text-sm text-purple-700 font-medium">
                  Total Duration
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-900 training-mono">
                {formatTime(results.training_summary.training_duration)}
              </div>
            </div>
          </div>

          {results.mlflow_run_id && (
            <div className="mt-4 bg-slate-50/80 rounded-lg p-4 border border-slate-200/60">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600 mb-1">MLflow Run ID</div>
                  <div className="training-mono text-sm text-slate-900">
                    {results.mlflow_run_id}
                  </div>
                </div>
                <Link href={`/experiments?run_id=${results.mlflow_run_id}`}>
                  <Button variant="outline" size="sm">
                    <FlaskConical className="h-4 w-4 mr-2" />
                    View Experiment
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
