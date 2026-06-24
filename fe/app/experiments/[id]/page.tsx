'use client';

// ============================================================
// Experiment Detail Page
// Phase 5: Experiment detail view with tabs
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Trash2,
  Loader2,
  AlertCircle,
  Binary,
  TrendingUp,
  Clock,
  CheckCircle2,
  Play,
  Archive,
  LayoutDashboard,
  FlaskConical,
  TestTube,
  Activity,
} from 'lucide-react';
import { experimentsApi } from '@/lib/api/experiments';
import { ExperimentOverview } from '@/components/experiments/ExperimentOverview';
import { ExperimentModels } from '@/components/experiments/ExperimentModels';
import { TestingStage } from '@/components/stages/TestingStage';
import { MonitoringStage } from '@/components/stages/MonitoringStage';
import type { ExperimentResponse, ExperimentStatus, TaskType } from '@/types/experiment';

const statusConfig: Record<
  ExperimentStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }
> = {
  in_progress: { label: 'In Progress', variant: 'default', icon: Play },
  completed: { label: 'Completed', variant: 'secondary', icon: CheckCircle2 },
  archived: { label: 'Archived', variant: 'outline', icon: Archive },
};

const taskTypeConfig: Record<TaskType, { label: string; icon: React.ElementType }> = {
  classification: { label: 'Classification', icon: Binary },
  regression: { label: 'Regression', icon: TrendingUp },
  timeseries: { label: 'Time Series', icon: Clock },
};

export default function ExperimentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const experimentId = params.id as string;
  const initialTab = searchParams.get('tab') || 'overview';

  const [experiment, setExperiment] = useState<ExperimentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [deleting, setDeleting] = useState(false);

  const fetchExperiment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experimentsApi.get(experimentId);
      setExperiment(data);
    } catch (err) {
      console.error('Failed to fetch experiment:', err);
      setError('Failed to load experiment details.');
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    fetchExperiment();
  }, [fetchExperiment]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this experiment? This action cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      await experimentsApi.delete(experimentId);
      router.push('/experiments');
    } catch (err) {
      console.error('Failed to delete experiment:', err);
      alert('Failed to delete experiment. Please try again.');
      setDeleting(false);
    }
  };

  const handleComplete = async () => {
    try {
      await experimentsApi.complete(experimentId);
      fetchExperiment();
    } catch (err) {
      console.error('Failed to complete experiment:', err);
      alert('Failed to mark experiment as complete.');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          <span className="ml-3 text-slate-600">Loading experiment...</span>
        </div>
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-6">
          <Link href="/experiments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Experiments
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Experiment not found.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const status = statusConfig[experiment.status];
  const taskType = taskTypeConfig[experiment.task_type];
  const StatusIcon = status.icon;
  const TaskIcon = taskType.icon;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link href="/experiments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Experiments
          </Button>
        </Link>
      </div>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <FlaskConical className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{experiment.name}</h1>
              {experiment.description && (
                <p className="text-slate-500 mt-1">{experiment.description}</p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <Badge variant={status.variant}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <TaskIcon className="h-4 w-4" />
                  <span>{taskType.label}</span>
                </div>
                <span className="text-sm text-slate-400">
                  Target: {experiment.target_column}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {experiment.status === 'in_progress' && (
              <Button variant="outline" onClick={handleComplete}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-red-600"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Models
          </TabsTrigger>
          <TabsTrigger
            value="benchmarking"
            className="flex items-center gap-2"
            disabled={!experiment.training_job_id}
          >
            <TestTube className="h-4 w-4" />
            Benchmarking
          </TabsTrigger>
          <TabsTrigger
            value="monitoring"
            className="flex items-center gap-2"
            disabled={!experiment.training_job_id}
          >
            <Activity className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ExperimentOverview
            experiment={experiment}
            onRefresh={fetchExperiment}
            onNavigateToTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="models" className="mt-6">
          <ExperimentModels
            experiment={experiment}
            onRefresh={fetchExperiment}
          />
        </TabsContent>

        <TabsContent value="benchmarking" className="mt-6">
          {experiment.training_job_id ? (
            <TestingStage
              jobId={experiment.training_job_id}
              taskType={experiment.task_type === 'timeseries' ? 'regression' : experiment.task_type}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TestTube className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  No Training Job
                </h3>
                <p className="text-slate-500 text-center max-w-md">
                  Complete training first to run benchmarking tests on your models.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="mt-6">
          {experiment.training_job_id ? (
            <MonitoringStage jobId={experiment.training_job_id} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  No Training Job
                </h3>
                <p className="text-slate-500 text-center max-w-md">
                  Complete training first to enable monitoring for your models.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
