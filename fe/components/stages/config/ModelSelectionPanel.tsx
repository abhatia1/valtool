"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Target as TargetIcon, Split, Shuffle } from "lucide-react";
import type { ModelSelectionConfig, TaskType } from "@/types/config";

interface ModelSelectionPanelProps {
  config: ModelSelectionConfig;
  onChange: (config: ModelSelectionConfig) => void;
  taskType: TaskType;
}

const SCORING_METRICS: Record<TaskType, Array<{ value: string; label: string; description: string }>> = {
  classification: [
    { value: "accuracy", label: "Accuracy", description: "Accuracy score (higher is better)" },
    { value: "f1", label: "F1 Score (Weighted)", description: "F1 score with weighted averaging" },
    { value: "f1_macro", label: "F1 Score (Macro)", description: "F1 score with macro averaging" },
    { value: "f1_micro", label: "F1 Score (Micro)", description: "F1 score with micro averaging" },
    { value: "precision", label: "Precision (Weighted)", description: "Precision with weighted averaging" },
    { value: "precision_macro", label: "Precision (Macro)", description: "Precision with macro averaging" },
    { value: "recall", label: "Recall (Weighted)", description: "Recall with weighted averaging" },
    { value: "recall_macro", label: "Recall (Macro)", description: "Recall with macro averaging" },
    { value: "roc_auc", label: "ROC AUC", description: "ROC AUC score (higher is better)" },
    { value: "cohen_kappa", label: "Cohen Kappa", description: "Cohen kappa score (higher is better)" },
  ],
  regression: [
    { value: "r2", label: "R² Score", description: "Coefficient of determination (higher is better)" },
    { value: "neg_mean_squared_error", label: "Negative MSE", description: "Negative mean squared error" },
    { value: "neg_root_mean_squared_error", label: "Negative RMSE", description: "Negative root mean squared error" },
    { value: "neg_mean_absolute_error", label: "Negative MAE", description: "Negative mean absolute error" },
    { value: "neg_median_absolute_error", label: "Negative Median AE", description: "Negative median absolute error" },
    { value: "explained_variance", label: "Explained Variance", description: "Explained variance score" },
  ],
  timeseries: [
    { value: "r2", label: "R² Score", description: "Coefficient of determination" },
    { value: "neg_mean_squared_error", label: "Negative MSE", description: "Negative mean squared error" },
    { value: "neg_mean_absolute_error", label: "Negative MAE", description: "Negative mean absolute error" },
  ],
};

export function ModelSelectionPanel({ config, onChange, taskType }: ModelSelectionPanelProps) {
  const scoringMetrics = SCORING_METRICS[taskType] || SCORING_METRICS.classification;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          Model Selection Settings
        </h2>
        <p className="text-neutral-600 text-lg">
          Configure validation strategy and scoring metrics
        </p>
      </div>

      <div className="grid gap-6">
        {/* Validation Strategy */}
        <Card className="border-2 border-neutral-200 hover:shadow-lg transition-all overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 text-white rounded-lg">
                <Split className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Validation Strategy</CardTitle>
                <CardDescription>
                  Choose how to evaluate model performance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="validation-strategy" className="text-sm font-medium">
                  Strategy
                </Label>
                <Select
                  value={config.validation_strategy}
                  onValueChange={(value: "cross_validation" | "train_test_split") =>
                    onChange({ ...config, validation_strategy: value })
                  }
                >
                  <SelectTrigger id="validation-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cross_validation">
                      <div className="flex items-center gap-2">
                        <Shuffle className="w-4 h-4" />
                        <div>
                          <div className="font-semibold">Cross-Validation</div>
                          <div className="text-xs text-neutral-600">
                            K-fold CV for robust estimates
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="train_test_split">
                      <div className="flex items-center gap-2">
                        <Split className="w-4 h-4" />
                        <div>
                          <div className="font-semibold">Train/Val Split</div>
                          <div className="text-xs text-neutral-600">
                            Single holdout validation set for faster training
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.validation_strategy === "cross_validation" ? (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="cv-folds" className="text-sm font-medium">
                    Number of Folds (2-10)
                  </Label>
                  <Input
                    id="cv-folds"
                    type="number"
                    min={2}
                    max={10}
                    value={config.cv_folds}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        cv_folds: parseInt(e.target.value) || 5,
                      })
                    }
                    className="max-w-xs"
                  />
                  <p className="text-xs text-neutral-600">
                    Higher folds provide better evaluation but increase training time
                  </p>

                  {/* Visual Representation */}
                  <div className="flex gap-1 pt-2">
                    {Array.from({ length: config.cv_folds }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-md"
                        style={{
                          opacity: 0.8,
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="test-size" className="text-sm font-medium">
                    Validation Set Size
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="test-size"
                      type="number"
                      min={0.1}
                      max={0.5}
                      step={0.05}
                      value={config.test_size}
                      onChange={(e) =>
                        onChange({
                          ...config,
                          test_size: parseFloat(e.target.value) || 0.2,
                        })
                      }
                      className="max-w-xs"
                    />
                    <span className="text-sm text-neutral-600">
                      {(config.test_size * 100).toFixed(0)}% validation
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600">
                    Proportion of data reserved for validation (0.1-0.5)
                  </p>

                  {/* Visual Representation */}
                  <div className="flex gap-2 pt-2">
                    <div
                      className="h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-md flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(1 - config.test_size) * 100}%` }}
                    >
                      Train
                    </div>
                    <div
                      className="h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-md flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${config.test_size * 100}%` }}
                    >
                      Val
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scoring Metric */}
        <Card className="border-2 border-neutral-200 hover:shadow-lg transition-all overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 text-white rounded-lg">
                <TargetIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Scoring Metric</CardTitle>
                <CardDescription>
                  Metric used to evaluate and compare models
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="scoring-metric" className="text-sm font-medium">
                Primary Metric
              </Label>
              <Select
                value={config.scoring_metric}
                onValueChange={(value) =>
                  onChange({ ...config, scoring_metric: value })
                }
              >
                <SelectTrigger id="scoring-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scoringMetrics.map((metric) => (
                    <SelectItem key={metric.value} value={metric.value}>
                      <div>
                        <div className="font-semibold">{metric.label}</div>
                        <div className="text-xs text-neutral-600">{metric.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-600 mt-2">
                The best model will be selected based on this metric
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl">
        <div className="grid md:grid-cols-4 gap-4 text-sm text-indigo-900">
          <div>
            <span className="font-semibold">Task Type:</span>
            <br />
            {taskType.charAt(0).toUpperCase() + taskType.slice(1)}
          </div>
          <div>
            <span className="font-semibold">Validation:</span>
            <br />
            {config.validation_strategy === "cross_validation"
              ? `${config.cv_folds}-Fold CV`
              : `${(config.test_size * 100).toFixed(0)}% Holdout`}
          </div>
          <div>
            <span className="font-semibold">Metric:</span>
            <br />
            {scoringMetrics.find((m) => m.value === config.scoring_metric)?.label || config.scoring_metric}
          </div>
        </div>
      </div>
    </div>
  );
}
