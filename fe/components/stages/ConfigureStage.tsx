"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { TemplateSelector } from "./config/TemplateSelector";
import { EstimatorPicker } from "./config/EstimatorPicker";
import { PreprocessingPanel } from "./config/PreprocessingPanel";
import { FeatureEngineeringPanel } from "./config/FeatureEngineeringPanel";
import { ModelSelectionPanel } from "./config/ModelSelectionPanel";
import { HyperparameterTuningPanel } from "./config/HyperparameterTuningPanel";
import { ConfigurationSummary } from "./config/ConfigurationSummary";
import { ExperimentSetupPanel, type ExperimentSetup } from "./config/ExperimentSetupPanel";
import { configApi } from "@/lib/api/config";
import { datasetsApi } from "@/lib/api/datasets";
import { experimentsApi } from "@/lib/api/experiments";
import type {
  ConfigTemplate,
  TaskType,
  WizardStep,
} from "@/types/config";
import {
  DEFAULT_PREPROCESSING as PREPROCESSING_DEFAULT,
  DEFAULT_FEATURE_ENGINEERING as FEATURE_ENG_DEFAULT,
  DEFAULT_MODEL_SELECTION as MODEL_SEL_DEFAULT,
  DEFAULT_HYPERPARAMETER_TUNING as TUNING_DEFAULT,
  DEFAULT_MLFLOW as MLFLOW_DEFAULT,
} from "@/types/config";

interface ConfigureStageProps {
  datasetId: string | null;
  onConfigCreated?: (configId: string, experimentId?: string) => void;
}

const WIZARD_STEPS: Array<{
  id: WizardStep;
  label: string;
  description: string;
}> = [
  { id: "experiment", label: "Experiment", description: "Save your work" },
  { id: "template", label: "Template", description: "Choose a starting point" },
  { id: "task", label: "Task Setup", description: "Define your ML task" },
  { id: "preprocessing", label: "Preprocessing", description: "Clean and transform data" },
  { id: "features", label: "Features", description: "Engineer features" },
  { id: "models", label: "Estimators", description: "Select algorithms" },
  { id: "tuning", label: "Tuning", description: "Optimize parameters" },
  { id: "summary", label: "Review", description: "Final configuration" },
];

export function ConfigureStage({ datasetId, onConfigCreated }: ConfigureStageProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ConfigTemplate | null>(null);
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [preprocessing, setPreprocessing] = useState(PREPROCESSING_DEFAULT);
  const [featureEngineering, setFeatureEngineering] = useState(FEATURE_ENG_DEFAULT);
  const [modelSelection, setModelSelection] = useState(MODEL_SEL_DEFAULT);
  const [hyperparameterTuning, setHyperparameterTuning] = useState(TUNING_DEFAULT);
  const [mlflow, setMlflow] = useState(MLFLOW_DEFAULT);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configResponse, setConfigResponse] = useState<any>(null);

  // Experiment tracking state
  const [experimentSetup, setExperimentSetup] = useState<ExperimentSetup>({
    saveAsExperiment: true,
    experimentName: "",
    experimentDescription: "",
  });
  const [experimentId, setExperimentId] = useState<string | null>(null);

  const currentStep = WIZARD_STEPS[currentStepIndex];

  // Memoized callback for experiment setup changes
  const handleExperimentSetupChange = useCallback((setup: ExperimentSetup) => {
    setExperimentSetup(setup);
  }, []);

  // Load dataset columns
  useEffect(() => {
    if (!datasetId) return;

    const loadColumns = async () => {
      try {
        const details = await datasetsApi.getDetails(datasetId);
        setColumns(details.column_names || []);
      } catch (err) {
        console.error("Failed to load dataset columns:", err);
      }
    };

    loadColumns();
  }, [datasetId]);

  const handleTemplateSelect = (template: ConfigTemplate) => {
    setSelectedTemplate(template);
    setPreprocessing(template.config.preprocessing);
    setFeatureEngineering(template.config.feature_engineering);
    setModelSelection(template.config.model_selection);
    setHyperparameterTuning(template.config.hyperparameter_tuning);
    setMlflow(template.config.mlflow);
  };

  const handleNext = async () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      // If moving from experiment step and user wants to save, create experiment
      if (currentStep.id === "experiment" && experimentSetup.saveAsExperiment && !experimentId) {
        // We'll create the experiment after task setup when we have taskType and targetColumn
        // For now, just proceed - experiment creation will happen after task step
      }

      // If moving from task step and user wants to save experiment, create it now
      if (currentStep.id === "task" && experimentSetup.saveAsExperiment && !experimentId && taskType && targetColumn) {
        try {
          setCreating(true);
          const experiment = await experimentsApi.create({
            name: experimentSetup.experimentName,
            description: experimentSetup.experimentDescription || undefined,
            dataset_id: datasetId!,
            task_type: taskType,
            target_column: targetColumn,
          });
          setExperimentId(experiment.experiment_id);
        } catch (err: any) {
          const errorMessage = err.response?.data?.detail || err.message || "Failed to create experiment";
          setError(errorMessage);
          setCreating(false);
          return;
        } finally {
          setCreating(false);
        }
      }

      setCurrentStepIndex(currentStepIndex + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setError(null);
    }
  };

  const handleCreateConfig = async () => {
    if (!datasetId || !taskType || !targetColumn) {
      setError("Missing required fields");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await configApi.createConfig({
        dataset_id: datasetId,
        target_column: targetColumn,
        task_type: taskType,
        preprocessing,
        feature_engineering: featureEngineering,
        model_selection: modelSelection,
        hyperparameter_tuning: hyperparameterTuning,
        mlflow,
      });

      // Link config to experiment if we have one
      if (experimentId) {
        try {
          await experimentsApi.update(experimentId, {
            config_id: response.config_id,
          });
        } catch (linkErr) {
          console.error("Failed to link config to experiment:", linkErr);
          // Don't fail the whole operation if linking fails
        }
      }

      setConfigResponse(response);
      if (onConfigCreated) {
        onConfigCreated(response.config_id, experimentId || undefined);
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail || err.message || "Failed to create configuration";
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep.id) {
      case "experiment":
        // If saving, need a name; otherwise always can proceed
        return !experimentSetup.saveAsExperiment || experimentSetup.experimentName.trim() !== "";
      case "template":
        return selectedTemplate !== null;
      case "task":
        return taskType !== null && targetColumn !== "";
      case "models":
        return modelSelection.estimators.length > 0;
      default:
        return true;
    }
  };

  if (!datasetId) {
    return (
      <div className="p-12 text-center">
        <Alert className="max-w-2xl mx-auto border-slate-200 bg-white/90 backdrop-blur-sm">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <AlertDescription className="ml-2 text-slate-700">
            Please upload a dataset first to configure training.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (configResponse) {
    return (
      <div className="space-y-6">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

          .config-heading {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            letter-spacing: -0.02em;
          }

          .config-mono {
            font-family: 'IBM Plex Mono', monospace;
          }
        `}</style>

        <div className="max-w-4xl mx-auto space-y-8 py-12">
          <div className="text-center space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 blur-2xl opacity-30" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/30">
                <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <h2 className="text-3xl config-heading text-slate-900">
              Configuration Created
            </h2>
            <p className="text-slate-600 text-sm font-light tracking-wide">
              Your training configuration has been successfully saved
            </p>
          </div>

          <Card className="border-slate-200/60 bg-white/90 backdrop-blur-sm shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-600 font-medium">Configuration ID</p>
                  <p className="text-base config-mono text-slate-900 truncate bg-slate-50 px-3 py-2 rounded-lg">
                    {configResponse.config_id}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-600 font-medium">Estimated Training Time</p>
                  <p className="text-base font-semibold text-slate-900 bg-slate-50 px-3 py-2 rounded-lg">
                    {Math.floor(configResponse.estimated_training_time / 60)}m{" "}
                    {configResponse.estimated_training_time % 60}s
                  </p>
                </div>
              </div>

              {configResponse.warnings && configResponse.warnings.length > 0 && (
                <Alert className="border-amber-200/60 bg-amber-50/50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="ml-2">
                    <ul className="list-disc pl-5 space-y-1">
                      {configResponse.warnings.map((w: string, i: number) => (
                        <li key={i} className="text-sm text-amber-800">
                          {w}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              className="border-slate-300 hover:border-slate-400 px-8"
              onClick={() => {
                setConfigResponse(null);
                setCurrentStepIndex(0);
              }}
            >
              Create Another Configuration
            </Button>
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/20 transition-all px-8"
              onClick={() => {
                if (onConfigCreated) {
                  onConfigCreated(configResponse.config_id, experimentId || undefined);
                }
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Start Training
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .config-container {
          font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .config-heading {
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .config-mono {
          font-family: 'IBM Plex Mono', monospace;
        }

        .config-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(226, 232, 240, 0.7);
          transition: all 0.3s ease;
        }

        .config-card:hover {
          border-color: rgba(37, 99, 235, 0.3);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
        }

        .config-btn-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .config-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }

        .config-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="config-container max-w-6xl mx-auto space-y-8 pb-12">
        {/* Step Content */}
        <Card className="config-card rounded-xl shadow-sm">
          <CardContent className="p-8">
            <div className="min-h-[600px]">
              {currentStep.id === "experiment" && (
                <ExperimentSetupPanel
                  datasetId={datasetId}
                  onSetupChange={handleExperimentSetupChange}
                  initialSetup={experimentSetup}
                />
              )}

              {currentStep.id === "template" && (
                <TemplateSelector
                  onSelect={handleTemplateSelect}
                  selectedTemplateId={selectedTemplate?.id}
                />
              )}

              {currentStep.id === "task" && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl config-heading text-slate-900">
                      Define Your ML Task
                    </h2>
                    <p className="text-slate-600 text-sm font-light tracking-wide">
                      Select the task type and target variable
                    </p>
                  </div>

                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="task-type" className="text-sm font-medium text-slate-900">
                        Task Type
                      </Label>
                      <Select
                        value={taskType || ""}
                        onValueChange={(value: TaskType) => setTaskType(value)}
                      >
                        <SelectTrigger id="task-type" className="h-11 border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <SelectValue placeholder="Select task type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="classification">
                            <div>
                              <div className="font-semibold text-slate-900">Classification</div>
                              <div className="text-xs text-slate-600">
                                Predict categories or classes
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="regression">
                            <div>
                              <div className="font-semibold text-slate-900">Regression</div>
                              <div className="text-xs text-slate-600">
                                Predict continuous values
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="timeseries">
                            <div>
                              <div className="font-semibold text-slate-900">Time Series</div>
                              <div className="text-xs text-slate-600">
                                Forecast future values
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="target-column" className="text-sm font-medium text-slate-900">
                        Target Column
                      </Label>
                      <Select value={targetColumn} onValueChange={setTargetColumn}>
                        <SelectTrigger id="target-column" className="h-11 border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                          <SelectValue placeholder="Select target column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 font-light">
                        The column you want to predict
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStep.id === "preprocessing" && (
                <PreprocessingPanel
                  config={preprocessing}
                  onChange={setPreprocessing}
                  datasetId={datasetId}
                />
              )}

              {currentStep.id === "features" && (
                <FeatureEngineeringPanel
                  config={featureEngineering}
                  onChange={setFeatureEngineering}
                />
              )}

              {currentStep.id === "models" && taskType && (
                <EstimatorPicker
                  taskType={taskType}
                  selected={modelSelection.estimators}
                  onChange={(estimators) =>
                    setModelSelection({ ...modelSelection, estimators })
                  }
                />
              )}

              {currentStep.id === "tuning" && (
                <div className="space-y-6">
                  <HyperparameterTuningPanel
                    config={hyperparameterTuning}
                    onChange={setHyperparameterTuning}
                  />

                  {taskType && (
                    <ModelSelectionPanel
                      config={modelSelection}
                      onChange={setModelSelection}
                      taskType={taskType}
                    />
                  )}
                </div>
              )}

              {currentStep.id === "summary" && taskType && targetColumn && (
                <ConfigurationSummary
                  config={{
                    dataset_id: datasetId,
                    target_column: targetColumn,
                    task_type: taskType,
                    preprocessing,
                    feature_engineering: featureEngineering,
                    model_selection: modelSelection,
                    hyperparameter_tuning: hyperparameterTuning,
                    mlflow,
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Alert className="border-red-200/60 bg-red-50/50">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <AlertDescription className="ml-2 text-red-800 text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className="px-6 border-slate-300 hover:border-slate-400 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="text-center">
            <p className="text-xs text-slate-600 config-mono">
              Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
            </p>
          </div>

          {currentStepIndex < WIZARD_STEPS.length - 1 ? (
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 config-btn-primary text-white border-0"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleCreateConfig}
              disabled={creating || !canProceed()}
              className="px-8 config-btn-primary text-white border-0"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Configuration
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
