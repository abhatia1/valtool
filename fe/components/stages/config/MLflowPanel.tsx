"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";
import type { MLflowConfig } from "@/types/config";

interface MLflowPanelProps {
  config: MLflowConfig;
  onChange: (config: MLflowConfig) => void;
}

export function MLflowPanel({ config, onChange }: MLflowPanelProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          MLflow Configuration
        </h2>
        <p className="text-neutral-600 text-lg">
          Configure experiment tracking (optional)
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Experiment Tracking</CardTitle>
          <CardDescription>
            MLflow tracks metrics, parameters, and artifacts during training
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable MLflow */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mlflow-enabled" className="text-base font-semibold">
                Enable MLflow
              </Label>
              <p className="text-sm text-neutral-600">
                Track experiments and compare model performance
              </p>
            </div>
            <Switch
              id="mlflow-enabled"
              checked={config.enabled}
              onCheckedChange={(enabled) => onChange({ ...config, enabled })}
            />
          </div>

          {config.enabled && (
            <>
              {/* Auto Logging */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-log" className="text-base font-semibold">
                    Auto Log
                  </Label>
                  <p className="text-sm text-neutral-600">
                    Automatically log metrics and parameters
                  </p>
                </div>
                <Switch
                  id="auto-log"
                  checked={config.auto_log}
                  onCheckedChange={(auto_log) => onChange({ ...config, auto_log })}
                />
              </div>

              {/* Experiment Name */}
              <div className="space-y-2">
                <Label htmlFor="experiment-name" className="text-base font-semibold">
                  Experiment Name (Optional)
                </Label>
                <Input
                  id="experiment-name"
                  placeholder="Leave empty to auto-generate"
                  value={config.experiment_name || ""}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      experiment_name: e.target.value || undefined,
                    })
                  }
                  className="h-11"
                />
                <p className="text-sm text-neutral-600">
                  If not provided, will auto-generate as: dataset_tasktype_timestamp
                </p>
              </div>

              {/* Info Alert */}
              <Alert className="bg-blue-50 border-blue-200">
                <InfoIcon className="h-4 w-4 text-blue-600" />
                <AlertDescription className="ml-2 text-blue-800 text-sm">
                  MLflow helps you track experiments, compare models, and reproduce results.
                  All training runs will be logged to the MLflow tracking server.
                </AlertDescription>
              </Alert>
            </>
          )}

          {!config.enabled && (
            <Alert className="bg-amber-50 border-amber-200">
              <InfoIcon className="h-4 w-4 text-amber-600" />
              <AlertDescription className="ml-2 text-amber-800 text-sm">
                MLflow tracking is disabled. Training will continue without experiment tracking.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
