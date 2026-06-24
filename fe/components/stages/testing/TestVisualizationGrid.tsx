"use client";

import { useState } from "react";
import { VisualizationCard } from "../training/VisualizationCard";
import { TestVisualizationAPI } from "@/lib/api/visualizations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3 } from "lucide-react";

interface ModelInfo {
  estimator_name: string;
  test_metrics?: Record<string, number | number[][]>;
  validation_score?: number;
}

interface TestVisualizationGridProps {
  testRunId: string;
  taskType: "classification" | "regression";
  models?: ModelInfo[];
  bestModelName?: string;
}

function EmptyVisualizationState() {
  return (
    <div className="text-center py-12">
      <BarChart3 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
      <p className="text-slate-500 text-lg">No visualizations available</p>
      <p className="text-slate-400 text-sm mt-2">
        Visualizations are generated for models tested on your data
      </p>
    </div>
  );
}

export function TestVisualizationGrid({
  testRunId,
  taskType,
  models = [],
  bestModelName,
}: TestVisualizationGridProps) {
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);

  // The actual estimator name to pass to API (undefined means best model)
  const estimatorName = selectedModel === "best" ? undefined : selectedModel;

  // Sort models by test accuracy/r2 (descending)
  const sortedModels = [...models].sort((a, b) => {
    const metricKey = taskType === "classification" ? "accuracy" : "r2";
    const aMetric = a.test_metrics?.[metricKey];
    const bMetric = b.test_metrics?.[metricKey];
    const aScore = typeof aMetric === "number" ? aMetric : (a.validation_score ?? 0);
    const bScore = typeof bMetric === "number" ? bMetric : (b.validation_score ?? 0);
    return bScore - aScore;
  });

  // If no test run ID, show empty state
  if (!testRunId) {
    return <EmptyVisualizationState />;
  }

  const modelSelector = models.length > 0 ? (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm font-medium text-slate-700">View model:</span>
      <Select
        value={selectedModel || "best"}
        onValueChange={(value) => setSelectedModel(value === "best" ? undefined : value)}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="best">
            Best Test Model {bestModelName ? `(${bestModelName})` : ""}
          </SelectItem>
          {sortedModels.map((model) => {
            const metricKey = taskType === "classification" ? "accuracy" : "r2";
            const metric = model.test_metrics?.[metricKey];
            const score = typeof metric === "number" ? metric : (model.validation_score ?? 0);
            return (
              <SelectItem key={model.estimator_name} value={model.estimator_name}>
                {model.estimator_name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                {" "}({score.toFixed(4)})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  ) : null;

  if (taskType === "classification") {
    return (
      <div>
        {modelSelector}
        <ClassificationTestVisualizations testRunId={testRunId} estimatorName={estimatorName} />
      </div>
    );
  } else if (taskType === "regression") {
    return (
      <div>
        {modelSelector}
        <RegressionTestVisualizations testRunId={testRunId} estimatorName={estimatorName} />
      </div>
    );
  }

  return null;
}

function ClassificationTestVisualizations({
  testRunId,
  estimatorName,
}: {
  testRunId: string;
  estimatorName?: string;
}) {
  return (
    <Tabs defaultValue="confusion" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="confusion">Confusion Matrix</TabsTrigger>
        <TabsTrigger value="roc">ROC Curves</TabsTrigger>
        <TabsTrigger value="pr">PR Curves</TabsTrigger>
        <TabsTrigger value="feature">Features</TabsTrigger>
      </TabsList>

      <TabsContent value="confusion">
        <VisualizationCard
          key={`test-confusion-${testRunId}-${estimatorName || "best"}`}
          title="Confusion Matrix (Test Data)"
          fetchVisualization={() => TestVisualizationAPI.getConfusionMatrix(testRunId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="roc">
        <VisualizationCard
          key={`test-roc-${testRunId}-${estimatorName || "best"}`}
          title="ROC Curves (Test Data)"
          fetchVisualization={() => TestVisualizationAPI.getROCCurves(testRunId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="pr">
        <VisualizationCard
          key={`test-pr-${testRunId}-${estimatorName || "best"}`}
          title="Precision-Recall Curves (Test Data)"
          fetchVisualization={() => TestVisualizationAPI.getPRCurves(testRunId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="feature">
        <VisualizationCard
          key={`test-feature-${testRunId}-${estimatorName || "best"}`}
          title="Feature Importance"
          fetchVisualization={() => TestVisualizationAPI.getFeatureImportance(testRunId, estimatorName, 20)}
        />
      </TabsContent>
    </Tabs>
  );
}

function RegressionTestVisualizations({
  testRunId,
  estimatorName,
}: {
  testRunId: string;
  estimatorName?: string;
}) {
  return (
    <Tabs defaultValue="predicted" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="predicted">Predicted vs Actual</TabsTrigger>
        <TabsTrigger value="residual">Residuals</TabsTrigger>
        <TabsTrigger value="qq">Q-Q Plot</TabsTrigger>
        <TabsTrigger value="feature">Features</TabsTrigger>
      </TabsList>

      <TabsContent value="predicted">
        <VisualizationCard
          key={`test-predicted-${testRunId}-${estimatorName || "best"}`}
          title="Predicted vs Actual (Test Data)"
          fetchVisualization={() => TestVisualizationAPI.getPredictedVsActual(testRunId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="residual">
        <VisualizationCard
          key={`test-residual-${testRunId}-${estimatorName || "best"}`}
          title="Residual Plot (Test Data)"
          fetchVisualization={() => TestVisualizationAPI.getResidualPlot(testRunId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="qq">
        <VisualizationCard
          key={`test-qq-${testRunId}-${estimatorName || "best"}`}
          title="Q-Q Plot (Test Data)"
          fetchVisualization={() => TestVisualizationAPI.getQQPlot(testRunId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="feature">
        <VisualizationCard
          key={`test-feature-${testRunId}-${estimatorName || "best"}`}
          title="Feature Importance"
          fetchVisualization={() => TestVisualizationAPI.getFeatureImportance(testRunId, estimatorName, 20)}
        />
      </TabsContent>
    </Tabs>
  );
}
