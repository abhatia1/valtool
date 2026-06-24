"use client";

import { useState, useCallback, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { BenchmarkingAPI } from "@/lib/api/benchmarking";
import type {
  ExternalModel,
  BenchmarkComparison,
  BenchmarkRun,
} from "@/types/benchmarking";
import { ExternalModelUpload } from "./benchmarking/ExternalModelUpload";
import { ContainerBuildProgress } from "./benchmarking/ContainerBuildProgress";
import { ModelSelector } from "./benchmarking/ModelSelector";
import { BenchmarkProgress } from "./benchmarking/BenchmarkProgress";
import { BenchmarkComparisonView } from "./benchmarking/BenchmarkComparison";

type BenchmarkStep = "upload" | "build" | "select" | "run" | "results";

interface BenchmarkingStageProps {
  jobId: string;
  taskType: "classification" | "regression";
  onComplete?: () => void;
}

export function BenchmarkingStage({
  jobId,
  taskType,
  onComplete,
}: BenchmarkingStageProps) {
  const [step, setStep] = useState<BenchmarkStep>("upload");
  const [externalModels, setExternalModels] = useState<ExternalModel[]>([]);
  const [currentBuildingModelId, setCurrentBuildingModelId] = useState<string | null>(null);
  const [selectedExternalModels, setSelectedExternalModels] = useState<string[]>([]);
  const [selectedPlatformModels, setSelectedPlatformModels] = useState<string[]>([]);
  const [benchmarkId, setBenchmarkId] = useState<string | null>(null);
  const [results, setResults] = useState<BenchmarkComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing external models on mount
  useEffect(() => {
    const loadExternalModels = async () => {
      try {
        const models = await BenchmarkingAPI.listExternalModels(taskType);
        setExternalModels(models);
        // If we have ready models, skip to selection
        if (models.some((m) => m.status === "ready")) {
          setStep("select");
        }
      } catch (err) {
        console.error("Failed to load external models:", err);
      }
    };
    loadExternalModels();
  }, [taskType]);

  // Handle upload complete
  const handleUploadComplete = useCallback((model: ExternalModel) => {
    setExternalModels((prev) => [...prev, model]);
    setCurrentBuildingModelId(model.model_id);
    setStep("build");
    setError(null);
  }, []);

  // Handle build complete
  const handleBuildComplete = useCallback(() => {
    // Refresh model status
    if (currentBuildingModelId) {
      BenchmarkingAPI.getExternalModel(currentBuildingModelId)
        .then((model) => {
          setExternalModels((prev) =>
            prev.map((m) => (m.model_id === model.model_id ? model : m))
          );
        })
        .catch(console.error);
    }
    setCurrentBuildingModelId(null);
    setStep("select");
    setError(null);
  }, [currentBuildingModelId]);

  // Handle build failed
  const handleBuildFailed = useCallback((errorMsg: string) => {
    setError(errorMsg);
    // Still allow user to continue to selection or retry
  }, []);

  // Handle selection change
  const handleSelectionChange = useCallback(
    (platform: string[], external: string[]) => {
      setSelectedPlatformModels(platform);
      setSelectedExternalModels(external);
    },
    []
  );

  // Handle proceed to benchmark
  const handleProceed = useCallback(async () => {
    setError(null);

    try {
      const benchmarkRun = await BenchmarkingAPI.startBenchmark({
        job_id: jobId,
        external_model_ids: selectedExternalModels,
        platform_model_ids:
          selectedPlatformModels.length > 0 ? selectedPlatformModels : undefined,
      });
      setBenchmarkId(benchmarkRun.benchmark_id);
      setStep("run");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start benchmark";
      setError(message);
    }
  }, [jobId, selectedExternalModels, selectedPlatformModels]);

  // Handle benchmark complete
  const handleBenchmarkComplete = useCallback(
    (benchmarkResults: BenchmarkComparison) => {
      setResults(benchmarkResults);
      setStep("results");
      setError(null);
    },
    []
  );

  // Handle benchmark error
  const handleBenchmarkError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setStep("select"); // Allow retry
  }, []);

  // Handle export
  const handleExport = useCallback(
    async (format: "pdf" | "json" | "csv") => {
      if (!benchmarkId) return;
      try {
        await BenchmarkingAPI.downloadReport(benchmarkId, format);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to export report";
        setError(message);
      }
    },
    [benchmarkId]
  );

  // Handle continue to monitoring
  const handleContinue = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  // Handle skip to selection (for adding more models)
  const handleAddMoreModels = useCallback(() => {
    setStep("upload");
  }, []);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        <StepIndicator
          step={1}
          active={step === "upload"}
          completed={step !== "upload"}
          label="Upload"
        />
        <div className="h-0.5 flex-1 bg-slate-200" />
        <StepIndicator
          step={2}
          active={step === "build"}
          completed={["select", "run", "results"].includes(step)}
          label="Build"
        />
        <div className="h-0.5 flex-1 bg-slate-200" />
        <StepIndicator
          step={3}
          active={step === "select"}
          completed={["run", "results"].includes(step)}
          label="Select"
        />
        <div className="h-0.5 flex-1 bg-slate-200" />
        <StepIndicator
          step={4}
          active={step === "run"}
          completed={step === "results"}
          label="Run"
        />
        <div className="h-0.5 flex-1 bg-slate-200" />
        <StepIndicator
          step={5}
          active={step === "results"}
          completed={false}
          label="Results"
        />
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      {step === "upload" && (
        <ExternalModelUpload
          taskType={taskType}
          onUploadComplete={handleUploadComplete}
          onError={setError}
          existingModels={externalModels}
          onSkipToSelection={
            externalModels.some((m) => m.status === "ready")
              ? () => setStep("select")
              : undefined
          }
        />
      )}

      {step === "build" && currentBuildingModelId && (
        <ContainerBuildProgress
          modelId={currentBuildingModelId}
          onBuildComplete={handleBuildComplete}
          onBuildFailed={handleBuildFailed}
        />
      )}

      {step === "select" && (
        <ModelSelector
          jobId={jobId}
          taskType={taskType}
          externalModels={externalModels.filter((m) => m.status === "ready")}
          onSelectionChange={handleSelectionChange}
          onProceed={handleProceed}
          onAddMoreModels={handleAddMoreModels}
        />
      )}

      {step === "run" && benchmarkId && (
        <BenchmarkProgress
          benchmarkId={benchmarkId}
          onComplete={handleBenchmarkComplete}
          onError={handleBenchmarkError}
        />
      )}

      {step === "results" && results && (
        <BenchmarkComparisonView
          results={results}
          taskType={taskType}
          onExport={handleExport}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}

// Helper Components
function StepIndicator({
  step,
  active,
  completed,
  label,
}: {
  step: number;
  active: boolean;
  completed: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          completed
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-500"
              : "bg-slate-100 text-slate-500"
        }`}
      >
        {completed ? <CheckCircle className="h-5 w-5" /> : step}
      </div>
      <span
        className={`text-xs ${active ? "text-emerald-700 font-medium" : "text-slate-500"}`}
      >
        {label}
      </span>
    </div>
  );
}
