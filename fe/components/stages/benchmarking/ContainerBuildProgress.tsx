"use client";

import { useState, useEffect, useRef } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { BenchmarkingAPI } from "@/lib/api/benchmarking";
import type { ContainerBuildStatus, ModelSource } from "@/types/benchmarking";

interface ContainerBuildProgressProps {
  modelId: string;
  modelSource?: ModelSource;
  onBuildComplete: () => void;
  onBuildFailed: (error: string) => void;
}

export function ContainerBuildProgress({
  modelId,
  modelSource = "docker",
  onBuildComplete,
  onBuildFailed,
}: ContainerBuildProgressProps) {
  const [status, setStatus] = useState<ContainerBuildStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // For native models, immediately complete - no build needed
  useEffect(() => {
    if (modelSource === "native") {
      // Use setTimeout to avoid synchronous setState in effect
      const initTimer = setTimeout(() => {
        // Native models are immediately ready
        setStatus({
          model_id: modelId,
          status: "ready",
          progress: 100,
          current_step: "Ready",
          logs: ["Native model loaded successfully - no build required"],
        });
      }, 0);
      // Small delay before completing to show the success state
      const completeTimer = setTimeout(() => {
        onBuildComplete();
      }, 1000);
      return () => {
        clearTimeout(initTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [modelId, modelSource, onBuildComplete]);

  // Poll for build status (Docker only)
  useEffect(() => {
    if (!modelId || modelSource === "native") return;

    let isMounted = true;

    const pollStatus = async () => {
      try {
        const buildStatus = await BenchmarkingAPI.getBuildStatus(modelId);
        if (!isMounted) return;

        setStatus(buildStatus);

        if (buildStatus.status === "ready") {
          onBuildComplete();
          return true; // Stop polling
        } else if (buildStatus.status === "failed") {
          const errorMsg = buildStatus.error_message || "Build failed";
          setError(errorMsg);
          onBuildFailed(errorMsg);
          return true; // Stop polling
        }

        return false; // Continue polling
      } catch (err) {
        if (!isMounted) return true;
        const message =
          err instanceof Error ? err.message : "Failed to get build status";
        setError(message);
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
  }, [modelId, modelSource, onBuildComplete, onBuildFailed]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [status?.logs]);

  const handleRetry = async () => {
    setError(null);
    setStatus(null);
    try {
      await BenchmarkingAPI.buildContainer(modelId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to restart build";
      setError(message);
      onBuildFailed(message);
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;

    switch (status.status) {
      case "pending":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Pending
          </Badge>
        );
      case "building":
        return (
          <Badge className="bg-blue-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Building
          </Badge>
        );
      case "ready":
        return (
          <Badge className="bg-emerald-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ready
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {modelSource === "native" ? "Loading Model" : "Building Container"}
            </CardTitle>
            <CardDescription>
              {modelSource === "native"
                ? "Validating and loading your native model"
                : "Building Docker image for your external model"}
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
              {status?.current_step || "Initializing..."}
            </span>
            <span className="text-slate-500">{status?.progress || 0}%</span>
          </div>
          <Progress value={status?.progress || 0} className="h-2" />
        </div>

        {/* Build Logs */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Build Logs</p>
          <ScrollArea className="h-64 w-full rounded-md border bg-slate-900 p-4">
            <div className="font-mono text-xs text-slate-300 space-y-1">
              {status?.logs && status.logs.length > 0 ? (
                status.logs.map((log, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">Waiting for build to start...</div>
              )}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Build Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {status?.status === "failed" && (
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Build
            </Button>
          )}
          {status?.status === "ready" && (
            <Button onClick={onBuildComplete}>
              Continue to Selection
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Build Time Info */}
        {status?.started_at && (
          <div className="text-xs text-slate-500 text-center">
            Build started: {new Date(status.started_at).toLocaleTimeString()}
            {status.completed_at && (
              <>
                {" "}
                | Completed: {new Date(status.completed_at).toLocaleTimeString()}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
