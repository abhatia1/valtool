"""
Visualization Generator Service

Generates ML visualizations as Plotly JSON for frontend rendering.
All functions return Plotly figure JSON that can be directly rendered with react-plotly.js.

Author: Valtool Team
Date: January 2026
"""

import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from typing import List, Dict, Any, Optional
from sklearn.metrics import (
    confusion_matrix,
    roc_curve,
    auc,
    precision_recall_curve
)
from sklearn.calibration import calibration_curve  # Correct import
from scipy import stats
import json


class VisualizationGenerator:
    """
    Service for generating ML visualizations as Plotly JSON.

    Design:
    - All methods are static (no state)
    - Return Plotly figure as JSON dict
    - Frontend renders with react-plotly.js: <Plot {...plotly_json} />
    """

    @staticmethod
    def generate_confusion_matrix(
        y_true: List[int],
        y_pred: List[int],
        class_names: List[str]
    ) -> Dict[str, Any]:
        """
        Generate confusion matrix heatmap.

        Args:
            y_true: True labels
            y_pred: Predicted labels
            class_names: List of class names

        Returns:
            Plotly JSON with confusion matrix heatmap
        """
        # Calculate confusion matrix
        cm = confusion_matrix(y_true, y_pred)

        # Calculate percentages
        cm_percent = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis] * 100

        # Create annotations (show count and percentage)
        annotations = []
        for i in range(len(class_names)):
            for j in range(len(class_names)):
                annotations.append(
                    dict(
                        x=j,
                        y=i,
                        text=f"{cm[i, j]}<br>({cm_percent[i, j]:.1f}%)",
                        showarrow=False,
                        font=dict(color="white" if cm[i, j] > cm.max() / 2 else "black", size=12)
                    )
                )

        # Create heatmap (text handled by annotations below)
        fig = go.Figure(data=go.Heatmap(
            z=cm,
            x=class_names,
            y=class_names,
            colorscale='Blues',
            showscale=True,
            hovertemplate='True: %{y}<br>Predicted: %{x}<br>Count: %{z}<extra></extra>'
        ))

        fig.update_layout(
            title='Confusion Matrix',
            xaxis_title='Predicted Label',
            yaxis_title='True Label',
            xaxis=dict(side='bottom'),
            yaxis=dict(autorange='reversed'),
            width=600,
            height=600,
            font=dict(size=12)
        )

        # Add annotations
        fig.update_layout(annotations=annotations)

        return json.loads(fig.to_json())

    @staticmethod
    def generate_roc_curves(
        y_true: List[int],
        y_pred_proba: List[List[float]],
        class_names: List[str]
    ) -> Dict[str, Any]:
        """
        Generate ROC curves for multi-class classification.

        Args:
            y_true: True labels (as integers)
            y_pred_proba: Predicted probabilities for each class (n_samples x n_classes)
            class_names: List of class names

        Returns:
            Plotly JSON with ROC curves
        """
        fig = go.Figure()

        n_classes = len(class_names)
        y_true_array = np.array(y_true)
        y_pred_proba_array = np.array(y_pred_proba)

        # Binary classification case
        if n_classes == 2:
            fpr, tpr, _ = roc_curve(y_true_array, y_pred_proba_array[:, 1])
            roc_auc = auc(fpr, tpr)

            fig.add_trace(go.Scatter(
                x=fpr,
                y=tpr,
                mode='lines',
                name=f'{class_names[1]} (AUC = {roc_auc:.3f})',
                line=dict(width=2)
            ))
        else:
            # Multi-class case: One-vs-Rest ROC curves
            from sklearn.preprocessing import label_binarize
            y_true_bin = label_binarize(y_true_array, classes=list(range(n_classes)))

            for i in range(n_classes):
                fpr, tpr, _ = roc_curve(y_true_bin[:, i], y_pred_proba_array[:, i])
                roc_auc = auc(fpr, tpr)

                fig.add_trace(go.Scatter(
                    x=fpr,
                    y=tpr,
                    mode='lines',
                    name=f'{class_names[i]} (AUC = {roc_auc:.3f})',
                    line=dict(width=2)
                ))

        # Add diagonal reference line
        fig.add_trace(go.Scatter(
            x=[0, 1],
            y=[0, 1],
            mode='lines',
            name='Random Classifier',
            line=dict(dash='dash', color='gray', width=2)
        ))

        fig.update_layout(
            title='ROC Curves (Receiver Operating Characteristic)',
            xaxis_title='False Positive Rate',
            yaxis_title='True Positive Rate',
            width=700,
            height=600,
            legend=dict(x=0.6, y=0.1),
            hovermode='closest'
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_pr_curves(
        y_true: List[int],
        y_pred_proba: List[List[float]],
        class_names: List[str]
    ) -> Dict[str, Any]:
        """
        Generate Precision-Recall curves for multi-class classification.

        Args:
            y_true: True labels
            y_pred_proba: Predicted probabilities
            class_names: List of class names

        Returns:
            Plotly JSON with PR curves
        """
        fig = go.Figure()

        n_classes = len(class_names)
        y_true_array = np.array(y_true)
        y_pred_proba_array = np.array(y_pred_proba)

        # Binary classification case
        if n_classes == 2:
            precision, recall, _ = precision_recall_curve(y_true_array, y_pred_proba_array[:, 1])
            pr_auc = auc(recall, precision)

            fig.add_trace(go.Scatter(
                x=recall,
                y=precision,
                mode='lines',
                name=f'{class_names[1]} (AUC = {pr_auc:.3f})',
                line=dict(width=2)
            ))
        else:
            # Multi-class case
            from sklearn.preprocessing import label_binarize
            y_true_bin = label_binarize(y_true_array, classes=list(range(n_classes)))

            for i in range(n_classes):
                precision, recall, _ = precision_recall_curve(y_true_bin[:, i], y_pred_proba_array[:, i])
                pr_auc = auc(recall, precision)

                fig.add_trace(go.Scatter(
                    x=recall,
                    y=precision,
                    mode='lines',
                    name=f'{class_names[i]} (AUC = {pr_auc:.3f})',
                    line=dict(width=2)
                ))

        fig.update_layout(
            title='Precision-Recall Curves',
            xaxis_title='Recall',
            yaxis_title='Precision',
            width=700,
            height=600,
            legend=dict(x=0.6, y=0.9),
            hovermode='closest'
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_feature_importance(
        importance_dict: Dict[str, float],
        top_n: int = 20
    ) -> Dict[str, Any]:
        """
        Generate feature importance bar chart.

        Args:
            importance_dict: Dictionary mapping feature names to importance scores
            top_n: Number of top features to display

        Returns:
            Plotly JSON with horizontal bar chart
        """
        # Sort by importance
        sorted_features = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
        top_features = sorted_features[:top_n]

        # Reverse for plotting (highest at top)
        features, importances = zip(*top_features)
        features = list(reversed(features))
        importances = list(reversed(importances))

        fig = go.Figure(data=go.Bar(
            x=importances,
            y=features,
            orientation='h',
            marker=dict(
                color=importances,
                colorscale='Viridis',
                showscale=True,
                colorbar=dict(title='Importance')
            ),
            text=[f'{imp:.4f}' for imp in importances],
            textposition='outside',
            hovertemplate='%{y}<br>Importance: %{x:.4f}<extra></extra>'
        ))

        fig.update_layout(
            title=f'Top {len(features)} Feature Importances',
            xaxis_title='Importance Score',
            yaxis_title='Feature',
            width=800,
            height=max(400, len(features) * 25),
            margin=dict(l=200)
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_calibration_plot(
        y_true: List[int],
        y_pred_proba: List[List[float]],
        class_names: List[str],
        n_bins: int = 10
    ) -> Dict[str, Any]:
        """
        Generate calibration curve (reliability diagram).

        Args:
            y_true: True labels
            y_pred_proba: Predicted probabilities
            class_names: List of class names
            n_bins: Number of bins for calibration

        Returns:
            Plotly JSON with calibration plot
        """
        fig = go.Figure()

        n_classes = len(class_names)
        y_true_array = np.array(y_true)
        y_pred_proba_array = np.array(y_pred_proba)

        # Binary classification case (most common)
        if n_classes == 2:
            prob_true, prob_pred = calibration_curve(
                y_true_array,
                y_pred_proba_array[:, 1],
                n_bins=n_bins,
                strategy='uniform'
            )

            fig.add_trace(go.Scatter(
                x=prob_pred,
                y=prob_true,
                mode='lines+markers',
                name='Model Calibration',
                line=dict(width=2),
                marker=dict(size=8)
            ))
        else:
            # Multi-class: calibrate each class
            from sklearn.preprocessing import label_binarize
            y_true_bin = label_binarize(y_true_array, classes=list(range(n_classes)))

            for i in range(min(n_classes, 3)):  # Limit to first 3 classes for clarity
                prob_true, prob_pred = calibration_curve(
                    y_true_bin[:, i],
                    y_pred_proba_array[:, i],
                    n_bins=n_bins,
                    strategy='uniform'
                )

                fig.add_trace(go.Scatter(
                    x=prob_pred,
                    y=prob_true,
                    mode='lines+markers',
                    name=f'{class_names[i]}',
                    line=dict(width=2),
                    marker=dict(size=8)
                ))

        # Add perfect calibration line
        fig.add_trace(go.Scatter(
            x=[0, 1],
            y=[0, 1],
            mode='lines',
            name='Perfect Calibration',
            line=dict(dash='dash', color='gray', width=2)
        ))

        fig.update_layout(
            title='Calibration Plot (Reliability Diagram)',
            xaxis_title='Mean Predicted Probability',
            yaxis_title='Fraction of Positives',
            width=700,
            height=600,
            legend=dict(x=0.1, y=0.9),
            hovermode='closest'
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_predicted_vs_actual(
        y_true: List[float],
        y_pred: List[float]
    ) -> Dict[str, Any]:
        """
        Generate predicted vs actual scatter plot for regression.

        Args:
            y_true: Actual target values
            y_pred: Predicted values

        Returns:
            Plotly JSON with scatter plot
        """
        y_true_array = np.array(y_true)
        y_pred_array = np.array(y_pred)

        # Calculate R² for display
        from sklearn.metrics import r2_score
        r2 = r2_score(y_true_array, y_pred_array)

        fig = go.Figure()

        # Scatter plot
        fig.add_trace(go.Scatter(
            x=y_true_array,
            y=y_pred_array,
            mode='markers',
            name='Predictions',
            marker=dict(
                size=8,
                color='rgba(31, 119, 180, 0.6)',
                line=dict(width=1, color='rgba(31, 119, 180, 1)')
            ),
            hovertemplate='Actual: %{x:.2f}<br>Predicted: %{y:.2f}<extra></extra>'
        ))

        # Perfect prediction line (y = x)
        min_val = min(y_true_array.min(), y_pred_array.min())
        max_val = max(y_true_array.max(), y_pred_array.max())
        fig.add_trace(go.Scatter(
            x=[min_val, max_val],
            y=[min_val, max_val],
            mode='lines',
            name='Perfect Prediction',
            line=dict(dash='dash', color='red', width=2)
        ))

        fig.update_layout(
            title=f'Predicted vs Actual (R² = {r2:.4f})',
            xaxis_title='Actual Values',
            yaxis_title='Predicted Values',
            width=700,
            height=600,
            hovermode='closest',
            showlegend=True
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_residual_plot(
        y_true: List[float],
        y_pred: List[float]
    ) -> Dict[str, Any]:
        """
        Generate residual plot for regression.

        Args:
            y_true: Actual target values
            y_pred: Predicted values

        Returns:
            Plotly JSON with residual plot
        """
        y_true_array = np.array(y_true)
        y_pred_array = np.array(y_pred)
        residuals = y_true_array - y_pred_array

        fig = go.Figure()

        # Residual scatter plot
        fig.add_trace(go.Scatter(
            x=y_pred_array,
            y=residuals,
            mode='markers',
            name='Residuals',
            marker=dict(
                size=8,
                color='rgba(255, 127, 14, 0.6)',
                line=dict(width=1, color='rgba(255, 127, 14, 1)')
            ),
            hovertemplate='Predicted: %{x:.2f}<br>Residual: %{y:.2f}<extra></extra>'
        ))

        # Zero line
        fig.add_trace(go.Scatter(
            x=[y_pred_array.min(), y_pred_array.max()],
            y=[0, 0],
            mode='lines',
            name='Zero Line',
            line=dict(dash='dash', color='red', width=2)
        ))

        fig.update_layout(
            title='Residual Plot',
            xaxis_title='Predicted Values',
            yaxis_title='Residuals (Actual - Predicted)',
            width=700,
            height=600,
            hovermode='closest',
            showlegend=True
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_qq_plot(residuals: List[float]) -> Dict[str, Any]:
        """
        Generate Q-Q plot for normality check of residuals.

        Args:
            residuals: Model residuals

        Returns:
            Plotly JSON with Q-Q plot
        """
        residuals_array = np.array(residuals)

        # Calculate theoretical quantiles and sample quantiles
        (osm, osr), (slope, intercept, r) = stats.probplot(residuals_array, dist="norm")

        fig = go.Figure()

        # Q-Q plot points
        fig.add_trace(go.Scatter(
            x=osm,
            y=osr,
            mode='markers',
            name='Sample Quantiles',
            marker=dict(
                size=8,
                color='rgba(44, 160, 44, 0.6)',
                line=dict(width=1, color='rgba(44, 160, 44, 1)')
            ),
            hovertemplate='Theoretical: %{x:.2f}<br>Sample: %{y:.2f}<extra></extra>'
        ))

        # Theoretical line
        fig.add_trace(go.Scatter(
            x=osm,
            y=slope * osm + intercept,
            mode='lines',
            name='Theoretical Normal',
            line=dict(dash='dash', color='red', width=2)
        ))

        fig.update_layout(
            title=f'Q-Q Plot (Normality Check, R² = {r**2:.4f})',
            xaxis_title='Theoretical Quantiles',
            yaxis_title='Sample Quantiles',
            width=700,
            height=600,
            hovermode='closest',
            showlegend=True
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_drift_score_chart(
        feature_drift: Dict[str, Dict[str, Any]],
        top_n: int = 15
    ) -> Dict[str, Any]:
        """
        Generate drift score bar chart for features.

        Args:
            feature_drift: Dictionary mapping feature names to drift results
            top_n: Maximum number of features to display

        Returns:
            Plotly JSON with drift score bar chart
        """
        # Sort features by drift score
        sorted_features = sorted(
            feature_drift.items(),
            key=lambda x: x[1].get("drift_score", 0),
            reverse=True
        )[:top_n]

        features = [f[0] for f in sorted_features]
        scores = [f[1].get("drift_score", 0) for f in sorted_features]
        colors = [
            "rgba(214, 39, 40, 0.8)" if f[1].get("drift_detected") else "rgba(44, 160, 44, 0.8)"
            for f in sorted_features
        ]

        fig = go.Figure(data=go.Bar(
            x=features,
            y=scores,
            marker_color=colors,
            text=[f"{s:.3f}" for s in scores],
            textposition="auto",
            hovertemplate="Feature: %{x}<br>Drift Score: %{y:.4f}<extra></extra>"
        ))

        fig.update_layout(
            title="Feature Drift Scores",
            xaxis_title="Feature",
            yaxis_title="Drift Score",
            template="plotly_white",
            width=800,
            height=500,
            xaxis=dict(tickangle=-45)
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_distribution_comparison(
        reference_data: "pd.Series",
        current_data: "pd.Series",
        feature_name: str,
        n_bins: int = 30
    ) -> Dict[str, Any]:
        """
        Generate distribution comparison histogram for a feature.

        Args:
            reference_data: Reference (training) data series
            current_data: Current (production) data series
            feature_name: Name of the feature
            n_bins: Number of histogram bins

        Returns:
            Plotly JSON with overlaid histograms
        """
        fig = go.Figure()

        # Reference distribution
        fig.add_trace(go.Histogram(
            x=reference_data,
            name="Reference (Training)",
            opacity=0.7,
            marker_color="rgba(31, 119, 180, 0.7)",
            nbinsx=n_bins,
            histnorm="probability density"
        ))

        # Current distribution
        fig.add_trace(go.Histogram(
            x=current_data,
            name="Current (Production)",
            opacity=0.7,
            marker_color="rgba(255, 127, 14, 0.7)",
            nbinsx=n_bins,
            histnorm="probability density"
        ))

        fig.update_layout(
            title=f"Distribution Comparison: {feature_name}",
            xaxis_title=feature_name,
            yaxis_title="Density",
            barmode="overlay",
            template="plotly_white",
            width=700,
            height=500,
            legend=dict(x=0.7, y=0.95)
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_psi_chart(
        feature_psi: Dict[str, float],
        threshold_low: float = 0.1,
        threshold_high: float = 0.25
    ) -> Dict[str, Any]:
        """
        Generate Population Stability Index (PSI) chart.

        PSI values:
        - < 0.1: No significant change
        - 0.1 - 0.25: Moderate change
        - > 0.25: Significant change

        Args:
            feature_psi: Dictionary mapping feature names to PSI values
            threshold_low: Lower threshold for moderate change
            threshold_high: Upper threshold for significant change

        Returns:
            Plotly JSON with PSI bar chart
        """
        # Sort by PSI value
        sorted_features = sorted(
            feature_psi.items(),
            key=lambda x: x[1],
            reverse=True
        )

        features = [f[0] for f in sorted_features]
        psi_values = [f[1] for f in sorted_features]

        # Color based on severity
        colors = []
        for psi in psi_values:
            if psi >= threshold_high:
                colors.append("rgba(214, 39, 40, 0.8)")  # Red - significant
            elif psi >= threshold_low:
                colors.append("rgba(255, 127, 14, 0.8)")  # Orange - moderate
            else:
                colors.append("rgba(44, 160, 44, 0.8)")  # Green - no change

        fig = go.Figure(data=go.Bar(
            x=features,
            y=psi_values,
            marker_color=colors,
            text=[f"{p:.3f}" for p in psi_values],
            textposition="auto",
            hovertemplate="Feature: %{x}<br>PSI: %{y:.4f}<extra></extra>"
        ))

        # Add threshold lines
        fig.add_hline(
            y=threshold_low,
            line_dash="dash",
            line_color="orange",
            annotation_text="Moderate Change Threshold"
        )
        fig.add_hline(
            y=threshold_high,
            line_dash="dash",
            line_color="red",
            annotation_text="Significant Change Threshold"
        )

        fig.update_layout(
            title="Population Stability Index (PSI) by Feature",
            xaxis_title="Feature",
            yaxis_title="PSI Value",
            template="plotly_white",
            width=800,
            height=500,
            xaxis=dict(tickangle=-45)
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_performance_timeline(
        timestamps: List["datetime"],
        metrics: Dict[str, List[float]],
        baseline_metrics: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Generate performance metrics over time chart.

        Args:
            timestamps: List of timestamps for each measurement
            metrics: Dictionary mapping metric names to lists of values
            baseline_metrics: Optional baseline values to show as horizontal lines

        Returns:
            Plotly JSON with time series chart
        """
        fig = go.Figure()

        colors = [
            "rgba(31, 119, 180, 1)",
            "rgba(255, 127, 14, 1)",
            "rgba(44, 160, 44, 1)",
            "rgba(214, 39, 40, 1)",
            "rgba(148, 103, 189, 1)"
        ]

        for i, (metric_name, values) in enumerate(metrics.items()):
            color = colors[i % len(colors)]

            fig.add_trace(go.Scatter(
                x=timestamps,
                y=values,
                mode="lines+markers",
                name=metric_name,
                line=dict(width=2, color=color),
                marker=dict(size=6),
                hovertemplate=f"{metric_name}: " + "%{y:.4f}<br>%{x}<extra></extra>"
            ))

            # Add baseline reference if available
            if baseline_metrics and metric_name in baseline_metrics:
                fig.add_hline(
                    y=baseline_metrics[metric_name],
                    line_dash="dot",
                    line_color=color,
                    annotation_text=f"{metric_name} baseline",
                    opacity=0.5
                )

        fig.update_layout(
            title="Model Performance Over Time",
            xaxis_title="Time",
            yaxis_title="Metric Value",
            template="plotly_white",
            width=900,
            height=500,
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
            hovermode="x unified"
        )

        return json.loads(fig.to_json())

    @staticmethod
    def generate_alert_summary(
        alerts: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate alert summary visualization.

        Args:
            alerts: List of alert dictionaries with alert_type, severity, triggered_at

        Returns:
            Plotly JSON with alert summary
        """
        if not alerts:
            # Empty chart
            fig = go.Figure()
            fig.add_annotation(
                text="No alerts to display",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.5,
                showarrow=False,
                font=dict(size=16)
            )
            fig.update_layout(
                title="Alert Summary",
                template="plotly_white",
                width=600,
                height=400
            )
            return json.loads(fig.to_json())

        # Count alerts by type and severity
        from collections import Counter

        type_counts = Counter(a.get("alert_type", "unknown") for a in alerts)
        severity_counts = Counter(a.get("severity", "unknown") for a in alerts)

        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=("Alerts by Type", "Alerts by Severity"),
            specs=[[{"type": "pie"}, {"type": "pie"}]]
        )

        # Alerts by type
        fig.add_trace(
            go.Pie(
                labels=list(type_counts.keys()),
                values=list(type_counts.values()),
                name="By Type",
                marker=dict(colors=["rgba(31, 119, 180, 0.8)", "rgba(255, 127, 14, 0.8)", "rgba(44, 160, 44, 0.8)"])
            ),
            row=1, col=1
        )

        # Alerts by severity
        severity_colors = {
            "critical": "rgba(214, 39, 40, 0.8)",
            "warning": "rgba(255, 127, 14, 0.8)",
            "info": "rgba(44, 160, 44, 0.8)"
        }
        fig.add_trace(
            go.Pie(
                labels=list(severity_counts.keys()),
                values=list(severity_counts.values()),
                name="By Severity",
                marker=dict(colors=[severity_colors.get(s, "gray") for s in severity_counts.keys()])
            ),
            row=1, col=2
        )

        fig.update_layout(
            title="Alert Summary",
            template="plotly_white",
            width=800,
            height=400
        )

        return json.loads(fig.to_json())


# Singleton instance for easy import
visualization_generator = VisualizationGenerator()
