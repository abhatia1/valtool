"use client";

import { useState } from "react";
import { VisualizationCard } from "./VisualizationCard";
import { VisualizationAPI } from "@/lib/api/visualizations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelInfo {
  estimator_name: string;
  validation_score: number;
}

interface VisualizationGridProps {
  jobId: string;
  taskType: "classification" | "regression";
  models?: ModelInfo[];
  bestModelName?: string;
}

export function VisualizationGrid({
  jobId,
  taskType,
  models = [],
  bestModelName
}: VisualizationGridProps) {
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);

  // The actual estimator name to pass to API (undefined means best model)
  const estimatorName = selectedModel === "best" ? undefined : selectedModel;

  // Sort models by validation score (descending)
  const sortedModels = [...models].sort((a, b) => b.validation_score - a.validation_score);

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
            Best Model {bestModelName ? `(${bestModelName})` : ""}
          </SelectItem>
          {sortedModels.map((model) => (
            <SelectItem key={model.estimator_name} value={model.estimator_name}>
              {model.estimator_name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              {" "}({model.validation_score.toFixed(4)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;

  if (taskType === "classification") {
    return (
      <div>
        {modelSelector}
        <ClassificationVisualizations jobId={jobId} estimatorName={estimatorName} />
      </div>
    );
  } else if (taskType === "regression") {
    return (
      <div>
        {modelSelector}
        <RegressionVisualizations jobId={jobId} />
      </div>
    );
  }

  return null;
}

function ClassificationVisualizations({
  jobId,
  estimatorName
}: {
  jobId: string;
  estimatorName?: string;
}) {
  return (
    <Tabs defaultValue="confusion" className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-6">
        <TabsTrigger value="confusion">Confusion Matrix</TabsTrigger>
        <TabsTrigger value="roc">ROC Curves</TabsTrigger>
        <TabsTrigger value="pr">PR Curves</TabsTrigger>
        <TabsTrigger value="feature">Features</TabsTrigger>
        <TabsTrigger value="calibration">Calibration</TabsTrigger>
      </TabsList>

      <TabsContent value="confusion">
        <VisualizationCard
          key={`confusion-${estimatorName || 'best'}`}
          title="Confusion Matrix"
          fetchVisualization={() => VisualizationAPI.getConfusionMatrix(jobId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="roc">
        <VisualizationCard
          key={`roc-${estimatorName || 'best'}`}
          title="ROC Curves"
          fetchVisualization={() => VisualizationAPI.getROCCurves(jobId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="pr">
        <VisualizationCard
          key={`pr-${estimatorName || 'best'}`}
          title="Precision-Recall Curves"
          fetchVisualization={() => VisualizationAPI.getPRCurves(jobId, estimatorName)}
        />
      </TabsContent>

      <TabsContent value="feature">
        <VisualizationCard
          title="Feature Importance"
          fetchVisualization={() => VisualizationAPI.getFeatureImportance(jobId, 20)}
        />
      </TabsContent>

      <TabsContent value="calibration">
        <VisualizationCard
          key={`calibration-${estimatorName || 'best'}`}
          title="Calibration Plot"
          fetchVisualization={() => VisualizationAPI.getCalibrationPlot(jobId, estimatorName)}
        />
      </TabsContent>
    </Tabs>
  );
}

function RegressionVisualizations({ jobId }: { jobId: string }) {
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
          title="Predicted vs Actual"
          fetchVisualization={() => VisualizationAPI.getPredictedVsActual(jobId)}
        />
      </TabsContent>

      <TabsContent value="residual">
        <VisualizationCard
          title="Residual Plot"
          fetchVisualization={() => VisualizationAPI.getResidualPlot(jobId)}
        />
      </TabsContent>

      <TabsContent value="qq">
        <VisualizationCard
          title="Q-Q Plot (Normality Check)"
          fetchVisualization={() => VisualizationAPI.getQQPlot(jobId)}
        />
      </TabsContent>

      <TabsContent value="feature">
        <VisualizationCard
          title="Feature Importance"
          fetchVisualization={() => VisualizationAPI.getFeatureImportance(jobId, 20)}
        />
      </TabsContent>
    </Tabs>
  );
}
