"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Info,
  Rocket,
  Loader2,
  AlertCircle,
  Trophy,
  TrendingUp,
  TestTube,
} from "lucide-react";
import { TrainingAPI } from "@/lib/api/training";
import { experimentsApi } from "@/lib/api/experiments";
import type { TrainingResults as TrainingResultsType } from "@/types/training";
import type { RegressionTrainingJob } from "@/types/regression";
import type { TimeSeriesTrainingResults } from "@/types/timeseries";
import { TrainingProgress } from "./training/TrainingProgress";
import { TrainingResults } from "./training/TrainingResults";
import { VisualizationGrid } from "./training/VisualizationGrid";

interface TrainingStageProps {
  datasetId: string | null;
  configId?: string | null;
  experimentId?: string | null;
  taskType?: "classification" | "regression" | "timeseries";
  onProceedToNext?: () => void;
  onTrainingComplete?: (jobId: string, taskType?: "classification" | "regression") => void;
}

export function TrainingStage({
  datasetId: _datasetId,
  configId: initialConfigId,
  experimentId,
  taskType: initialTaskType = "classification",
  onProceedToNext,
  onTrainingComplete,
}: TrainingStageProps) {
  const [configId, setConfigId] = useState(initialConfigId || "");
  const [jobName, setJobName] = useState("");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<"classification" | "regression" | "timeseries">(initialTaskType);
  const [trainingResults, setTrainingResults] = useState<TrainingResultsType | RegressionTrainingJob | TimeSeriesTrainingResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("start");

  // Type guards
  const isClassificationResult = (result: any): result is TrainingResultsType => {
    return result && result.task_type === 'classification';
  };

  const isRegressionResult = (result: any): result is RegressionTrainingJob => {
    return result && result.best_model && 'metrics' in result.best_model && 'r2' in result.best_model.metrics;
  };

  const isTimeSeriesResult = (result: any): result is TimeSeriesTrainingResults => {
    return result && result.best_model && 'category' in result.best_model;
  };

  // Auto-fetch results when training completes
  const handleTrainingComplete = async () => {
    if (!currentJobId) return;

    try {
      const results = await TrainingAPI.getResults(currentJobId);
      setTrainingResults(results);

      // Detect and store task type from results
      const isClassification = isClassificationResult(results);
      const isRegression = isRegressionResult(results);
      const isTimeSeries = isTimeSeriesResult(results);

      if (isClassification) {
        setTaskType('classification');
      } else if (isRegression) {
        setTaskType('regression');
      } else if (isTimeSeries) {
        setTaskType('timeseries');
      }

      // Update experiment with training results if we have an experimentId
      if (experimentId) {
        try {
          // Build update payload based on task type
          let bestModelName: string | undefined;
          let bestMetricName = 'accuracy';
          let bestMetricValue: number | undefined;
          let totalModelsTrained = 0;
          let trainingDuration: number | undefined;

          if (isClassification) {
            const classResults = results as TrainingResultsType;
            bestModelName = classResults.best_model.estimator_name;
            bestMetricName = 'accuracy';
            bestMetricValue = classResults.best_model.metrics.accuracy;
            totalModelsTrained = classResults.training_summary.total_models_trained;
            trainingDuration = classResults.training_summary.training_duration;
          } else if (isRegression) {
            const regResults = results as RegressionTrainingJob;
            if (regResults.best_model) {
              bestModelName = regResults.best_model.estimator_name;
              bestMetricName = 'r2';
              bestMetricValue = regResults.best_model.metrics.r2;
            }
            totalModelsTrained = regResults.all_models?.length || 0;
          }

          await experimentsApi.update(experimentId, {
            training_job_id: currentJobId,
            best_model_name: bestModelName,
            best_metric_name: bestMetricName,
            best_metric_value: bestMetricValue,
            total_models_trained: totalModelsTrained,
            training_duration_seconds: trainingDuration,
          });
        } catch (updateErr) {
          console.error("Failed to update experiment with training results:", updateErr);
          // Don't fail the whole operation if experiment update fails
        }
      }

      setActiveTab("results");

      // Note: User must click "Proceed to Testing" button in Visualizations tab
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch training results";
      setError(errorMessage);
    }
  };

  const handleStartTraining = async () => {
    if (!configId) {
      setError("Please provide a configuration ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await TrainingAPI.startTraining({
        config_id: configId,
        job_name: jobName || undefined,
      });

      setCurrentJobId(response.job_id);
      setActiveTab("progress");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to start training");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCurrentJobId(null);
    setTrainingResults(null);
    setActiveTab("start");
  };

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=Lexend:wght@300;400;500;600&display=swap');

        .training-container {
          font-family: 'Lexend', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .training-heading {
          font-family: 'Work Sans', sans-serif;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .training-mono {
          font-family: 'DM Mono', monospace;
          font-feature-settings: 'tnum' 1, 'zero' 1;
        }

        .training-grid-bg {
          background-color: #fafbfc;
          background-image:
            linear-gradient(rgba(16, 185, 129, 0.03) 1.5px, transparent 1.5px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1.5px, transparent 1.5px);
          background-size: 30px 30px;
          position: relative;
        }

        .training-grid-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.06), transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(14, 165, 233, 0.04), transparent 50%);
          pointer-events: none;
        }

        .training-card {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(16px);
          border: 1.5px solid rgba(203, 213, 225, 0.6);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .training-card:hover {
          border-color: rgba(16, 185, 129, 0.4);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.12);
          transform: translateY(-2px);
        }

        .training-btn-primary {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
        }

        .training-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
        }

        .training-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .training-fade-in {
          animation: trainingFadeIn 0.6s ease-out forwards;
        }

        @keyframes trainingFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

      `}</style>

      <div className="training-container training-grid-bg p-8 rounded-2xl border-2 border-slate-200/70 bg-white/40 backdrop-blur-sm">
        {/* Header */}
        <div className="mb-6 training-fade-in">
          <h2 className="text-4xl training-heading text-slate-900 mb-2">
            Model Training
          </h2>
          <p className="text-slate-600 training-mono text-sm tracking-wide font-light">
            AutoML training pipeline with comprehensive model evaluation
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-white/80 backdrop-blur-sm border-2 border-slate-200/60">
            <TabsTrigger
              value="start"
              disabled={!!currentJobId && activeTab !== "start"}
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-50 data-[state=active]:to-teal-50"
            >
              <Rocket className="h-4 w-4 mr-2" />
              Start Training
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              disabled={!currentJobId}
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-50 data-[state=active]:to-teal-50"
            >
              <Loader2 className="h-4 w-4 mr-2" />
              Progress
            </TabsTrigger>
            <TabsTrigger
              value="results"
              disabled={!trainingResults}
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-50 data-[state=active]:to-teal-50"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
            <TabsTrigger
              value="visualizations"
              disabled={!trainingResults || (taskType !== "classification" && taskType !== "regression")}
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-50 data-[state=active]:to-teal-50"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Visualizations
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Start Training */}
          <TabsContent value="start" className="space-y-6">
            <Card className="training-card rounded-2xl shadow-sm">
              <CardHeader className="bg-gradient-to-r from-emerald-50/60 to-teal-50/40 border-b-2 border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <Rocket className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <div>
                    <CardTitle className="text-2xl training-heading">Start New Training Job</CardTitle>
                    <CardDescription className="text-base mt-1">
                      Configure and launch a new AutoML training job
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-8 space-y-6">
                {/* Configuration ID Input */}
                <div className="space-y-3">
                  <Label htmlFor="config-id" className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Configuration ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="config-id"
                    value={configId}
                    onChange={(e) => setConfigId(e.target.value)}
                    placeholder="Enter configuration ID from Phase 3"
                    className="training-mono border-2 border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base h-12"
                    disabled={loading}
                  />
                  <p className="text-xs text-slate-500 font-light">
                    Use a configuration created in Phase 3 (Configure stage)
                  </p>
                </div>

                {/* Job Name Input (Optional) */}
                <div className="space-y-3">
                  <Label htmlFor="job-name" className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                    Job Name <span className="text-slate-400 font-light text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="job-name"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="e.g., My Classification Model"
                    className="border-2 border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base h-12"
                    disabled={loading}
                  />
                  <p className="text-xs text-slate-500 font-light">
                    Give your training job a memorable name
                  </p>
                </div>

                {/* Info Box */}
                <Alert className="border-2 border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/60">
                  <Info className="h-5 w-5 text-emerald-600" />
                  <AlertDescription className="text-emerald-900 text-sm font-medium">
                    Training will evaluate{' '}
                    {taskType === 'classification' && '18+ classification algorithms'}
                    {taskType === 'regression' && '22+ regression algorithms'}
                    {taskType === 'timeseries' && 'statistical and ML time series models'}{' '}
                    with hyperparameter tuning. Depending on your configuration, this may take several minutes to complete.
                  </AlertDescription>
                </Alert>

                {/* Start Button */}
                <Button
                  onClick={handleStartTraining}
                  disabled={!configId || loading}
                  size="lg"
                  className="w-full training-btn-primary text-white border-0 h-14 text-lg font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                      Starting Training...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-6 w-6 mr-2" />
                      Start Training
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Training Info Card */}
            <Card className="training-card rounded-2xl">
              <CardHeader className="border-b-2 border-slate-100">
                <CardTitle className="text-xl training-heading">What to Expect</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                    <span>
                      <strong className="text-slate-900">Multiple Models:</strong> Automatically trains{' '}
                      {taskType === 'classification' && '18+ classification algorithms including Random Forest, XGBoost, LightGBM, and more'}
                      {taskType === 'regression' && '22+ regression algorithms including Ridge, Lasso, Random Forest, XGBoost, and more'}
                      {taskType === 'timeseries' && 'ARIMA, SARIMA, Exponential Smoothing, and ML models with time features'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-teal-500 mt-1 flex-shrink-0" />
                    <span>
                      <strong className="text-slate-900">Hyperparameter Tuning:</strong> Optimizes model parameters
                      using cross-validation for best performance
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-cyan-500 mt-1 flex-shrink-0" />
                    <span>
                      <strong className="text-slate-900">Real-time Progress:</strong> Monitor training progress with
                      live updates every 2 seconds
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-sky-500 mt-1 flex-shrink-0" />
                    <span>
                      <strong className="text-slate-900">Model Leaderboard:</strong> Compare all trained models with detailed performance metrics and rankings
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Progress Monitoring */}
          <TabsContent value="progress" className="space-y-6">
            {currentJobId && (
              <TrainingProgress
                jobId={currentJobId}
                onComplete={handleTrainingComplete}
                onCancel={handleCancel}
              />
            )}
          </TabsContent>

          {/* Tab 3: Results */}
          <TabsContent value="results" className="space-y-6">
            {trainingResults && isClassificationResult(trainingResults) && (
              <>
                <TrainingResults results={trainingResults} />

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button
                    onClick={() => {
                      setCurrentJobId(null);
                      setTrainingResults(null);
                      setActiveTab("start");
                    }}
                    variant="outline"
                    size="lg"
                    className="border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 h-12 px-6 font-semibold"
                  >
                    Start New Training
                  </Button>
                  {onProceedToNext && (
                    <Button
                      onClick={onProceedToNext}
                      size="lg"
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 transition-all h-12 px-6 font-semibold"
                    >
                      Proceed to Testing
                      <TrendingUp className="h-5 w-5 ml-2" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Tab 4: Visualizations */}
          <TabsContent value="visualizations" className="space-y-6">
            {trainingResults && (taskType === "classification" || taskType === "regression") && (
              <>
                <Card className="training-card rounded-2xl shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-indigo-50/60 to-purple-50/40 border-b-2 border-slate-100">
                    <CardTitle className="text-2xl training-heading">
                      Interactive Visualizations
                    </CardTitle>
                    <CardDescription className="text-base mt-1">
                      Explore model performance through interactive charts and plots
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <VisualizationGrid
                      jobId={currentJobId!}
                      taskType={taskType}
                      models={isClassificationResult(trainingResults) ? trainingResults.all_models : []}
                      bestModelName={isClassificationResult(trainingResults) ? trainingResults.best_model.estimator_name : undefined}
                    />
                  </CardContent>
                </Card>

                {/* Proceed to Testing Button */}
                {onTrainingComplete && (
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => onTrainingComplete(currentJobId!, taskType as "classification" | "regression")}
                      size="lg"
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 transition-all h-14 px-8 font-semibold text-lg"
                    >
                      Proceed to Testing
                      <TestTube className="h-5 w-5 ml-3" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
