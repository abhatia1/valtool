"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { VisualizationResponse } from "@/types/visualizations";

// Dynamic import to avoid SSR issues with Plotly
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface VisualizationCardProps {
  title: string;
  fetchVisualization: () => Promise<VisualizationResponse>;
  height?: number;
  className?: string;
}

export function VisualizationCard({
  title,
  fetchVisualization,
  height = 600,
  className = "",
}: VisualizationCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vizData, setVizData] = useState<VisualizationResponse | null>(null);

  useEffect(() => {
    const loadVisualization = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchVisualization();
        setVizData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load visualization");
      } finally {
        setLoading(false);
      }
    };

    loadVisualization();
  }, [fetchVisualization]);

  return (
    <Card className={`shadow-lg ${className}`}>
      <CardHeader className="border-b">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading && (
          <div className="flex items-center justify-center" style={{ height }}>
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {vizData && !loading && !error && (
          <div className="flex justify-center">
            <Plot
              data={vizData.plotly_json.data as any}
              layout={{
                ...vizData.plotly_json.layout,
                autosize: true,
              } as any}
              config={{
                responsive: true,
                displayModeBar: true,
                displaylogo: false,
                modeBarButtonsToRemove: ["pan2d", "lasso2d", "select2d"],
              }}
              style={{ width: "100%", height }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
