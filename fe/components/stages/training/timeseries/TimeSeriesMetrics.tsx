// components/stages/training/timeseries/TimeSeriesMetrics.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TimeSeriesMetrics as Metrics } from '@/types/timeseries';

interface TimeSeriesMetricsProps {
  metrics: Metrics;
}

export function TimeSeriesMetrics({ metrics }: TimeSeriesMetricsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">MAE</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold training-mono">{metrics.mae.toFixed(4)}</p>
          <p className="text-xs text-muted-foreground">Mean Absolute Error</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">RMSE</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold training-mono">{metrics.rmse.toFixed(4)}</p>
          <p className="text-xs text-muted-foreground">Root Mean Squared Error</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">MAPE</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold training-mono">{metrics.mape.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">Mean Absolute % Error</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Direction</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold training-mono">{metrics.directional_accuracy.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">Directional Accuracy</p>
        </CardContent>
      </Card>
    </div>
  );
}
