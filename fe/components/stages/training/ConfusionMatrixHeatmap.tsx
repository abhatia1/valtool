"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Grid3x3, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConfusionMatrixHeatmapProps {
  matrix: number[][];
  classLabels?: string[];
}

export function ConfusionMatrixHeatmap({
  matrix,
  classLabels,
}: ConfusionMatrixHeatmapProps) {
  const numClasses = matrix.length;
  const labels = classLabels || Array.from({ length: numClasses }, (_, i) => `Class ${i}`);

  // Find max value for color scaling
  const maxValue = Math.max(...matrix.flat());

  // Get color intensity based on value
  const getCellColor = (value: number, isCorrect: boolean) => {
    const intensity = value / maxValue;
    if (isCorrect) {
      // Diagonal (correct predictions) - green scale
      if (intensity > 0.7) return "bg-green-600";
      if (intensity > 0.4) return "bg-green-500";
      if (intensity > 0.2) return "bg-green-400";
      return "bg-green-300";
    } else {
      // Off-diagonal (incorrect predictions) - red scale
      if (intensity > 0.7) return "bg-red-600";
      if (intensity > 0.4) return "bg-red-500";
      if (intensity > 0.2) return "bg-red-400";
      if (intensity > 0) return "bg-red-300";
      return "bg-slate-100";
    }
  };

  const getTextColor = (value: number, isCorrect: boolean) => {
    const intensity = value / maxValue;
    if (intensity > 0.4) return "text-white";
    return isCorrect ? "text-green-900" : "text-red-900";
  };

  // Calculate accuracy per class
  const getClassAccuracy = (classIndex: number) => {
    const total = matrix[classIndex].reduce((sum, val) => sum + val, 0);
    const correct = matrix[classIndex][classIndex];
    return total > 0 ? (correct / total) * 100 : 0;
  };

  return (
    <Card className="training-card rounded-xl shadow-sm">
      <CardHeader className="bg-gradient-to-r from-green-50/50 to-emerald-50/30">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-5 w-5 text-green-600" strokeWidth={2} />
          <CardTitle className="text-xl training-heading">Confusion Matrix</CardTitle>
        </div>
        <CardDescription>
          Visualization of prediction accuracy across classes
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Alert className="mb-6 border-green-200/60 bg-green-50/50">
          <Info className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 text-sm">
            Diagonal (green) shows correct predictions. Off-diagonal (red) shows misclassifications.
          </AlertDescription>
        </Alert>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Matrix */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `auto repeat(${numClasses}, 1fr)` }}>
              {/* Top left corner - empty */}
              <div />

              {/* Column headers (Predicted) */}
              {labels.map((label, i) => (
                <div
                  key={`col-${i}`}
                  className="text-center font-semibold text-sm text-slate-700 pb-2"
                  style={{
                    animation: `fadeIn 0.5s ease-out ${i * 0.05}s both`,
                  }}
                >
                  <div className="transform -rotate-45 origin-center whitespace-nowrap">
                    {label}
                  </div>
                </div>
              ))}

              {/* Matrix rows */}
              {matrix.map((row, i) => (
                <div
                  key={`row-${i}`}
                  className="contents"
                  style={{
                    animation: `fadeIn 0.5s ease-out ${i * 0.05}s both`,
                  }}
                >
                  {/* Row header (Actual) */}
                  <div className="flex items-center justify-end pr-3 font-semibold text-sm text-slate-700">
                    {labels[i]}
                  </div>

                  {/* Matrix cells */}
                  {row.map((value, j) => {
                    const isCorrect = i === j;
                    return (
                      <div
                        key={`cell-${i}-${j}`}
                        className={`
                          ${getCellColor(value, isCorrect)}
                          ${getTextColor(value, isCorrect)}
                          rounded-lg border border-slate-300
                          flex items-center justify-center
                          font-bold text-lg training-mono
                          transition-all duration-300
                          hover:scale-105 hover:shadow-md
                          cursor-pointer
                          min-h-[60px]
                        `}
                        title={`Actual: ${labels[i]}, Predicted: ${labels[j]}, Count: ${value}`}
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-slate-700 training-heading">Per-Class Accuracy</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {labels.map((label, i) => (
                  <div
                    key={`accuracy-${i}`}
                    className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200/60"
                    style={{
                      animation: `slideUp 0.5s ease-out ${i * 0.05}s both`,
                    }}
                  >
                    <div className="text-xs text-slate-600 mb-1">{label}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                          style={{ width: `${getClassAccuracy(i)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-700 training-mono">
                        {getClassAccuracy(i).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Axis Labels */}
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
              <div className="bg-blue-50/80 rounded-lg p-3 border border-blue-200/60">
                <div className="text-sm font-semibold text-blue-700">
                  Vertical Axis: Actual Labels
                </div>
              </div>
              <div className="bg-purple-50/80 rounded-lg p-3 border border-purple-200/60">
                <div className="text-sm font-semibold text-purple-700">
                  Horizontal Axis: Predicted Labels
                </div>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </CardContent>
    </Card>
  );
}
