// components/stages/training/regression/RegressionModelComparison.tsx
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ModelComparisonProps {
  models: Array<{
    estimator_name: string;
    metrics: {
      r2: number;
      rmse: number;
      mae: number;
    };
    training_time: number;
  }>;
  bestModelName: string;
}

export function RegressionModelComparison({ models, bestModelName }: ModelComparisonProps) {
  // Sort by R² descending
  const sortedModels = [...models].sort((a, b) => b.metrics.r2 - a.metrics.r2);

  return (
    <Card className="p-6 rounded-xl shadow-sm border-slate-200/60">
      <h3 className="text-lg font-semibold mb-4 training-heading">Model Comparison</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">R²</TableHead>
            <TableHead className="text-right">RMSE</TableHead>
            <TableHead className="text-right">MAE</TableHead>
            <TableHead className="text-right">Training Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedModels.map((model, index) => (
            <TableRow key={model.estimator_name}>
              <TableCell>
                {index === 0 ? (
                  <Badge variant="default">1st</Badge>
                ) : (
                  <span className="text-muted-foreground">{index + 1}</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{model.estimator_name}</span>
                  {model.estimator_name === bestModelName && (
                    <Badge variant="outline">Best</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {model.metrics.r2.toFixed(4)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {model.metrics.rmse.toFixed(4)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {model.metrics.mae.toFixed(4)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {model.training_time.toFixed(2)}s
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
