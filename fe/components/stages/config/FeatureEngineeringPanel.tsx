"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cpu, Filter } from "lucide-react";
import type { FeatureEngineeringConfig, SelectionMethod } from "@/types/config";

interface FeatureEngineeringPanelProps {
  config: FeatureEngineeringConfig;
  onChange: (config: FeatureEngineeringConfig) => void;
}

export function FeatureEngineeringPanel({ config, onChange }: FeatureEngineeringPanelProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          Feature Engineering
        </h2>
        <p className="text-neutral-600 text-lg">
          Create and select features to improve model performance
        </p>
      </div>

      <div className="grid gap-6">
        {/* Polynomial Features */}
        <Card className="border-2 border-neutral-200 hover:shadow-lg transition-all overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
          <CardHeader className="bg-gradient-to-br from-violet-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500 text-white rounded-lg">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Polynomial Features</CardTitle>
                <CardDescription>
                  Generate interaction and polynomial features
                </CardDescription>
              </div>
              <Switch
                checked={config.polynomial_features}
                onCheckedChange={(checked) =>
                  onChange({ ...config, polynomial_features: checked })
                }
              />
            </div>
          </CardHeader>
          {config.polynomial_features && (
            <CardContent className="pt-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="poly-degree" className="text-sm font-medium">
                  Polynomial Degree (2-5)
                </Label>
                <Input
                  id="poly-degree"
                  type="number"
                  min={2}
                  max={5}
                  value={config.polynomial_degree || 2}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      polynomial_degree: parseInt(e.target.value) || 2,
                    })
                  }
                  className="max-w-xs"
                />
                <p className="text-xs text-neutral-600">
                  Higher degrees create more features but may lead to overfitting
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Feature Selection */}
        <Card className="border-2 border-neutral-200 hover:shadow-lg transition-all overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
          <CardHeader className="bg-gradient-to-br from-teal-50 to-cyan-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500 text-white rounded-lg">
                <Filter className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Feature Selection</CardTitle>
                <CardDescription>
                  Automatically select the most important features
                </CardDescription>
              </div>
              <Switch
                checked={config.feature_selection}
                onCheckedChange={(checked) =>
                  onChange({ ...config, feature_selection: checked })
                }
              />
            </div>
          </CardHeader>
          {config.feature_selection && (
            <CardContent className="pt-6 space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <Label htmlFor="selection-method" className="text-sm font-medium">
                  Selection Method
                </Label>
                <Select
                  value={config.selection_method || "selectkbest"}
                  onValueChange={(value: SelectionMethod) =>
                    onChange({ ...config, selection_method: value })
                  }
                >
                  <SelectTrigger id="selection-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selectkbest">
                      <div>
                        <div className="font-semibold">Select K Best</div>
                        <div className="text-xs text-neutral-600">Statistical scoring</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="mutual_info">
                      <div>
                        <div className="font-semibold">Mutual Information</div>
                        <div className="text-xs text-neutral-600">Dependency measure</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="tree_based">
                      <div>
                        <div className="font-semibold">Tree-Based</div>
                        <div className="text-xs text-neutral-600">Feature importance</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="n-features" className="text-sm font-medium">
                  Number of Features
                </Label>
                <Input
                  id="n-features"
                  type="number"
                  min={1}
                  value={config.n_features || 20}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      n_features: parseInt(e.target.value) || 20,
                    })
                  }
                  className="max-w-xs"
                />
                <p className="text-xs text-neutral-600">
                  Maximum number of features to select
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Info Box */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Tip:</span> Feature engineering can significantly
          improve model performance, but be cautious of creating too many features which may
          lead to overfitting.
        </p>
      </div>
    </div>
  );
}
