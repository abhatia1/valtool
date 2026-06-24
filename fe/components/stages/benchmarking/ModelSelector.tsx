"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  Plus,
  CheckCircle,
  Loader2,
  Server,
  Container,
  AlertTriangle,
  Package,
} from "lucide-react";
import type { ExternalModel, PlatformModel } from "@/types/benchmarking";
import { TestingAPI } from "@/lib/api/testing";
import type { FinalizedModelsResponse } from "@/types/testing";

interface ModelSelectorProps {
  jobId: string;
  taskType: "classification" | "regression";
  externalModels: ExternalModel[];
  onSelectionChange: (platform: string[], external: string[]) => void;
  onProceed: () => void;
  onAddMoreModels?: () => void;
}

export function ModelSelector({
  jobId,
  taskType,
  externalModels,
  onSelectionChange,
  onProceed,
  onAddMoreModels,
}: ModelSelectorProps) {
  const [platformModels, setPlatformModels] = useState<PlatformModel[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string[]>([]);
  const [selectedExternal, setSelectedExternal] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizedInfo, setFinalizedInfo] = useState<FinalizedModelsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch finalized models from testing endpoint
  useEffect(() => {
    const fetchFinalizedModels = async () => {
      try {
        setError(null);
        const data = await TestingAPI.getFinalizedModels(jobId);
        setFinalizedInfo(data);

        // Convert to PlatformModel format
        const models: PlatformModel[] = data.models.map((model) => ({
          model_id: `${jobId}_${model.estimator_name}`,
          estimator_name: model.estimator_name,
          metrics: model.test_metrics as Record<string, number>,
          training_time_seconds: model.training_time_seconds,
          is_best: model.is_primary,
        }));

        setPlatformModels(models);

        // Pre-select primary model
        if (models.length > 0) {
          const primaryModel = models.find((m) => m.is_best);
          if (primaryModel) {
            setSelectedPlatform([primaryModel.model_id]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch finalized models:", err);
        setError(err instanceof Error ? err.message : "Failed to load models");
      } finally {
        setLoading(false);
      }
    };

    fetchFinalizedModels();
  }, [jobId]);

  // Update parent on selection change
  useEffect(() => {
    onSelectionChange(selectedPlatform, selectedExternal);
  }, [selectedPlatform, selectedExternal, onSelectionChange]);

  const togglePlatformModel = useCallback((modelId: string) => {
    setSelectedPlatform((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  }, []);

  const toggleExternalModel = useCallback((modelId: string) => {
    setSelectedExternal((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  }, []);

  const selectAllPlatform = useCallback(() => {
    setSelectedPlatform(platformModels.map((m) => m.model_id));
  }, [platformModels]);

  const selectAllExternal = useCallback(() => {
    setSelectedExternal(externalModels.map((m) => m.model_id));
  }, [externalModels]);

  const isFinalized = finalizedInfo?.is_finalized ?? false;
  const canProceed =
    isFinalized && selectedPlatform.length > 0 && selectedExternal.length > 0;

  const getPrimaryMetric = (metrics: Record<string, number>) => {
    if (taskType === "classification") {
      return metrics.accuracy ?? metrics.f1_score ?? Object.values(metrics)[0];
    } else {
      return metrics.r2_score ?? metrics.r2 ?? Object.values(metrics)[0];
    }
  };

  const formatMetric = (value: number | undefined) => {
    if (value === undefined) return "N/A";
    return value.toFixed(4);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
          <p className="text-slate-500 mt-4">Loading models...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
          <p className="text-red-600 mt-4">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Show warning if models not finalized
  const notFinalizedWarning = finalizedInfo && !finalizedInfo.is_finalized;

  return (
    <div className="space-y-6">
      {notFinalizedWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Models have not been finalized yet. Please go to the Testing stage
            and click &quot;Finalize Models for Benchmarking&quot; before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {finalizedInfo && finalizedInfo.is_finalized && (
        <Alert>
          <Package className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">{finalizedInfo.models.length} model(s) finalized</span>
            {finalizedInfo.includes_preprocessor && " with preprocessor"}
            {finalizedInfo.includes_encoder && ` and ${finalizedInfo.encoder_type?.replace("_", " ")}`}
            {finalizedInfo.finalized_at && (
              <span className="text-slate-500 ml-2">
                on {new Date(finalizedInfo.finalized_at).toLocaleDateString()}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Models to Compare</CardTitle>
          <CardDescription>
            {finalizedInfo?.is_finalized
              ? "Choose from your finalized models and external models to benchmark"
              : "Choose at least one platform model and one external model to benchmark"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {/* Platform Models */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-500" />
                  <h3 className="font-medium">Platform Models</h3>
                  <Badge variant="secondary">{platformModels.length}</Badge>
                </div>
                {platformModels.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={selectAllPlatform}>
                    Select All
                  </Button>
                )}
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {platformModels.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No platform models available
                  </div>
                ) : (
                  platformModels.map((model) => (
                    <div
                      key={model.model_id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedPlatform.includes(model.model_id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => togglePlatformModel(model.model_id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedPlatform.includes(model.model_id)}
                          onCheckedChange={() =>
                            togglePlatformModel(model.model_id)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 truncate">
                              {model.estimator_name}
                            </p>
                            {model.is_best && (
                              <Badge className="bg-emerald-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Best
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-4 mt-1 text-sm text-slate-500">
                            <span>
                              {taskType === "classification" ? "Acc" : "R²"}:{" "}
                              {formatMetric(getPrimaryMetric(model.metrics))}
                            </span>
                            <span>
                              Time: {model.training_time_seconds.toFixed(1)}s
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* External Models */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Container className="h-5 w-5 text-amber-500" />
                  <h3 className="font-medium">External Models</h3>
                  <Badge variant="secondary">{externalModels.length}</Badge>
                </div>
                {externalModels.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={selectAllExternal}>
                    Select All
                  </Button>
                )}
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {externalModels.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No external models available</p>
                    {onAddMoreModels && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddMoreModels}
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Upload Model
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {externalModels.map((model) => (
                      <div
                        key={model.model_id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedExternal.includes(model.model_id)
                            ? "border-amber-500 bg-amber-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                        onClick={() => toggleExternalModel(model.model_id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedExternal.includes(model.model_id)}
                            onCheckedChange={() =>
                              toggleExternalModel(model.model_id)
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {model.name}
                            </p>
                            {model.description && (
                              <p className="text-sm text-slate-500 truncate mt-1">
                                {model.description}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-1">
                              Created:{" "}
                              {new Date(model.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {onAddMoreModels && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={onAddMoreModels}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Model
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Summary & Proceed */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
        <div className="text-sm text-slate-600">
          Selected:{" "}
          <span className="font-medium text-blue-600">
            {selectedPlatform.length} platform
          </span>
          {" + "}
          <span className="font-medium text-amber-600">
            {selectedExternal.length} external
          </span>
          {" models"}
        </div>
        <Button onClick={onProceed} disabled={!canProceed} size="lg">
          <Play className="h-5 w-5 mr-2" />
          Run Benchmark
        </Button>
      </div>

      {!canProceed && (
        <p className="text-sm text-red-500 text-center">
          {!isFinalized
            ? "Please finalize models in the Testing stage before benchmarking"
            : "Please select at least one platform model and one external model to proceed"}
        </p>
      )}
    </div>
  );
}
