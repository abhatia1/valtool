"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Settings,
  Cpu,
  Target,
  Zap,
} from "lucide-react";
import type { TrainingConfigCreate } from "@/types/config";

interface ConfigurationSummaryProps {
  config: TrainingConfigCreate;
  estimatedTime?: number;
  warnings?: string[];
}

export function ConfigurationSummary({
  config,
  estimatedTime,
  warnings = [],
}: ConfigurationSummaryProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          Configuration Summary
        </h2>
        <p className="text-neutral-600 text-lg">
          Review your training configuration before proceeding
        </p>
      </div>

      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 text-white rounded-lg">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-600">Task Type</p>
                <p className="text-lg font-bold text-neutral-900 capitalize">
                  {config.task_type}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 text-white rounded-lg">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-600">Target Column</p>
                <p className="text-lg font-bold text-neutral-900 truncate">
                  {config.target_column}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 text-white rounded-lg">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-600">Estimators</p>
                <p className="text-lg font-bold text-neutral-900">
                  {config.model_selection.estimators.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {estimatedTime !== undefined && (
          <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 text-white rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-600">Est. Time</p>
                  <p className="text-lg font-bold text-neutral-900">
                    {formatTime(estimatedTime)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Configuration Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Preprocessing */}
        <Card className="border-2 border-neutral-200">
          <CardHeader className="bg-gradient-to-br from-blue-50 to-cyan-50">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Preprocessing</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Scaling</span>
              <Badge variant="outline" className="capitalize">
                {config.preprocessing.scaling_method}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Missing Values</span>
              <Badge variant="outline" className="capitalize">
                {config.preprocessing.missing_strategy}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Categorical</span>
              <Badge variant="outline" className="capitalize">
                {config.preprocessing.categorical_encoding}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Outliers</span>
              <Badge
                variant={config.preprocessing.handle_outliers ? "default" : "outline"}
                className={config.preprocessing.handle_outliers ? "bg-green-600" : ""}
              >
                {config.preprocessing.handle_outliers
                  ? config.preprocessing.outlier_method || "Enabled"
                  : "Disabled"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Feature Engineering */}
        <Card className="border-2 border-neutral-200">
          <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Feature Engineering</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Polynomial Features</span>
              <Badge
                variant={config.feature_engineering.polynomial_features ? "default" : "outline"}
                className={config.feature_engineering.polynomial_features ? "bg-purple-600" : ""}
              >
                {config.feature_engineering.polynomial_features
                  ? `Degree ${config.feature_engineering.polynomial_degree || 2}`
                  : "Disabled"}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Feature Selection</span>
              <Badge
                variant={config.feature_engineering.feature_selection ? "default" : "outline"}
                className={config.feature_engineering.feature_selection ? "bg-purple-600" : ""}
              >
                {config.feature_engineering.feature_selection
                  ? `Top ${config.feature_engineering.n_features || 20}`
                  : "Disabled"}
              </Badge>
            </div>
            {config.feature_engineering.feature_selection && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Method</span>
                  <Badge variant="outline" className="capitalize">
                    {config.feature_engineering.selection_method?.replace(/_/g, " ") || "SelectKBest"}
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Model Selection */}
        <Card className="border-2 border-neutral-200">
          <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg">Model Selection</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">CV Folds</span>
              <Badge className="bg-green-600">
                {config.model_selection.cv_folds}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Scoring Metric</span>
              <Badge variant="outline" className="uppercase">
                {config.model_selection.scoring_metric}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Estimators</span>
              <Badge className="bg-green-600">
                {config.model_selection.estimators.length} Selected
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Hyperparameter Tuning */}
        <Card className="border-2 border-neutral-200">
          <CardHeader className="bg-gradient-to-br from-orange-50 to-red-50">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-lg">Hyperparameter Tuning</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">Search Method</span>
              <Badge className="bg-orange-600 capitalize">
                {config.hyperparameter_tuning.search_method}
              </Badge>
            </div>
            {(config.hyperparameter_tuning.search_method === "random" ||
              config.hyperparameter_tuning.search_method === "bayesian") && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Iterations</span>
                  <Badge variant="outline">
                    {config.hyperparameter_tuning.n_iter || 10}
                  </Badge>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-neutral-600">MLflow Tracking</span>
              <Badge
                variant={config.mlflow.enabled ? "default" : "outline"}
                className={config.mlflow.enabled ? "bg-orange-600" : ""}
              >
                {config.mlflow.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert className="border-2 border-amber-300 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-900 font-semibold ml-2">
            Configuration Warnings
          </AlertTitle>
          <AlertDescription className="ml-2 mt-2">
            <ul className="list-disc pl-5 space-y-1">
              {warnings.map((warning, i) => (
                <li key={i} className="text-sm text-amber-800">
                  {warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {warnings.length === 0 && (
        <Alert className="border-2 border-green-300 bg-green-50">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="ml-2">
            <p className="font-semibold text-green-900">
              Configuration is ready! Click "Create Configuration" to proceed.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
