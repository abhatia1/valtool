"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  BarChart3,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import dynamic from "next/dynamic";
import { MonitoringAPI } from "@/lib/api/monitoring";
import {
  MonitoringDashboard,
  DriftReportResponse,
  HealthStatus,
  PerformanceResponse,
} from "@/types/monitoring";
import { LucideIcon } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface MonitoringStageProps {
  jobId: string;
}

export function MonitoringStage({ jobId }: MonitoringStageProps) {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await MonitoringAPI.getDashboard(jobId);
      setDashboard(data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load dashboard";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      {/* Health Status Header */}
      <HealthStatusCard
        status={dashboard.health_status}
        jobName={dashboard.job_name}
        onRefresh={loadDashboard}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Monitoring"
          icon={Activity}
          items={[
            { label: "Batches", value: dashboard.monitoring_summary.total_batches },
            {
              label: "Rows",
              value: dashboard.monitoring_summary.total_rows_monitored.toLocaleString(),
            },
          ]}
        />
        <SummaryCard
          title="Drift"
          icon={BarChart3}
          items={[
            {
              label: "Detected",
              value: dashboard.drift_summary.overall_drift_detected ? "Yes" : "No",
            },
            { label: "Severity", value: dashboard.drift_summary.drift_severity },
          ]}
          variant={
            dashboard.drift_summary.overall_drift_detected ? "warning" : "default"
          }
        />
        <SummaryCard
          title="Alerts"
          icon={AlertTriangle}
          items={[
            { label: "Critical", value: dashboard.alerts_summary.critical_count },
            { label: "Warning", value: dashboard.alerts_summary.warning_count },
          ]}
          variant={
            dashboard.alerts_summary.critical_count > 0 ? "danger" : "default"
          }
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="drift" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="drift">Drift Detection</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="upload">Upload Data</TabsTrigger>
        </TabsList>

        <TabsContent value="drift" className="mt-4">
          <DriftSection jobId={jobId} onRefresh={loadDashboard} />
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <PerformanceSection jobId={jobId} />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertsSection
            alerts={dashboard.recent_alerts}
            onRefresh={loadDashboard}
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <UploadSection jobId={jobId} onUploadComplete={loadDashboard} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Health Status Card Component
function HealthStatusCard({
  status,
  jobName,
  onRefresh,
}: {
  status: HealthStatus;
  jobName: string;
  onRefresh: () => void;
}) {
  const statusConfig = {
    healthy: { color: "bg-emerald-500", icon: CheckCircle, text: "Healthy" },
    caution: { color: "bg-yellow-500", icon: AlertTriangle, text: "Caution" },
    warning: { color: "bg-orange-500", icon: AlertTriangle, text: "Warning" },
    critical: { color: "bg-red-500", icon: XCircle, text: "Critical" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 ${config.color} rounded-full flex items-center justify-center`}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{jobName}</h2>
            <p className="text-slate-500">Status: {config.text}</p>
          </div>
        </div>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  icon: Icon,
  items,
  variant = "default",
}: {
  title: string;
  icon: LucideIcon;
  items: { label: string; value: string | number }[];
  variant?: "default" | "warning" | "danger";
}) {
  const borderColor =
    variant === "danger"
      ? "border-red-200"
      : variant === "warning"
        ? "border-yellow-200"
        : "border-slate-200";

  return (
    <Card className={`border-2 ${borderColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Drift Section Component
function DriftSection({
  jobId,
  onRefresh,
}: {
  jobId: string;
  onRefresh: () => void;
}) {
  const [driftReport, setDriftReport] = useState<DriftReportResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDriftDetection = async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const report = await MonitoringAPI.detectDrift(jobId, batchId);
      setDriftReport(report);
      onRefresh();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Drift detection failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Drift Analysis</CardTitle>
        <CardDescription>
          Statistical comparison between training data and production data
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {driftReport ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge
                variant={
                  driftReport.overall_drift_detected ? "destructive" : "default"
                }
              >
                {driftReport.overall_drift_detected ? "Drift Detected" : "No Drift"}
              </Badge>
              <Badge variant="outline">
                Severity: {driftReport.drift_severity}
              </Badge>
            </div>

            {driftReport.features_with_drift.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Features with Drift</h4>
                <div className="flex flex-wrap gap-2">
                  {driftReport.features_with_drift.map((feature) => (
                    <Badge key={feature} variant="outline">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {driftReport.visualizations.drift_scores && (
              <Plot
                data={JSON.parse(driftReport.visualizations.drift_scores).data}
                layout={
                  JSON.parse(driftReport.visualizations.drift_scores).layout
                }
                config={{ responsive: true, displaylogo: false }}
                style={{ width: "100%", height: 400 }}
              />
            )}

            {driftReport.recommendations.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="list-disc list-inside space-y-1">
                  {driftReport.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-slate-600">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-500 mb-4">
              Upload monitoring data and run drift detection to see results
            </p>
            <div className="flex items-center justify-center gap-4">
              <input
                type="text"
                placeholder="Enter batch ID"
                className="border rounded px-3 py-2"
                onChange={(e) => setBatchId(e.target.value)}
              />
              <Button
                onClick={runDriftDetection}
                disabled={!batchId || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <BarChart3 className="h-4 w-4 mr-2" />
                )}
                Run Drift Detection
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Performance Section Component
function PerformanceSection({ jobId }: { jobId: string }) {
  const [performance, setPerformance] = useState<PerformanceResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPerformance = async () => {
      try {
        const data = await MonitoringAPI.getPerformance(jobId);
        setPerformance(data);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load performance";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    loadPerformance();
  }, [jobId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Tracking</CardTitle>
        <CardDescription>Monitor model performance over time</CardDescription>
      </CardHeader>
      <CardContent>
        {performance && performance.performance_history.length > 0 ? (
          <div className="space-y-6">
            {/* Baseline Metrics */}
            <div>
              <h4 className="font-medium mb-3">Baseline Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(performance.baseline_metrics).map(
                  ([key, value]) => (
                    <div key={key} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">
                        {key.replace(/_/g, " ").toUpperCase()}
                      </p>
                      <p className="text-lg font-bold">{value.toFixed(4)}</p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Performance Trend */}
            {Object.keys(performance.performance_trend).length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Performance Trends</h4>
                <div className="space-y-2">
                  {Object.entries(performance.performance_trend).map(
                    ([metric, trend]) => (
                      <div
                        key={metric}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <span className="font-medium">
                          {metric.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <div className="flex items-center gap-2">
                          {trend.trend === "improving" ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                          ) : trend.trend === "degrading" ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <Minus className="h-4 w-4 text-slate-400" />
                          )}
                          <Badge
                            variant={
                              trend.trend === "degrading"
                                ? "destructive"
                                : trend.trend === "improving"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {trend.percent_change > 0 ? "+" : ""}
                            {trend.percent_change.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Timeline Visualization */}
            {performance.visualizations.performance_timeline && (
              <Plot
                data={
                  JSON.parse(performance.visualizations.performance_timeline).data
                }
                layout={
                  JSON.parse(performance.visualizations.performance_timeline)
                    .layout
                }
                config={{ responsive: true, displaylogo: false }}
                style={{ width: "100%", height: 400 }}
              />
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">
            Performance visualization will appear here once metrics are logged
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Alerts Section Component
function AlertsSection({
  alerts,
  onRefresh,
}: {
  alerts: Array<{
    alert_id: string;
    alert_type: string;
    severity: string;
    message: string;
    triggered_at: string;
  }>;
  onRefresh: () => void;
}) {
  const [resolving, setResolving] = useState<string | null>(null);

  const handleResolve = async (alertId: string) => {
    setResolving(alertId);
    try {
      await MonitoringAPI.resolveAlert(alertId);
      onRefresh();
    } catch (err) {
      console.error("Failed to resolve alert:", err);
    } finally {
      setResolving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <p className="text-slate-500">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.alert_id}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  alert.severity === "critical" ? "bg-red-50" : "bg-yellow-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`h-5 w-5 ${
                      alert.severity === "critical"
                        ? "text-red-500"
                        : "text-yellow-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {alert.alert_type}
                      </Badge>
                      <p className="text-xs text-slate-500">
                        {new Date(alert.triggered_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResolve(alert.alert_id)}
                  disabled={resolving === alert.alert_id}
                >
                  {resolving === alert.alert_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Resolve"
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Upload Section Component
function UploadSection({
  jobId,
  onUploadComplete,
}: {
  jobId: string;
  onUploadComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = async (
    file: File,
    dataType: "predictions" | "actuals" | "features"
  ) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await MonitoringAPI.uploadBatch(file, jobId, dataType);
      setSuccess(`Uploaded ${response.rows} rows. Batch ID: ${response.batch_id}`);
      onUploadComplete();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Monitoring Data</CardTitle>
        <CardDescription>
          Upload production data to detect drift and track performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-emerald-200 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-700">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UploadCard
            title="Features"
            description="Production feature data"
            onUpload={(file) => handleUpload(file, "features")}
            loading={loading}
          />
          <UploadCard
            title="Predictions"
            description="Model predictions"
            onUpload={(file) => handleUpload(file, "predictions")}
            loading={loading}
          />
          <UploadCard
            title="Actuals"
            description="Actual outcomes (if available)"
            onUpload={(file) => handleUpload(file, "actuals")}
            loading={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UploadCard({
  title,
  description,
  onUpload,
  loading,
}: {
  title: string;
  description: string;
  onUpload: (file: File) => void;
  loading: boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <label className="cursor-pointer">
      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
        <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
        <p className="font-medium">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleChange}
          disabled={loading}
        />
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2 text-emerald-500" />
        )}
      </div>
    </label>
  );
}
