"use client";

import { useState, useEffect } from "react";
import { Hash, Type, X, Loader2, AlertCircle, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { datasetsApi } from "@/lib/api/datasets";
import { handleApiError } from "@/lib/api/errorHandler";
import type { ColumnStats as ColumnStatsType } from "@/types/dataset";

interface ColumnStatsProps {
  datasetId: string;
  columnName: string;
  open: boolean;
  onClose: () => void;
}

export function ColumnStats({ datasetId, columnName, open, onClose }: ColumnStatsProps) {
  const [stats, setStats] = useState<ColumnStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !columnName) return;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await datasetsApi.getColumnStats(datasetId, columnName);
        setStats(data);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [datasetId, columnName, open]);

  const renderNumericStats = (stats: ColumnStatsType & { type: "numeric" }) => {
    const statItems = [
      { label: "Mean", value: stats.mean?.toFixed(2) ?? "N/A" },
      { label: "Std Dev", value: stats.std?.toFixed(2) ?? "N/A" },
      { label: "Min", value: stats.min?.toFixed(2) ?? "N/A" },
      { label: "Max", value: stats.max?.toFixed(2) ?? "N/A" },
      { label: "Median", value: stats.median?.toFixed(2) ?? "N/A" },
      { label: "Q25", value: stats.q25?.toFixed(2) ?? "N/A" },
      { label: "Q75", value: stats.q75?.toFixed(2) ?? "N/A" },
    ];

    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statItems.map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCategoricalStats = (stats: ColumnStatsType & { type: "categorical" | "text" }) => {
    const chartData = Object.entries(stats.most_common).map(([value, count]) => ({
      value: value.length > 20 ? value.substring(0, 20) + "..." : value,
      count,
    }));

    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Unique Values</p>
            <p className="mt-1 font-display text-3xl font-bold">
              {stats.unique_count.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Most Common</p>
            <p className="mt-1 font-display text-3xl font-bold">
              {Object.keys(stats.most_common)[0] || "N/A"}
            </p>
            <p className="text-sm text-muted-foreground">
              {Object.values(stats.most_common)[0]?.toLocaleString() || "0"} occurrences
            </p>
          </div>
        </div>

        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top 10 Most Common Values</CardTitle>
              <CardDescription>Distribution of the most frequent values</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="value"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {stats?.type === "numeric" ? (
                <div className="rounded-md bg-chart-1/10 p-2">
                  <Hash className="h-5 w-5 text-chart-1" />
                </div>
              ) : (
                <div className="rounded-md bg-chart-2/10 p-2">
                  <Type className="h-5 w-5 text-chart-2" />
                </div>
              )}
              <div>
                <DialogTitle className="font-display text-2xl">{columnName}</DialogTitle>
                {stats && (
                  <DialogDescription className="mt-1">
                    <Badge variant="outline" className="font-mono">
                      {stats.type}
                    </Badge>
                  </DialogDescription>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : stats ? (
          <div className="space-y-6 pt-4">
            {/* Overview Section */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Count</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {stats.total_count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Missing Count</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {stats.missing_count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">Missing %</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {stats.missing_percentage.toFixed(1)}%
                </p>
              </div>
            </div>

            <Separator />

            {/* Type-specific Statistics */}
            {stats.type === "numeric"
              ? renderNumericStats(stats)
              : renderCategoricalStats(stats)}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
