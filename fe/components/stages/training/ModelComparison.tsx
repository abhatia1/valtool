"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, TrendingUp, ArrowUpDown } from "lucide-react";
import type { ModelComparison as ModelComparisonType } from "@/types/training";

interface ModelComparisonProps {
  models: ModelComparisonType[];
  bestModelName?: string;
}

type SortKey = "validation_score" | "accuracy" | "f1_weighted" | "precision_weighted" | "recall_weighted" | "training_time";
type SortDirection = "asc" | "desc";

export function ModelComparison({ models, bestModelName }: ModelComparisonProps) {
  const [sortKey, setSortKey] = useState<SortKey>("validation_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const sortedModels = [...models].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    if (sortKey === "training_time") {
      aValue = a.training_time;
      bValue = b.training_time;
    } else if (sortKey === "validation_score") {
      aValue = a.validation_score;
      bValue = b.validation_score;
    } else {
      aValue = a.metrics[sortKey];
      bValue = b.metrics[sortKey];
    }

    return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  });

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatTime = (seconds: number) => `${seconds.toFixed(2)}s`;

  const SortableHeader = ({ column, label }: { column: SortKey; label: string }) => (
    <TableHead
      className="cursor-pointer hover:bg-slate-50 transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  return (
    <Card className="training-card rounded-xl shadow-sm">
      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-slate-50/30">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" strokeWidth={2} />
          <CardTitle className="text-xl training-heading">Model Comparison</CardTitle>
        </div>
        <CardDescription>
          Compare performance metrics across all trained models. Best model is selected by CV Score (cross-validation) to prevent overfitting.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="rounded-lg border border-slate-200/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-semibold">Model</TableHead>
                <SortableHeader column="validation_score" label="Validation Score" />
                <SortableHeader column="accuracy" label="Accuracy" />
                <SortableHeader column="f1_weighted" label="F1 Score" />
                <SortableHeader column="precision_weighted" label="Precision" />
                <SortableHeader column="recall_weighted" label="Recall" />
                <SortableHeader column="training_time" label="Training Time" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedModels.map((model, index) => {
                const isBest = model.estimator_name === bestModelName;
                return (
                  <TableRow
                    key={index}
                    className={`
                      ${isBest ? "bg-gradient-to-r from-amber-50/80 to-yellow-50/60 border-l-4 border-amber-500" : "hover:bg-slate-50/50"}
                      transition-all duration-200
                    `}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isBest && <Trophy className="h-4 w-4 text-amber-500" />}
                        <span className={isBest ? "font-bold" : ""}>
                          {model.estimator_name}
                        </span>
                        {isBest && (
                          <Badge variant="default" className="bg-amber-500">
                            Best
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="training-mono">
                      <div className="flex flex-col">
                        <span>{formatPercentage(model.validation_score)}</span>
                        <span className="text-xs text-slate-400">±{(model.validation_std * 100).toFixed(2)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="training-mono">
                      {formatPercentage(model.metrics.accuracy)}
                    </TableCell>
                    <TableCell className="training-mono">
                      {model.metrics.f1_weighted.toFixed(4)}
                    </TableCell>
                    <TableCell className="training-mono">
                      {model.metrics.precision_weighted.toFixed(4)}
                    </TableCell>
                    <TableCell className="training-mono">
                      {model.metrics.recall_weighted.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="training-mono text-sm">
                          {formatTime(model.training_time)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 rounded-lg p-4 border border-blue-200/60">
            <div className="text-sm text-blue-700 font-medium">Total Models</div>
            <div className="text-2xl font-bold text-blue-900">{models.length}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50/80 to-amber-100/60 rounded-lg p-4 border border-amber-200/60">
            <div className="text-sm text-amber-700 font-medium">Best Validation Score</div>
            <div className="text-2xl font-bold text-amber-900">
              {formatPercentage(Math.max(...models.map((m) => m.validation_score)))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50/80 to-green-100/60 rounded-lg p-4 border border-green-200/60">
            <div className="text-sm text-green-700 font-medium">Best Training Acc</div>
            <div className="text-2xl font-bold text-green-900">
              {formatPercentage(Math.max(...models.map((m) => m.metrics.accuracy)))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50/80 to-purple-100/60 rounded-lg p-4 border border-purple-200/60">
            <div className="text-sm text-purple-700 font-medium">Avg Training Time</div>
            <div className="text-2xl font-bold text-purple-900">
              {formatTime(
                models.reduce((acc, m) => acc + m.training_time, 0) / models.length
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
