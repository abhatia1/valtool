"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { configApi } from "@/lib/api/config";
import type {
  PreprocessingConfig,
  ScalingMethod,
  MissingStrategy,
  CategoricalEncoding,
  OutlierMethod,
} from "@/types/config";

interface PreprocessingPanelProps {
  config: PreprocessingConfig;
  onChange: (config: PreprocessingConfig) => void;
  datasetId?: string;
}

export function PreprocessingPanel({ config, onChange, datasetId }: PreprocessingPanelProps) {
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } | null>(null);

  useEffect(() => {
    if (!datasetId) return;

    const validateConfig = async () => {
      setValidating(true);
      try {
        const result = await configApi.validatePreprocessing({
          dataset_id: datasetId,
          preprocessing: config,
        });
        setValidation(result);
      } catch (err) {
        // Validation API call failed, ignore
      } finally {
        setValidating(false);
      }
    };

    // Debounce validation
    const timeout = setTimeout(validateConfig, 500);
    return () => clearTimeout(timeout);
  }, [config, datasetId]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl config-heading text-slate-900">
          Data Preprocessing
        </h2>
        <p className="text-slate-600 text-sm font-light tracking-wide">
          Configure how your data will be transformed before training
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Scaling Method */}
        <Card className="border border-slate-200 hover:shadow-sm transition-shadow">
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-base font-semibold text-slate-900">Scaling Method</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Normalize numerical features to improve model performance
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Select
              value={config.scaling_method}
              onValueChange={(value: ScalingMethod) =>
                onChange({ ...config, scaling_method: value })
              }
            >
              <SelectTrigger className="w-full h-11 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  <div>
                    <div className="font-semibold text-slate-900">Standard (Z-score)</div>
                    <div className="text-xs text-slate-600">Mean=0, StdDev=1</div>
                  </div>
                </SelectItem>
                <SelectItem value="minmax">
                  <div>
                    <div className="font-semibold text-slate-900">Min-Max</div>
                    <div className="text-xs text-slate-600">Scale to [0, 1]</div>
                  </div>
                </SelectItem>
                <SelectItem value="robust">
                  <div>
                    <div className="font-semibold text-slate-900">Robust (IQR)</div>
                    <div className="text-xs text-slate-600">Resistant to outliers</div>
                  </div>
                </SelectItem>
                <SelectItem value="none">
                  <div>
                    <div className="font-semibold text-slate-900">None</div>
                    <div className="text-xs text-slate-600">No scaling</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Missing Value Strategy */}
        <Card className="border border-slate-200 hover:shadow-sm transition-shadow">
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-base font-semibold text-slate-900">Missing Value Strategy</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Handle missing data in your dataset
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Select
              value={config.missing_strategy}
              onValueChange={(value: MissingStrategy) =>
                onChange({ ...config, missing_strategy: value })
              }
            >
              <SelectTrigger className="w-full h-11 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="median">
                  <div>
                    <div className="font-semibold text-slate-900">Median</div>
                    <div className="text-xs text-slate-600">Robust to outliers</div>
                  </div>
                </SelectItem>
                <SelectItem value="mean">
                  <div>
                    <div className="font-semibold text-slate-900">Mean</div>
                    <div className="text-xs text-slate-600">Average value</div>
                  </div>
                </SelectItem>
                <SelectItem value="mode">
                  <div>
                    <div className="font-semibold text-slate-900">Mode</div>
                    <div className="text-xs text-slate-600">Most frequent value</div>
                  </div>
                </SelectItem>
                <SelectItem value="knn">
                  <div>
                    <div className="font-semibold text-slate-900">KNN Imputation</div>
                    <div className="text-xs text-slate-600">Advanced, context-aware</div>
                  </div>
                </SelectItem>
                <SelectItem value="drop">
                  <div>
                    <div className="font-semibold text-slate-900">Drop Rows</div>
                    <div className="text-xs text-slate-600">Remove rows with missing data</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Categorical Encoding */}
        <Card className="border border-slate-200 hover:shadow-sm transition-shadow">
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-base font-semibold text-slate-900">Categorical Encoding</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Convert categorical variables to numerical format
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Select
              value={config.categorical_encoding}
              onValueChange={(value: CategoricalEncoding) =>
                onChange({ ...config, categorical_encoding: value })
              }
            >
              <SelectTrigger className="w-full h-11 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onehot">
                  <div>
                    <div className="font-semibold text-slate-900">One-Hot</div>
                    <div className="text-xs text-slate-600">Binary columns per category</div>
                  </div>
                </SelectItem>
                <SelectItem value="ordinal">
                  <div>
                    <div className="font-semibold text-slate-900">Ordinal</div>
                    <div className="text-xs text-slate-600">Integer encoding</div>
                  </div>
                </SelectItem>
                <SelectItem value="target">
                  <div>
                    <div className="font-semibold text-slate-900">Target Encoding</div>
                    <div className="text-xs text-slate-600">Based on target variable</div>
                  </div>
                </SelectItem>
                <SelectItem value="frequency">
                  <div>
                    <div className="font-semibold text-slate-900">Frequency</div>
                    <div className="text-xs text-slate-600">Based on occurrence count</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Outlier Handling */}
        <Card className="border border-slate-200 hover:shadow-sm transition-shadow">
          <CardHeader className="bg-slate-50">
            <CardTitle className="text-base font-semibold text-slate-900">Outlier Handling</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Detect and handle extreme values in your data
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="outliers" className="text-sm font-medium text-slate-900">
                Handle Outliers
              </Label>
              <Switch
                id="outliers"
                checked={config.handle_outliers}
                onCheckedChange={(checked) =>
                  onChange({ ...config, handle_outliers: checked })
                }
              />
            </div>

            {config.handle_outliers && (
              <div className="pt-2 animate-in fade-in duration-300">
                <Label className="text-sm mb-2 block text-slate-900">Detection Method</Label>
                <Select
                  value={config.outlier_method || "iqr"}
                  onValueChange={(value: OutlierMethod) =>
                    onChange({ ...config, outlier_method: value })
                  }
                >
                  <SelectTrigger className="w-full h-11 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iqr">
                      <div>
                        <div className="font-semibold text-slate-900">IQR Method</div>
                        <div className="text-xs text-slate-600">Interquartile range</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="zscore">
                      <div>
                        <div className="font-semibold text-slate-900">Z-Score</div>
                        <div className="text-xs text-slate-600">Standard deviations</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="isolation_forest">
                      <div>
                        <div className="font-semibold text-slate-900">Isolation Forest</div>
                        <div className="text-xs text-slate-600">ML-based detection</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation Results */}
      {validation && (
        <div className="space-y-3">
          {validation.suggestions.length > 0 && (
            <Alert className="border border-amber-200/60 bg-amber-50/50">
              <Sparkles className="h-5 w-5 text-amber-600" />
              <AlertDescription className="ml-2">
                <p className="font-semibold text-amber-900 mb-2 text-sm">Suggestions</p>
                <ul className="list-disc pl-5 space-y-1">
                  {validation.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-sm text-amber-800">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && (
            <Alert className="border border-orange-200/60 bg-orange-50/50">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <AlertDescription className="ml-2">
                <p className="font-semibold text-orange-900 mb-2 text-sm">Warnings</p>
                <ul className="list-disc pl-5 space-y-1">
                  {validation.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-orange-800">
                      {warning}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.valid && validation.errors.length === 0 && (
            <Alert className="border border-green-200/60 bg-green-50/50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertDescription className="ml-2">
                <p className="font-semibold text-green-900 text-sm">
                  Preprocessing configuration is valid
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
