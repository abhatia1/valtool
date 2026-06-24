'use client';

// ============================================================
// Experiments Dashboard Page
// Phase 4: Redesigned with experiment cards grid
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  FlaskConical,
  Plus,
  RefreshCw,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { ExperimentCard } from '@/components/experiments/ExperimentCard';
import { ExperimentFilters } from '@/components/experiments/ExperimentFilters';
import { experimentsApi } from '@/lib/api/experiments';
import type {
  ExperimentListItem,
  ExperimentFilters as FilterType,
} from '@/types/experiment';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterType>({});
  const [total, setTotal] = useState(0);

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await experimentsApi.list(filters, 1, 50);
      setExperiments(response.experiments);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch experiments:', err);
      setError('Failed to load experiments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const handleDelete = async (experimentId: string) => {
    if (!confirm('Are you sure you want to delete this experiment?')) {
      return;
    }
    try {
      await experimentsApi.delete(experimentId);
      setExperiments((prev) =>
        prev.filter((e) => e.experiment_id !== experimentId)
      );
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error('Failed to delete experiment:', err);
      alert('Failed to delete experiment. Please try again.');
    }
  };

  const handleComplete = async (experimentId: string) => {
    try {
      await experimentsApi.complete(experimentId);
      // Refresh list to show updated status
      fetchExperiments();
    } catch (err) {
      console.error('Failed to complete experiment:', err);
      alert('Failed to mark experiment as complete. Please try again.');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workflow
            </Button>
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <FlaskConical className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                My Experiments
              </h1>
              <p className="text-slate-500 mt-1">
                Track, manage, and continue your ML experiments
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/?stage=configure">
              <Plus className="h-4 w-4 mr-2" />
              New Experiment
            </Link>
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="mb-6">
        <ExperimentFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Results Count & Refresh */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">
          {loading ? 'Loading...' : `${total} experiment${total !== 1 ? 's' : ''} found`}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchExperiments}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchExperiments}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-[280px] animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-4" />
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-6" />
                <div className="h-20 bg-slate-100 rounded mb-4" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!error && !loading && experiments.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No experiments yet
            </h3>
            <p className="text-slate-500 text-center mb-6 max-w-md">
              {filters.status || filters.task_type || filters.search
                ? 'No experiments match your current filters. Try adjusting or clearing them.'
                : 'Start a new experiment from the workflow to track your ML training runs, benchmark models, and monitor performance.'}
            </p>
            {filters.status || filters.task_type || filters.search ? (
              <Button variant="outline" onClick={() => setFilters({})}>
                Clear Filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/?stage=configure">
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Experiment
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!error && !loading && experiments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {experiments.map((experiment) => (
            <ExperimentCard
              key={experiment.experiment_id}
              experiment={experiment}
              onDelete={handleDelete}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
