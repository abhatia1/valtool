// components/stages/training/regression/RegressionMetrics.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RegressionMetrics } from '@/types/regression';

interface RegressionMetricsProps {
  metrics: RegressionMetrics;
  title?: string;
}

export function RegressionMetricsDisplay({ metrics, title = 'Regression Metrics' }: RegressionMetricsProps) {
  const metricsData = [
    { label: 'R² Score', value: metrics.r2, format: '.4f', tooltip: 'Coefficient of determination (higher is better)' },
    { label: 'Adjusted R²', value: metrics.adjusted_r2, format: '.4f', tooltip: 'R² adjusted for number of features' },
    { label: 'RMSE', value: metrics.rmse, format: '.4f', tooltip: 'Root Mean Squared Error (lower is better)' },
    { label: 'MAE', value: metrics.mae, format: '.4f', tooltip: 'Mean Absolute Error (lower is better)' },
    { label: 'MSE', value: metrics.mse, format: '.4f', tooltip: 'Mean Squared Error (lower is better)' },
    { label: 'MAPE', value: metrics.mape, format: '.2f%', tooltip: 'Mean Absolute Percentage Error' },
    { label: 'Median AE', value: metrics.median_absolute_error, format: '.4f', tooltip: 'Median Absolute Error' },
    { label: 'Max Error', value: metrics.max_error, format: '.4f', tooltip: 'Maximum prediction error' },
  ];

  const formatValue = (value: number | null, format: string) => {
    if (value === null) return 'N/A';
    if (format === '.4f') return value.toFixed(4);
    if (format === '.2f%') return (value * 100).toFixed(2) + '%';
    return value.toString();
  };

  return (
    <Card className="p-6 rounded-xl shadow-sm border-slate-200/60">
      <h3 className="text-lg font-semibold mb-4 training-heading">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricsData.map(({ label, value, format, tooltip }) => (
          <div key={label} className="space-y-1" title={tooltip}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold training-mono">
              {formatValue(value, format)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
