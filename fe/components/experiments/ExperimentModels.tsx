'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Trophy,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { experimentsApi } from '@/lib/api/experiments';
import { TrainingAPI } from '@/lib/api/training';
import type { ExperimentResponse } from '@/types/experiment';

interface ExperimentModelsProps {
  experiment: ExperimentResponse;
  onRefresh: () => void;
}

interface ModelInfo {
  estimator_name: string;
  rank: number;
  validation_score: number;
  training_time?: number;
  metrics?: Record<string, number>;
}

export function ExperimentModels({ experiment, onRefresh }: ExperimentModelsProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchModels = useCallback(async () => {
    if (!experiment.training_job_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await TrainingAPI.getResults(experiment.training_job_id);

      // Extract models from results (handle both classification and regression)
      const allModels: ModelInfo[] = [];

      if ('all_models' in results && Array.isArray(results.all_models)) {
        results.all_models.forEach((model, index) => {
          allModels.push({
            estimator_name: model.estimator_name || `Model ${index + 1}`,
            rank: index + 1,
            validation_score: model.validation_score || 0,
            training_time: model.training_time,
            metrics: typeof model.metrics === 'object' ? model.metrics as Record<string, number> : undefined,
          });
        });
      }

      // Sort by rank
      allModels.sort((a, b) => a.rank - b.rank);
      setModels(allModels);
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setError('Failed to load models. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [experiment.training_job_id]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleModelToggle = (modelName: string) => {
    setSelectedModels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(modelName)) {
        newSet.delete(modelName);
      } else {
        newSet.add(modelName);
      }
      return newSet;
    });
    setSaveSuccess(false);
  };

  const handleSelectAll = () => {
    setSelectedModels(new Set(models.map((m) => m.estimator_name)));
    setSaveSuccess(false);
  };

  const handleClearSelection = () => {
    setSelectedModels(new Set());
    setSaveSuccess(false);
  };

  const handleSaveModels = async () => {
    if (selectedModels.size === 0) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      await experimentsApi.saveModels(experiment.experiment_id, Array.from(selectedModels));
      setSaveSuccess(true);
      onRefresh();
    } catch (err) {
      console.error('Failed to save models:', err);
      alert('Failed to save models. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!experiment.training_job_id) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Inbox className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Training Job</h3>
          <p className="text-slate-500 text-center max-w-md">
            Complete training first to view and manage trained models.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-3 text-slate-500">Loading models...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (models.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Inbox className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Models Found</h3>
          <p className="text-slate-500 text-center max-w-md">
            No trained models found for this experiment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Models for Benchmarking Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Models for Benchmarking
          </CardTitle>
          <CardDescription>
            Select models to save for later benchmarking tests. Currently {experiment.models_saved_for_benchmarking} model(s) saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearSelection}>
              Clear
            </Button>
            <div className="flex-1" />
            <Button
              onClick={handleSaveModels}
              disabled={selectedModels.size === 0 || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : saveSuccess ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saveSuccess ? 'Saved!' : `Save ${selectedModels.size} Model(s)`}
            </Button>
          </div>

          {saveSuccess && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Models saved successfully! You can now use them for benchmarking.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Model Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Model Leaderboard</CardTitle>
          <CardDescription>
            All trained models ranked by validation score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {models.map((model) => {
              const isBestModel = model.rank === 1;
              const isSelected = selectedModels.has(model.estimator_name);

              return (
                <div
                  key={model.estimator_name}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50'
                      : isBestModel
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleModelToggle(model.estimator_name)}
                  />

                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm">
                    {model.rank}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{model.estimator_name}</p>
                      {isBestModel && (
                        <Badge className="bg-amber-500">
                          <Trophy className="h-3 w-3 mr-1" />
                          Best
                        </Badge>
                      )}
                    </div>
                    {model.training_time && (
                      <p className="text-xs text-slate-500">
                        Training time: {model.training_time.toFixed(1)}s
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-lg font-bold">
                      {(model.validation_score * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-500">Validation Score</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
