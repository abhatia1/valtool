// components/stages/training/regression/ResidualsPlot.tsx
'use client';

import dynamic from 'next/dynamic';
import type { RegressionPredictions } from '@/types/regression';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface ResidualsPlotProps {
  predictions: RegressionPredictions;
  title?: string;
}

export function ResidualsPlot({
  predictions,
  title = 'Residuals Plot'
}: ResidualsPlotProps) {
  const scatterData = {
    x: predictions.y_pred,
    y: predictions.residuals,
    mode: 'markers',
    type: 'scatter',
    name: 'Residuals',
    marker: {
      color: 'rgba(168, 85, 247, 0.6)',
      size: 8,
      line: {
        color: 'rgba(168, 85, 247, 1)',
        width: 1
      }
    }
  };

  // Zero line
  const zeroLine = {
    x: [Math.min(...predictions.y_pred), Math.max(...predictions.y_pred)],
    y: [0, 0],
    mode: 'lines',
    type: 'scatter',
    name: 'Zero Line',
    line: {
      color: 'rgba(239, 68, 68, 0.8)',
      width: 2,
      dash: 'dash'
    }
  };

  const layout = {
    title: title,
    xaxis: {
      title: 'Predicted Values',
      gridcolor: 'rgba(128, 128, 128, 0.2)'
    },
    yaxis: {
      title: 'Residuals (Actual - Predicted)',
      gridcolor: 'rgba(128, 128, 128, 0.2)',
      zeroline: true
    },
    plot_bgcolor: 'rgba(0, 0, 0, 0)',
    paper_bgcolor: 'rgba(0, 0, 0, 0)',
    showlegend: true,
    hovermode: 'closest'
  };

  return (
    <Plot
      data={[scatterData, zeroLine] as any}
      layout={layout as any}
      style={{ width: '100%', height: '500px' }}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
