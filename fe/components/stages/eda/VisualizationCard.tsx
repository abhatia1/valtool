"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { EDAClient } from "@/lib/api/eda";
import type { VisualizationResponse } from "@/types/eda";

// Lazy load Plotly for performance
const Plot = lazy(() => import("react-plotly.js"));

interface Props {
  edaId: string;
  category: "univariate" | "bivariate" | "outlier" | "dimensionality_reduction";
  index: number;
}

export function VisualizationCard({ edaId, category, index }: Props) {
  const [vizData, setVizData] = useState<VisualizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisualization = async () => {
      try {
        setLoading(true);
        const data = await EDAClient.getVisualization(edaId, category, index);
        setVizData(data);
      } catch (err: any) {
        console.error("Failed to fetch visualization:", err);
        setError("Failed to load visualization");
      } finally {
        setLoading(false);
      }
    };

    fetchVisualization();
  }, [edaId, category, index]);

  const handleExport = () => {
    if (!vizData) return;

    // Create a download link for the plotly JSON
    const dataStr = JSON.stringify(vizData.plotly_json, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${vizData.title.replace(/\s+/g, "_")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className="eda-card">
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            <p className="text-sm text-slate-600 eda-mono">Loading visualization...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !vizData) {
    return (
      <Card className="eda-card border-amber-200 bg-amber-50">
        <CardContent className="flex items-center justify-center h-[400px]">
          <p className="text-sm text-amber-700 eda-mono">{error || "No data available"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="eda-card group hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base eda-heading text-slate-800 flex-1">
            {vizData.title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 eda-mono mt-1">{vizData.viz_type}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-[350px]">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          }
        >
          <Plot
            data={vizData.plotly_json.data}
            layout={{
              ...vizData.plotly_json.layout,
              height: 350,
              margin: { t: 20, b: 40, l: 50, r: 20 },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: {
                family: "JetBrains Mono, monospace",
                size: 11,
                color: "#475569",
              },
            }}
            config={{
              responsive: true,
              displayModeBar: true,
              displaylogo: false,
              modeBarButtonsToRemove: ["lasso2d", "select2d"],
              toImageButtonOptions: {
                format: "png",
                filename: vizData.title.replace(/\s+/g, "_"),
                height: 600,
                width: 800,
                scale: 2,
              },
            }}
            className="w-full"
            style={{ width: "100%" }}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
