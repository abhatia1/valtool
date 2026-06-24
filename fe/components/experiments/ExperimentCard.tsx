'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FlaskConical,
  TrendingUp,
  Binary,
  Clock,
  Trophy,
  Archive,
  Play,
  TestTube,
  Activity,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import type { ExperimentListItem, ExperimentStatus, TaskType } from '@/types/experiment';
import Link from 'next/link';

interface ExperimentCardProps {
  experiment: ExperimentListItem;
  onDelete?: (id: string) => void;
  onComplete?: (id: string) => void;
}

const statusConfig: Record<
  ExperimentStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }
> = {
  in_progress: { label: 'In Progress', variant: 'default', icon: Play },
  completed: { label: 'Completed', variant: 'secondary', icon: CheckCircle2 },
  archived: { label: 'Archived', variant: 'outline', icon: Archive },
};

const taskTypeConfig: Record<
  TaskType,
  { label: string; icon: React.ElementType; color: string }
> = {
  classification: { label: 'Classification', icon: Binary, color: 'text-blue-600' },
  regression: { label: 'Regression', icon: TrendingUp, color: 'text-green-600' },
  timeseries: { label: 'Time Series', icon: Clock, color: 'text-purple-600' },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatMetricValue(value: number | undefined, metricName: string | undefined): string {
  if (value === undefined || value === null) return '-';

  // Format based on metric type
  const percentageMetrics = ['accuracy', 'precision', 'recall', 'f1', 'f1_score', 'roc_auc', 'r2'];
  const isPercentage = metricName && percentageMetrics.some(m => metricName.toLowerCase().includes(m));

  if (isPercentage && value <= 1) {
    return `${(value * 100).toFixed(1)}%`;
  }

  return value.toFixed(4);
}

export function ExperimentCard({ experiment, onDelete, onComplete }: ExperimentCardProps) {
  const status = statusConfig[experiment.status];
  const taskType = taskTypeConfig[experiment.task_type];
  const StatusIcon = status.icon;
  const TaskIcon = taskType.icon;

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link
              href={`/experiments/${experiment.experiment_id}`}
              className="hover:underline"
            >
              <h3 className="font-semibold text-lg truncate" title={experiment.name}>
                {experiment.name}
              </h3>
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <TaskIcon className={`h-4 w-4 ${taskType.color}`} />
              <span className="text-sm text-slate-600">{taskType.label}</span>
            </div>
          </div>
          <Badge variant={status.variant} className="shrink-0">
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
        {experiment.description && (
          <p className="text-sm text-slate-500 line-clamp-2 mt-2">
            {experiment.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Best Model */}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>Best Model</span>
          </div>
          {experiment.best_model_name ? (
            <div>
              <p className="font-medium text-slate-900">{experiment.best_model_name}</p>
              {experiment.best_metric_name && (
                <p className="text-sm text-slate-600">
                  {experiment.best_metric_name}: {formatMetricValue(experiment.best_metric_value, experiment.best_metric_name)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No models trained yet</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-slate-600">
            <FlaskConical className="h-4 w-4" />
            <span>{experiment.total_models_trained} trained</span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <Archive className="h-4 w-4" />
            <span>{experiment.models_saved_for_benchmarking} saved</span>
          </div>
        </div>

        {/* Updated Time */}
        <div className="text-xs text-slate-400">
          Updated {formatRelativeTime(experiment.updated_at)}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t gap-2">
        {experiment.status === 'in_progress' ? (
          <>
            <Button variant="default" size="sm" className="flex-1" asChild>
              <Link href={`/experiments/${experiment.experiment_id}`}>
                <Play className="h-4 w-4 mr-1" />
                Continue
              </Link>
            </Button>
            {onComplete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onComplete(experiment.experiment_id)}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href={`/experiments/${experiment.experiment_id}?tab=benchmarking`}>
                <TestTube className="h-4 w-4 mr-1" />
                Benchmark
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href={`/experiments/${experiment.experiment_id}?tab=monitoring`}>
                <Activity className="h-4 w-4 mr-1" />
                Monitor
              </Link>
            </Button>
          </>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-red-600"
            onClick={() => onDelete(experiment.experiment_id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
