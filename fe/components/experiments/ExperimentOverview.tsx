'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Clock,
  FlaskConical,
  Archive,
  Calendar,
  TestTube,
  Activity,
} from 'lucide-react';
import type { ExperimentResponse } from '@/types/experiment';

interface ExperimentOverviewProps {
  experiment: ExperimentResponse;
  onRefresh: () => void;
  onNavigateToTab: (tab: string) => void;
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatMetricValue(value: number | undefined, metricName: string | undefined): string {
  if (value === undefined || value === null) return '-';

  const percentageMetrics = ['accuracy', 'precision', 'recall', 'f1', 'f1_score', 'roc_auc', 'r2'];
  const isPercentage = metricName && percentageMetrics.some(m => metricName.toLowerCase().includes(m));

  if (isPercentage && value <= 1) {
    return `${(value * 100).toFixed(1)}%`;
  }

  return value.toFixed(4);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExperimentOverview({
  experiment,
  onNavigateToTab,
}: ExperimentOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Best Model Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Best Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {experiment.best_model_name ? (
              <>
                <p className="text-xl font-bold text-slate-900">{experiment.best_model_name}</p>
                {experiment.best_metric_name && (
                  <p className="text-sm text-slate-500">
                    {experiment.best_metric_name}: {formatMetricValue(experiment.best_metric_value, experiment.best_metric_name)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-slate-400 italic">No models trained yet</p>
            )}
          </CardContent>
        </Card>

        {/* Training Duration Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Training Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-slate-900">
              {formatDuration(experiment.training_duration_seconds)}
            </p>
            <p className="text-sm text-slate-500">
              Total training duration
            </p>
          </CardContent>
        </Card>

        {/* Models Trained Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-purple-500" />
              Models Trained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-slate-900">{experiment.total_models_trained}</p>
            <p className="text-sm text-slate-500">
              Models evaluated
            </p>
          </CardContent>
        </Card>

        {/* Models Saved Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Archive className="h-4 w-4 text-green-500" />
              Models Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-slate-900">{experiment.models_saved_for_benchmarking}</p>
            <p className="text-sm text-slate-500">
              Ready for benchmarking
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500">Created</p>
              <p className="font-medium">{formatDate(experiment.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Last Updated</p>
              <p className="font-medium">{formatDate(experiment.updated_at)}</p>
            </div>
            {experiment.completed_at && (
              <div>
                <p className="text-sm text-slate-500">Completed</p>
                <p className="font-medium">{formatDate(experiment.completed_at)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {experiment.training_job_id ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => onNavigateToTab('models')}
                >
                  <FlaskConical className="h-4 w-4 mr-2" />
                  View Models
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onNavigateToTab('benchmarking')}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Run Benchmark Test
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onNavigateToTab('monitoring')}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Upload Monitoring Data
                </Button>
              </>
            ) : (
              <div className="text-slate-500">
                Complete training to enable model actions.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
