"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  PlayCircle,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrainingStatusResponse } from "@/types/training";
import { TrainingAPI } from "@/lib/api/training";

interface TrainingProgressProps {
  jobId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function TrainingProgress({
  jobId,
  onComplete,
  onCancel,
}: TrainingProgressProps) {
  const [status, setStatus] = useState<TrainingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const fetchStatus = async () => {
    try {
      const data = await TrainingAPI.getStatus(jobId);
      setStatus(data);
      setError(null);

      // Stop polling if terminal state reached
      if (["completed", "failed", "cancelled"].includes(data.status)) {
        setIsPolling(false);
        if (data.status === "completed" && onComplete) {
          onComplete();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to fetch training status");
      setIsPolling(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [jobId]);

  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(fetchStatus, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [isPolling, jobId]);

  const handleCancel = async () => {
    try {
      await TrainingAPI.cancelJob(jobId);
      setIsPolling(false);
      if (onCancel) onCancel();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to cancel training");
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(
      (seconds % 3600) / 60
    )}m`;
  };

  const getStatusIcon = () => {
    if (!status) return null;
    switch (status.status) {
      case "queued":
        return <Clock className="h-5 w-5 text-amber-500" strokeWidth={2} />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" strokeWidth={2} />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" strokeWidth={2} />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" strokeWidth={2} />;
      case "cancelled":
        return <StopCircle className="h-5 w-5 text-slate-500" strokeWidth={2} />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = () => {
    if (!status) return "secondary";
    switch (status.status) {
      case "completed":
        return "default";
      case "failed":
        return "destructive";
      case "running":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <Card className="training-card rounded-xl shadow-sm">
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-lg training-mono">Loading training status...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <Card className="training-card rounded-xl shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50/50 to-slate-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-2xl training-heading">Training Progress</CardTitle>
                <p className="text-sm text-slate-600 mt-1 training-mono text-xs">
                  Job ID: {jobId.slice(0, 8)}...
                </p>
              </div>
            </div>
            <Badge variant={getStatusBadgeVariant() as any} className="text-sm px-3 py-1">
              {status.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Bar - Only show for running jobs */}
      {status.status === "running" && (
        <Card className="training-card rounded-xl shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Current Step */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-blue-500" strokeWidth={2} />
                  <span className="font-medium text-slate-900">{status.current_step}</span>
                </div>
                <span className="text-sm font-semibold text-blue-600 training-mono">
                  {status.progress.percent_complete.toFixed(0)}%
                </span>
              </div>

              {/* Progress Bar */}
              <Progress value={status.progress.percent_complete} className="h-3" />

              {/* Progress Details */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-slate-600">Current Model:</span>
                  <span className="font-medium training-mono text-xs">{status.progress.current_model}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-slate-600">Models:</span>
                  <span className="font-medium training-mono">
                    {status.progress.models_completed} / {status.progress.total_models}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" strokeWidth={2} />
                  <span className="text-slate-600">Elapsed:</span>
                  <span className="font-medium training-mono">
                    {formatTime(status.progress.elapsed_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" strokeWidth={2} />
                  <span className="text-slate-600">ETA:</span>
                  <span className="font-medium training-mono">
                    {formatTime(status.progress.eta)}
                  </span>
                </div>
              </div>

              {/* Cancel Button */}
              <div className="pt-4">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  className="w-full"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancel Training
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Message */}
      {status.status === "completed" && (
        <Alert className="border-green-200/60 bg-green-50/50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 font-medium">
            Training completed successfully! View results below.
          </AlertDescription>
        </Alert>
      )}

      {/* Failure Message */}
      {status.status === "failed" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Training failed. Check logs below for details.
          </AlertDescription>
        </Alert>
      )}

      {/* Logs */}
      {status.logs && status.logs.length > 0 && (
        <Card className="training-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg training-heading">Training Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-950 text-green-400 p-4 rounded-lg training-mono text-sm max-h-96 overflow-y-auto">
              {status.logs.map((log, i) => (
                <div
                  key={i}
                  className="py-1 hover:bg-slate-900 transition-colors"
                >
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
