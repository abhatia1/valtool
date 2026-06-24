"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FeatureImportanceChartProps {
  featureImportance: Record<string, number>;
  topN?: number;
}

export function FeatureImportanceChart({
  featureImportance,
  topN = 15,
}: FeatureImportanceChartProps) {
  // Sort features by importance and take top N
  const sortedFeatures = Object.entries(featureImportance)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  const maxImportance = Math.max(...sortedFeatures.map(([, value]) => value));

  // Color scale from light to dark blue
  const getBarColor = (value: number, index: number) => {
    const intensity = value / maxImportance;
    if (index === 0) return "bg-gradient-to-r from-amber-500 to-orange-500"; // Highlight top feature
    if (intensity > 0.7) return "bg-gradient-to-r from-blue-600 to-indigo-600";
    if (intensity > 0.4) return "bg-gradient-to-r from-blue-500 to-indigo-500";
    return "bg-gradient-to-r from-blue-400 to-indigo-400";
  };

  return (
    <Card className="training-card rounded-xl shadow-sm">
      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-slate-50/30">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" strokeWidth={2} />
          <CardTitle className="text-xl training-heading">Feature Importance</CardTitle>
        </div>
        <CardDescription>
          Top {topN} most influential features in the best model
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Alert className="mb-6 border-blue-200/60 bg-blue-50/50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Higher values indicate features that contribute more to the model's predictions
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {sortedFeatures.map(([feature, importance], index) => (
            <div
              key={feature}
              className="group"
              style={{
                animation: `slideIn 0.5s ease-out ${index * 0.05}s both`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {index === 0 && (
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                  <span className={`text-sm font-medium ${index === 0 ? "text-amber-700" : "text-slate-700"}`}>
                    {feature}
                  </span>
                </div>
                <span className="text-sm training-mono font-semibold text-slate-600">
                  {importance.toFixed(4)}
                </span>
              </div>
              <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden border border-slate-200/60">
                <div
                  className={`
                    h-full ${getBarColor(importance, index)}
                    transition-all duration-500 ease-out
                    group-hover:opacity-90
                    relative
                  `}
                  style={{
                    width: `${(importance / maxImportance) * 100}%`,
                  }}
                >
                  <div className="absolute inset-0 bg-white opacity-20" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/60 rounded-lg p-4 border border-blue-200/60">
            <div className="text-sm text-blue-700 font-medium">Total Features</div>
            <div className="text-2xl font-bold text-blue-900 training-mono">
              {Object.keys(featureImportance).length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 rounded-lg p-4 border border-amber-200/60">
            <div className="text-sm text-amber-700 font-medium">Top Feature</div>
            <div className="text-lg font-bold text-amber-900 truncate">
              {sortedFeatures[0]?.[0] || "N/A"}
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </CardContent>
    </Card>
  );
}
