"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Square,
  Clock,
} from "lucide-react";
import { BenchmarkingAPI } from "@/lib/api/benchmarking";
import type { BenchmarkRun, BenchmarkComparison } from "@/types/benchmarking";

interface BenchmarkProgressProps {
  benchmarkId: string;
  onComplete: (results: BenchmarkComparison) => void;
  onError: (error: string) => void;
}

export function BenchmarkProgress({
  benchmarkId,
  onComplete,
  onError,
}: BenchmarkProgressProps) {
  const [status, setStatus] = useState<BenchmarkRun | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Poll for benchmark status
  useEffect(() => {
    if (!benchmarkId) return;

    let isMounted = true;

    const pollStatus = async () => {
      try {
        const benchmarkStatus = await BenchmarkingAPI.getBenchmarkStatus(
          benchmarkId
        );
        if (!isMounted) return;

        setStatus(benchmarkStatus);

        if (benchmarkStatus.status === "completed") {
          // Fetch full results
          const results = await BenchmarkingAPI.getBenchmarkResults(benchmarkId);
          if (isMounted) {
            onComplete(results);
          }
          return true; // Stop polling
        } else if (benchmarkStatus.status === "failed") {
          const errorMsg =
            benchmarkStatus.error_message || "Benchmark failed";
          if (isMounted) {
            onError(errorMsg);
          }
          return true; // Stop polling
        }

        return false; // Continue polling
      } catch (err) {
        if (!isMounted) return true;
        console.error("Failed to get benchmark status:", err);
        return false; // Continue polling, might be transient
      }
    };

    // Initial fetch
    pollStatus();

    // Set up polling interval
    const interval = setInterval(async () => {
      const shouldStop = await pollStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [benchmarkId, onComplete, onError]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await BenchmarkingAPI.cancelBenchmark(benchmarkId);
      onError("Benchmark cancelled by user");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to cancel benchmark";
      console.error(message);
    } finally {
      setCancelling(false);
    }
  };

  const getStatusIcon = () => {
    if (!status) return <Loader2 className="h-5 w-5 animate-spin" />;

    switch (status.status) {
      case "pending":
        return <Clock className="h-5 w-5 text-slate-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;

    switch (status.status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "running":
        return <Badge className="bg-blue-500">Running</Badge>;
      case "completed":
        return <Badge className="bg-emerald-500">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Running Benchmark</CardTitle>
            <CardDescription>
              Comparing platform and external models on test data
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              {status?.current_model
                ? `Evaluating: ${status.current_model}`
                : "Initializing..."}
            </span>
            <span className="text-slate-500">{status?.progress || 0}%</span>
          </div>
          <Progress value={status?.progress || 0} className="h-3" />
        </div>

        {/* Status Display */}
        <div className="bg-slate-50 rounded-lg p-6">
          <div className="flex items-center justify-center gap-4">
            {getStatusIcon()}
            <div className="text-center">
              <p className="text-lg font-medium text-slate-900">
                {status?.status === "pending" && "Waiting to start..."}
                {status?.status === "running" && "Benchmark in progress"}
                {status?.status === "completed" && "Benchmark completed!"}
                {status?.status === "failed" && "Benchmark failed"}
                {!status && "Initializing benchmark..."}
              </p>
              {status?.current_model && status.status === "running" && (
                <p className="text-sm text-slate-500 mt-1">
                  Currently testing: {status.current_model}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Time Info */}
        {status?.started_at && (
          <div className="flex justify-center gap-6 text-sm text-slate-500">
            <span>
              Started: {new Date(status.started_at).toLocaleTimeString()}
            </span>
            {status.completed_at && (
              <span>
                Completed: {new Date(status.completed_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}

        {/* Cancel Button */}
        {(status?.status === "pending" || status?.status === "running") && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Cancel Benchmark
            </Button>
          </div>
        )}

        {/* Error Display */}
        {status?.status === "failed" && status.error_message && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Benchmark Failed</p>
                <p className="text-sm text-red-600 mt-1">
                  {status.error_message}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
