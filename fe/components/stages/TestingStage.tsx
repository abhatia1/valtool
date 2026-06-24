"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Play,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react";
import { TestingAPI } from "@/lib/api/testing";
import { TestResultsResponse, MetricComparison, MultiModelTestResultsResponse } from "@/types/testing";
import { TestResultsLeaderboard } from "./testing/TestResultsLeaderboard";
import { TestVisualizationGrid } from "./testing/TestVisualizationGrid";

interface TestingStageProps {
  jobId: string;
  taskType: "classification" | "regression";
  onComplete?: () => void;
}

export function TestingStage({
  jobId,
  taskType,
  onComplete,
}: TestingStageProps) {
  const [testId, setTestId] = useState<string | null>(null);
  const [results, setResults] = useState<TestResultsResponse | null>(null);
  const [multiModelResults, setMultiModelResults] = useState<MultiModelTestResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "run" | "results">("upload");

  const handleFileUpload = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);

      try {
        const uploadResponse = await TestingAPI.uploadTestDataset(file, jobId);
        setTestId(uploadResponse.test_id);
        setStep("run");
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Upload failed";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [jobId]
  );

  const handleRunTest = useCallback(async () => {
    if (!testId) return;

    setLoading(true);
    setError(null);

    try {
      // Try multi-model testing first (tests all trained models)
      try {
        const multiModelResponse = await TestingAPI.runAllModelsTest({
          job_id: jobId,
          test_dataset_id: testId,
        });
        setMultiModelResults(multiModelResponse);
        setResults(null); // Clear single-model results
        setStep("results");
        return;
      } catch (multiModelErr: unknown) {
        // Multi-model testing failed (likely no all_models directory)
        // Fall back to single-model testing
        console.log("Multi-model testing not available, falling back to single-model:", multiModelErr);
      }

      // Fall back to single-model testing (best model only)
      const runResponse = await TestingAPI.runTest({
        test_id: testId,
        job_id: jobId,
      });

      // Fetch results
      const resultsResponse = await TestingAPI.getResults(
        runResponse.test_run_id
      );
      setResults(resultsResponse);
      setMultiModelResults(null); // Clear multi-model results
      setStep("results");
      // Don't auto-advance to Monitoring - let user review results first
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Test failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [testId, jobId]);

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
          active={step === "run"}
          completed={step === "results"}
          label="Run Test"
        />
        <div className="h-0.5 flex-1 bg-slate-200" />
        <StepIndicator
          step={3}
          active={step === "results"}
          completed={false}
          label="Results"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Step */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Test Dataset</CardTitle>
            <CardDescription>
              Upload a dataset with the same structure as your training data to
              evaluate the model
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploader onUpload={handleFileUpload} loading={loading} />
          </CardContent>
        </Card>
      )}

      {/* Run Test Step */}
      {step === "run" && (
        <Card>
          <CardHeader>
            <CardTitle>Run Model Evaluation</CardTitle>
            <CardDescription>
              Evaluate your trained model on the uploaded test dataset
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Badge variant="outline" className="text-base px-4 py-1">
              Test dataset ready
            </Badge>
            <Button onClick={handleRunTest} disabled={loading} size="lg">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              Run Evaluation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results Step */}
      {step === "results" && (multiModelResults || results) && (
        <>
          {multiModelResults ? (
            <TestResultsLeaderboard results={multiModelResults} jobId={jobId} />
          ) : results ? (
            <TestResultsDisplay results={results} taskType={taskType} />
          ) : null}
          {onComplete && (
            <div className="flex justify-end mt-6">
              <Button onClick={onComplete} size="lg">
                Continue to Monitoring
                <CheckCircle className="h-5 w-5 ml-2" />
              </Button>
            </div>
          )}
        </>
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

function FileUploader({
  onUpload,
  loading,
}: {
  onUpload: (file: File) => void;
  loading: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        dragActive ? "border-emerald-500 bg-emerald-50" : "border-slate-300"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
      <p className="text-slate-600 mb-2">
        Drag and drop your test dataset here, or
      </p>
      <label className="cursor-pointer">
        <span className="text-emerald-600 hover:underline">browse files</span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleChange}
          disabled={loading}
        />
      </label>
      <p className="text-xs text-slate-400 mt-2">CSV or Excel files supported</p>
      {loading && (
        <Loader2 className="h-6 w-6 animate-spin mx-auto mt-4 text-emerald-500" />
      )}
    </div>
  );
}

function TestResultsDisplay({
  results,
  taskType,
}: {
  results: TestResultsResponse;
  taskType: "classification" | "regression";
}) {
  return (
    <Tabs defaultValue="metrics" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="metrics">Metrics</TabsTrigger>
        <TabsTrigger value="comparison">Training Comparison</TabsTrigger>
        <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
      </TabsList>

      <TabsContent value="metrics" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Test Metrics</CardTitle>
            <CardDescription>
              {taskType === "classification"
                ? "Classification performance metrics"
                : "Regression performance metrics"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(results.metrics).map(([key, value]) => (
                <MetricCard key={key} name={key} value={value} />
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="comparison" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Comparison to Training</CardTitle>
            <CardDescription>
              See how test performance compares to training metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(results.comparison_to_training).map(
                ([metric, comparison]) => (
                  <ComparisonRow
                    key={metric}
                    metric={metric}
                    comparison={comparison}
                  />
                )
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="visualizations" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Visualizations</CardTitle>
          </CardHeader>
          <CardContent>
            <TestVisualizationGrid
              testRunId={results.test_run_id}
              taskType={taskType}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function MetricCard({ name, value }: { name: string; value: number }) {
  const formatted = typeof value === "number" ? value.toFixed(4) : value;
  const displayName = name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <p className="text-sm text-slate-500">{displayName}</p>
      <p className="text-2xl font-bold text-slate-900">{formatted}</p>
    </div>
  );
}

function ComparisonRow({
  metric,
  comparison,
}: {
  metric: string;
  comparison: MetricComparison;
}) {
  const displayName = metric
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  const isImproved = comparison.percent_change > 0;
  const isDegraded = comparison.percent_change < -5;

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
      <div>
        <p className="font-medium">{displayName}</p>
        <div className="flex gap-4 text-sm text-slate-500">
          <span>Training: {comparison.training_value.toFixed(4)}</span>
          <span>Test: {comparison.test_value.toFixed(4)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isDegraded ? (
          <TrendingDown className="h-5 w-5 text-red-500" />
        ) : isImproved ? (
          <TrendingUp className="h-5 w-5 text-emerald-500" />
        ) : (
          <Minus className="h-5 w-5 text-slate-400" />
        )}
        <Badge
          variant={isDegraded ? "destructive" : isImproved ? "default" : "secondary"}
        >
          {comparison.percent_change > 0 ? "+" : ""}
          {comparison.percent_change.toFixed(1)}%
        </Badge>
      </div>
    </div>
  );
}
