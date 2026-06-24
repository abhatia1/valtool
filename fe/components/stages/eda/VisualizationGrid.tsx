"use client";

import { VisualizationCard } from "./VisualizationCard";

interface Props {
  edaId: string;
  category: "univariate" | "bivariate" | "outlier" | "dimensionality_reduction";
  count: number;
}

export function VisualizationGrid({ edaId, category, count }: Props) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <span className="text-3xl">📊</span>
        </div>
        <h3 className="text-lg font-semibold eda-heading text-slate-700 mb-2">
          No Visualizations
        </h3>
        <p className="text-sm text-slate-600 eda-mono text-center max-w-md">
          No {category} visualizations are available for this dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="eda-fade-in"
          style={{
            animationDelay: `${index * 0.05}s`,
          }}
        >
          <VisualizationCard edaId={edaId} category={category} index={index} />
        </div>
      ))}
    </div>
  );
}
