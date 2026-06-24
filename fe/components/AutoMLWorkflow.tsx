"use client";

import { useState } from "react";
import {
  Upload,
  TrendingUp,
  Settings,
  Play,
  TestTube,
  Scale,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DatasetUpload } from "./DatasetUpload";
import { EDAStage } from "./stages/EDAStage";
import { ConfigureStage } from "./stages/ConfigureStage";
import { TrainingStage } from "./stages/TrainingStage";
import { TestingStage } from "./stages/TestingStage";
import { MonitoringStage } from "./stages/MonitoringStage";
import { BenchmarkingStage } from "./stages/BenchmarkingStage";
import type { Dataset } from "@/types/dataset";

type Stage = "upload" | "eda" | "configure" | "training" | "testing" | "benchmarking" | "monitoring";

interface StageConfig {
  id: Stage;
  title: string;
  description: string;
  icon: typeof Upload;
  status: "pending" | "in_progress" | "completed";
}

export function AutoMLWorkflow() {
  const [currentStage, setCurrentStage] = useState<Stage>("upload");
  const [uploadedDataset, setUploadedDataset] = useState<Dataset | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<"classification" | "regression">("classification");
  const [experimentId, setExperimentId] = useState<string | null>(null);

  const stages: StageConfig[] = [
    {
      id: "upload",
      title: "Upload Dataset",
      description: "Upload and validate your data",
      icon: Upload,
      status: uploadedDataset ? "completed" : currentStage === "upload" ? "in_progress" : "pending",
    },
    {
      id: "eda",
      title: "Exploratory Data Analysis",
      description: "Analyze and visualize your data",
      icon: TrendingUp,
      status: currentStage === "eda" ? "in_progress" : "pending",
    },
    {
      id: "configure",
      title: "Configure Training",
      description: "Set up preprocessing and model selection",
      icon: Settings,
      status: currentStage === "configure" ? "in_progress" : "pending",
    },
    {
      id: "training",
      title: "Model Training",
      description: "Train and optimize your models",
      icon: Play,
      status: currentStage === "training" ? "in_progress" : "pending",
    },
    {
      id: "testing",
      title: "Testing",
      description: "Evaluate model performance",
      icon: TestTube,
      status: currentStage === "testing" ? "in_progress" : "pending",
    },
    {
      id: "benchmarking",
      title: "Benchmarking",
      description: "Compare with external models",
      icon: Scale,
      status: currentStage === "benchmarking" ? "in_progress" : "pending",
    },
    {
      id: "monitoring",
      title: "Monitoring",
      description: "Track model performance over time",
      icon: Activity,
      status: currentStage === "monitoring" ? "in_progress" : "pending",
    },
  ];

  const handleUploadSuccess = (dataset: Dataset) => {
    setUploadedDataset(dataset);
    // Immediately advance to EDA after upload
    setCurrentStage("eda");
  };

  const handleProceedToNext = () => {
    const currentIndex = stages.findIndex((s) => s.id === currentStage);
    if (currentIndex < stages.length - 1) {
      setCurrentStage(stages[currentIndex + 1].id);
    }
  };

  const handleConfigCreated = (newConfigId: string, newExperimentId?: string) => {
    setConfigId(newConfigId);
    if (newExperimentId) {
      setExperimentId(newExperimentId);
    }
    setCurrentStage("training");
  };

  const handleTrainingComplete = (completedJobId: string, completedTaskType?: "classification" | "regression") => {
    setJobId(completedJobId);
    if (completedTaskType) {
      setTaskType(completedTaskType);
    }
    setCurrentStage("testing");
  };

  const handleTestingComplete = () => {
    setCurrentStage("benchmarking");
  };

  const handleBenchmarkingComplete = () => {
    setCurrentStage("monitoring");
  };

  const datasetId = uploadedDataset?.dataset_id || null;

  const renderStageContent = () => {
    switch (currentStage) {
      case "upload":
        return <DatasetUpload onUploadSuccess={handleUploadSuccess} />;

      case "eda":
        return <EDAStage datasetId={datasetId} onProceedToNext={handleProceedToNext} />;

      case "configure":
        return <ConfigureStage datasetId={datasetId} onConfigCreated={handleConfigCreated} />;

      case "training":
        return (
          <TrainingStage
            datasetId={datasetId}
            configId={configId}
            experimentId={experimentId}
            onTrainingComplete={handleTrainingComplete}
          />
        );

      case "testing":
        return jobId ? (
          <TestingStage
            jobId={jobId}
            taskType={taskType}
            onComplete={handleTestingComplete}
          />
        ) : (
          <div className="text-center py-8 text-slate-500">
            Complete training first to test your model
          </div>
        );

      case "benchmarking":
        return jobId ? (
          <BenchmarkingStage
            jobId={jobId}
            taskType={taskType}
            onComplete={handleBenchmarkingComplete}
          />
        ) : (
          <div className="text-center py-8 text-slate-500">
            Complete testing first to benchmark your models
          </div>
        );

      case "monitoring":
        return jobId ? (
          <MonitoringStage jobId={jobId} />
        ) : (
          <div className="text-center py-8 text-slate-500">
            Complete training first to monitor your model
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

        :root {
          --navy-900: #0f1729;
          --navy-800: #1a2942;
          --navy-700: #233656;
          --blue-600: #2563eb;
          --blue-500: #3b82f6;
          --blue-400: #60a5fa;
          --blue-100: #dbeafe;
          --blue-50: #eff6ff;
          --gold-600: #d97706;
          --gold-500: #f59e0b;
          --gold-400: #fbbf24;
          --gold-100: #fef3c7;
          --slate-900: #0f172a;
          --slate-700: #334155;
          --slate-500: #64748b;
          --slate-400: #94a3b8;
          --slate-300: #cbd5e1;
          --slate-200: #e2e8f0;
          --slate-100: #f1f5f9;
          --slate-50: #f8fafc;
        }

        .workflow-container {
          font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .workflow-title {
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .stage-title {
          font-family: 'Outfit', sans-serif;
          font-weight: 500;
          letter-spacing: -0.01em;
        }
      `}</style>

      <div className="workflow-container max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="workflow-title text-3xl text-slate-900">
            AutoML Pipeline
          </h1>
          <p className="text-slate-600 text-sm font-light tracking-wide">
            End-to-end machine learning workflow orchestration
          </p>
        </div>

        {/* Stage Progress */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-gold-500/5 rounded-2xl blur-3xl" />

          <Card className="relative border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardContent className="p-8">
              <div className="relative">
                {/* Progress Track */}
                <div className="absolute left-12 right-12 top-7 h-[2px] bg-gradient-to-r from-slate-200 via-slate-200 to-slate-200">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-blue-500 to-gold-500 transition-all duration-700 ease-out"
                    style={{
                      width: `${(stages.findIndex((s) => s.id === currentStage) / (stages.length - 1)) * 100}%`,
                      boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
                    }}
                  />
                </div>

                {/* Stage Nodes */}
                <div className="relative grid grid-cols-7 gap-2">
                  {stages.map((stage, index) => {
                    const Icon = stage.icon;
                    const isActive = stage.id === currentStage;
                    const isCompleted = stage.status === "completed";
                    const isPast = stages.findIndex((s) => s.id === currentStage) > index;
                    const canNavigate = isCompleted || isActive || isPast;

                    return (
                      <button
                        key={stage.id}
                        onClick={() => canNavigate && setCurrentStage(stage.id)}
                        disabled={!canNavigate}
                        className={`flex flex-col items-center gap-3 transition-all duration-300 ${
                          canNavigate ? "cursor-pointer hover:scale-105" : "cursor-not-allowed"
                        }`}
                        style={{
                          animationDelay: `${index * 100}ms`,
                        }}
                      >
                        {/* Icon Container */}
                        <div className="relative group">
                          <div
                            className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${
                              isActive
                                ? "bg-gradient-to-br from-blue-400 to-gold-400 opacity-40 scale-110"
                                : isCompleted
                                ? "bg-gradient-to-br from-gold-400 to-gold-500 opacity-20"
                                : "opacity-0"
                            }`}
                          />
                          <div
                            className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-500 ${
                              isActive
                                ? "border-blue-500 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110"
                                : isCompleted
                                ? "border-gold-400 bg-gradient-to-br from-gold-500 to-gold-400 text-white shadow-md shadow-gold-500/20"
                                : "border-slate-300 bg-white text-slate-400 hover:border-slate-400"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
                            ) : (
                              <Icon className="h-6 w-6" strokeWidth={2} />
                            )}
                          </div>
                        </div>

                        {/* Stage Info */}
                        <div className="text-center space-y-1 max-w-[120px]">
                          <p
                            className={`stage-title text-xs transition-colors duration-300 ${
                              isActive
                                ? "text-blue-700 font-semibold"
                                : isCompleted
                                ? "text-gold-700 font-medium"
                                : "text-slate-500 font-normal"
                            }`}
                          >
                            {stage.title}
                          </p>
                          <p
                            className={`text-[10px] leading-tight font-light transition-opacity duration-300 ${
                              isActive ? "text-slate-600 opacity-100" : "text-slate-500 opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {stage.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stage Content */}
        <div
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          key={currentStage}
        >
          {renderStageContent()}
        </div>
      </div>
    </div>
  );
}
