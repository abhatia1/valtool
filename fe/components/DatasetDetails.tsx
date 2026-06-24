"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Database,
  Calendar,
  Hash,
  Columns3,
  AlertTriangle,
  FileText,
  Type,
  Loader2,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { datasetsApi } from "@/lib/api/datasets";
import { handleApiError } from "@/lib/api/errorHandler";
import type { Dataset, ColumnType } from "@/types/dataset";

interface DatasetDetailsProps {
  datasetId: string;
  onProceedToEDA?: () => void;
}

const columnTypeConfig: Record<ColumnType, { icon: typeof Hash; color: string; label: string }> = {
  numeric: { icon: Hash, color: "text-chart-1 bg-chart-1/10", label: "Numeric" },
  categorical: { icon: Type, color: "text-chart-2 bg-chart-2/10", label: "Categorical" },
  datetime: { icon: Calendar, color: "text-chart-3 bg-chart-3/10", label: "DateTime" },
  text: { icon: FileText, color: "text-chart-4 bg-chart-4/10", label: "Text" },
};

export function DatasetDetails({ datasetId, onProceedToEDA }: DatasetDetailsProps) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDataset = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await datasetsApi.getDetails(datasetId);
        setDataset(data);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDataset();
  }, [datasetId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !dataset) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Dataset not found"}</AlertDescription>
      </Alert>
    );
  }

  const totalMissing = Object.values(dataset.missing_values).reduce((sum, val) => sum + val, 0);
  const missingPercentage = (totalMissing / (dataset.rows * dataset.columns)) * 100;

  const typeDistribution = Object.values(dataset.column_types).reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-primary/10 p-3">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display text-3xl">{dataset.name}</CardTitle>
                {dataset.description && (
                  <CardDescription className="mt-2 max-w-2xl text-base">
                    {dataset.description}
                  </CardDescription>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="font-mono">
              {dataset.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Total Rows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">
              {dataset.rows.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Columns3 className="h-4 w-4" />
              Columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">{dataset.columns}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Uploaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatDistanceToNow(new Date(dataset.uploaded_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Missing Values
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">
              {missingPercentage.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <Tabs defaultValue="columns" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="columns">Column Information</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="columns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Column Types Distribution</CardTitle>
              <CardDescription>
                Overview of data types across your dataset
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(typeDistribution).map(([type, count]) => {
                  const config = columnTypeConfig[type as ColumnType];
                  const Icon = config.icon;
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-3 rounded-lg border p-4"
                    >
                      <div className={`rounded-md p-2 ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-sm text-muted-foreground">{config.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">All Columns</CardTitle>
              <CardDescription>
                Detailed view of each column in your dataset
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dataset.column_names.map((column, index) => {
                  const type = dataset.column_types[column];
                  const missing = dataset.missing_values[column] || 0;
                  const missingPct = (missing / dataset.rows) * 100;
                  const config = columnTypeConfig[type];
                  const Icon = config.icon;

                  return (
                    <div
                      key={column}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                      style={{
                        animationDelay: `${index * 30}ms`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-md p-2 ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold">{column}</p>
                          <Badge variant="outline" className="mt-1 font-mono text-xs">
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {missing > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-32">
                              <Progress
                                value={100 - missingPct}
                                className="h-2"
                              />
                            </div>
                            <span className="w-20 text-right font-mono text-sm text-muted-foreground">
                              {missing.toLocaleString()} missing
                            </span>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="font-mono text-xs">
                            No missing
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Data Quality Summary</CardTitle>
              <CardDescription>
                Overall assessment of your dataset quality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Completeness</span>
                  <span className="font-mono text-sm font-semibold">
                    {(100 - missingPercentage).toFixed(1)}%
                  </span>
                </div>
                <Progress value={100 - missingPercentage} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {totalMissing.toLocaleString()} missing values out of{" "}
                  {(dataset.rows * dataset.columns).toLocaleString()} total cells
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold">Columns with Missing Data</h4>
                {Object.entries(dataset.missing_values)
                  .filter(([_, count]) => count > 0)
                  .sort(([_, a], [__, b]) => b - a)
                  .map(([column, count]) => {
                    const percentage = (count / dataset.rows) * 100;
                    return (
                      <div key={column} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{column}</span>
                          <span className="font-mono text-muted-foreground">
                            {count.toLocaleString()} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress
                          value={percentage}
                          className={`h-2 ${
                            percentage > 50
                              ? "[&>div]:bg-destructive"
                              : percentage > 25
                              ? "[&>div]:bg-accent"
                              : "[&>div]:bg-secondary"
                          }`}
                        />
                      </div>
                    );
                  })}
                {Object.values(dataset.missing_values).every((count) => count === 0) && (
                  <div className="flex items-center gap-2 rounded-lg border border-secondary/50 bg-secondary/5 p-4">
                    <TrendingUp className="h-5 w-5 text-secondary" />
                    <p className="text-sm font-medium">
                      Excellent! No missing values detected in this dataset.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
