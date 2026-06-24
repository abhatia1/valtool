// components/stages/training/regression/PredictedVsActualPlot.tsx
'use client';

import dynamic from 'next/dynamic';
import type { RegressionPredictions } from '@/types/regression';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface PredictedVsActualPlotProps {
  predictions: RegressionPredictions;
  title?: string;
}

export function PredictedVsActualPlot({
  predictions,
  title = 'Predicted vs Actual Values'
}: PredictedVsActualPlotProps) {
  // Create scatter plot data
  const scatterData = {
    x: predictions.y_true,
    y: predictions.y_pred,
    mode: 'markers',
    type: 'scatter',
    name: 'Predictions',
    marker: {
      color: 'rgba(59, 130, 246, 0.6)',
      size: 8,
      line: {
        color: 'rgba(59, 130, 246, 1)',
        width: 1
      }
    }
  };

  // Create perfect prediction line (y=x)
  const minVal = Math.min(...predictions.y_true);
  const maxVal = Math.max(...predictions.y_true);
  const perfectLine = {
    x: [minVal, maxVal],
    y: [minVal, maxVal],
    mode: 'lines',
    type: 'scatter',
    name: 'Perfect Prediction',
    line: {
      color: 'rgba(239, 68, 68, 0.8)',
      width: 2,
      dash: 'dash'
    }
  };

  const layout = {
    title: title,
    xaxis: {
      title: 'Actual Values',
      gridcolor: 'rgba(128, 128, 128, 0.2)'
    },
    yaxis: {
      title: 'Predicted Values',
      gridcolor: 'rgba(128, 128, 128, 0.2)'
    },
    plot_bgcolor: 'rgba(0, 0, 0, 0)',
    paper_bgcolor: 'rgba(0, 0, 0, 0)',
    showlegend: true,
    hovermode: 'closest'
  };

  return (
    <Plot
      data={[scatterData, perfectLine] as any}
      layout={layout as any}
      style={{ width: '100%', height: '500px' }}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
