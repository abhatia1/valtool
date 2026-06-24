// components/stages/training/timeseries/ForecastChart.tsx
'use client';

import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TimeSeriesPredictions } from '@/types/timeseries';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface ForecastChartProps {
  predictions: TimeSeriesPredictions;
  title?: string;
}

export function ForecastChart({ predictions, title = 'Forecast vs Actual' }: ForecastChartProps) {
  const plotData = [
    {
      x: predictions.dates,
      y: predictions.y_true,
      type: 'scatter',
      mode: 'lines',
      name: 'Actual',
      line: { color: '#3b82f6', width: 2 }
    },
    {
      x: predictions.dates,
      y: predictions.y_pred,
      type: 'scatter',
      mode: 'lines',
      name: 'Forecast',
      line: { color: '#10b981', width: 2, dash: 'dash' }
    }
  ];

  const layout = {
    title,
    xaxis: { title: 'Date' },
    yaxis: { title: 'Value' },
    hovermode: 'x unified',
    showlegend: true,
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: 1.02,
      xanchor: 'right',
      x: 1
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="training-heading">Forecast Visualization</CardTitle>
      </CardHeader>
      <CardContent>
        <Plot
          data={plotData as any}
          layout={layout as any}
          config={{ responsive: true }}
          style={{ width: '100%', height: '500px' }}
        />
      </CardContent>
    </Card>
  );
}
