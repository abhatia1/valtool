"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Grid3x3 } from "lucide-react";
import { EDAClient } from "@/lib/api/eda";
import type { VisualizationResponse } from "@/types/eda";

// Lazy load Plotly for performance
const Plot = lazy(() => import("react-plotly.js"));

interface Props {
  edaId: string;
}

export function CorrelationMatrix({ edaId }: Props) {
  const [vizData, setVizData] = useState<VisualizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCorrelationMatrix = async () => {
      try {
        setLoading(true);
        const data = await EDAClient.getCorrelationMatrix(edaId);
        setVizData(data);
      } catch (err: any) {
        console.error("Failed to fetch correlation matrix:", err);
        if (err.response?.status === 404) {
          setError("Correlation matrix not available (requires at least 2 numeric columns)");
        } else {
          setError("Failed to load correlation matrix");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCorrelationMatrix();
  }, [edaId]);

  const handleExport = () => {
    if (!vizData) return;

    const dataStr = JSON.stringify(vizData.plotly_json, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "correlation_matrix.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className="eda-card">
        <CardContent className="flex items-center justify-center h-[600px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
            <p className="text-sm text-slate-600 eda-mono">
              Loading correlation matrix...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !vizData) {
    return (
      <Card className="eda-card border-amber-200 bg-amber-50">
        <CardContent className="flex flex-col items-center justify-center h-[400px] gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Grid3x3 className="h-8 w-8 text-amber-600" />
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold eda-heading text-amber-800 mb-2">
              Correlation Matrix Unavailable
            </h3>
            <p className="text-sm text-amber-700 eda-mono">
              {error || "No correlation data available"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="eda-card group hover:shadow-lg transition-all duration-300">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-blue-100">
              <Grid3x3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl eda-heading">{vizData.title}</CardTitle>
              <p className="text-sm text-slate-600 eda-mono mt-1">
                Heatmap showing correlations between numeric features
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-slate-300 hover:border-cyan-400 hover:bg-cyan-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-[600px]">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
              </div>
            }
          >
            <Plot
              data={vizData.plotly_json.data}
              layout={{
                ...vizData.plotly_json.layout,
                height: 600,
                margin: { t: 40, b: 100, l: 100, r: 40 },
                paper_bgcolor: "rgba(255,255,255,1)",
                plot_bgcolor: "rgba(255,255,255,1)",
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
                  filename: "correlation_matrix",
                  height: 800,
                  width: 1000,
                  scale: 2,
                },
              }}
              className="w-full"
              style={{ width: "100%" }}
            />
          </Suspense>
        </div>
      </CardContent>
    </Card>
  );
}
