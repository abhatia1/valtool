"""
EDA Generator Service

Comprehensive exploratory data analysis with visualizations and insights.
"""

import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from scipy import stats
from scipy.stats import gaussian_kde
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
from sklearn.dummy import DummyClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import cross_val_predict
from sklearn.feature_selection import mutual_info_classif, mutual_info_regression
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.covariance import EllipticEnvelope
from sklearn.cluster import DBSCAN
from typing import Dict, List, Any, Optional, Tuple
import json


class EDAGenerator:
    """Generate comprehensive exploratory data analysis reports"""

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.numerical_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        self.categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        self.datetime_cols = df.select_dtypes(include=['datetime']).columns.tolist()

    def generate_summary_statistics(self) -> Dict[str, Any]:
        """Generate summary statistics for all columns"""
        summary = {}

        for col in self.df.columns:
            col_stats = {
                "count": int(self.df[col].count()),
                "null_count": int(self.df[col].isnull().sum()),
                "null_percentage": float(self.df[col].isnull().sum() / len(self.df) * 100)
            }

            if pd.api.types.is_numeric_dtype(self.df[col]):
                col_data = self.df[col].dropna()
                if len(col_data) > 0:
                    col_stats.update({
                        "mean": float(col_data.mean()),
                        "median": float(col_data.median()),
                        "std": float(col_data.std()),
                        "min": float(col_data.min()),
                        "max": float(col_data.max()),
                        "q25": float(col_data.quantile(0.25)),
                        "q75": float(col_data.quantile(0.75)),
                        "skewness": float(stats.skew(col_data)),
                        "kurtosis": float(stats.kurtosis(col_data))
                    })

                    # Outlier detection
                    q1, q3 = col_data.quantile([0.25, 0.75])
                    iqr = q3 - q1
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr
                    outliers_iqr = col_data[(col_data < lower_bound) | (col_data > upper_bound)]

                    col_stats["outliers"] = {
                        "iqr_count": int(len(outliers_iqr)),
                        "iqr_percentage": float(len(outliers_iqr) / len(col_data) * 100)
                    }
            else:
                col_stats.update({
                    "unique_values": int(self.df[col].nunique()),
                    "top_value": str(self.df[col].mode()[0]) if len(self.df[col].mode()) > 0 else None,
                    "top_value_count": int(self.df[col].value_counts().iloc[0]) if len(self.df[col]) > 0 else 0,
                    "cardinality_percentage": float(self.df[col].nunique() / len(self.df) * 100)
                })

            summary[col] = col_stats

        return summary

    def generate_univariate_plots(self) -> List[Dict]:
        """Generate histograms for numeric, bar charts for categorical"""
        plots = []

        # Numerical columns - histograms with KDE
        for col in self.numerical_cols:
            col_data = self.df[col].dropna()
            if len(col_data) == 0:
                continue

            fig = go.Figure()

            # Add histogram
            fig.add_trace(go.Histogram(
                x=col_data,
                nbinsx=30,
                name='Histogram',
                opacity=0.7,
                marker_color='steelblue'
            ))

            # Add KDE if possible
            try:
                if len(col_data) > 10:
                    kde = gaussian_kde(col_data)
                    x_range = np.linspace(col_data.min(), col_data.max(), 200)
                    kde_values = kde(x_range)

                    # Scale KDE to match histogram
                    hist_values, bin_edges = np.histogram(col_data, bins=30)
                    bin_width = bin_edges[1] - bin_edges[0]
                    scale_factor = len(col_data) * bin_width
                    kde_values_scaled = kde_values * scale_factor

                    fig.add_trace(go.Scatter(
                        x=x_range,
                        y=kde_values_scaled,
                        mode='lines',
                        name='KDE',
                        line=dict(color='red', width=2),
                        yaxis='y'
                    ))
            except:
                pass  # Skip KDE if it fails

            fig.update_layout(
                title=f"Distribution of {col}",
                xaxis_title=col,
                yaxis_title="Count",
                showlegend=True,
                height=400,
                template="plotly_white"
            )

            plots.append({
                "column": col,
                "type": "histogram",
                "plotly_json": json.loads(fig.to_json())
            })

        # Categorical columns - bar charts
        for col in self.categorical_cols:
            value_counts = self.df[col].value_counts().head(20)
            if len(value_counts) == 0:
                continue

            fig = px.bar(
                x=value_counts.index.astype(str),
                y=value_counts.values,
                title=f"Top 20 Values in {col}",
                labels={"x": col, "y": "Count"}
            )
            fig.update_layout(
                showlegend=False,
                height=400,
                template="plotly_white",
                xaxis_tickangle=-45
            )
            fig.update_traces(marker_color='steelblue')

            plots.append({
                "column": col,
                "type": "bar",
                "plotly_json": json.loads(fig.to_json())
            })

        return plots

    def generate_correlation_matrix(self) -> Optional[Dict]:
        """Generate correlation heatmap for numeric columns"""
        if len(self.numerical_cols) < 2:
            return None

        corr_matrix = self.df[self.numerical_cols].corr()

        fig = px.imshow(
            corr_matrix,
            labels=dict(color="Correlation"),
            x=corr_matrix.columns,
            y=corr_matrix.columns,
            color_continuous_scale="RdBu_r",
            zmin=-1,
            zmax=1,
            title="Correlation Matrix",
            aspect="auto"
        )

        fig.update_layout(
            height=max(600, len(corr_matrix.columns) * 30),
            width=max(600, len(corr_matrix.columns) * 30),
            template="plotly_white"
        )

        # Add correlation values as text
        fig.update_traces(
            text=corr_matrix.round(2).values,
            texttemplate="%{text}",
            textfont={"size": 10}
        )

        return {
            "type": "correlation_matrix",
            "plotly_json": json.loads(fig.to_json())
        }

    def generate_bivariate_plots(self, target_col: Optional[str] = None) -> List[Dict]:
        """Generate scatter plots for numeric pairs or box plots for categorical vs numeric"""
        plots = []

        # If no target specified, generate top correlated pairs
        if len(self.numerical_cols) >= 2:
            corr_matrix = self.df[self.numerical_cols].corr()

            # Get top 5 correlated pairs
            correlations = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    correlations.append((
                        corr_matrix.columns[i],
                        corr_matrix.columns[j],
                        abs(corr_matrix.iloc[i, j])
                    ))

            top_pairs = sorted(correlations, key=lambda x: x[2], reverse=True)[:5]

            for col1, col2, corr in top_pairs:
                mask = ~(self.df[col1].isnull() | self.df[col2].isnull())
                if mask.sum() == 0:
                    continue

                fig = px.scatter(
                    self.df[mask],
                    x=col1,
                    y=col2,
                    title=f"{col1} vs {col2} (corr: {corr:.2f})",
                    trendline="ols"
                )
                fig.update_layout(
                    height=400,
                    template="plotly_white"
                )
                fig.update_traces(marker=dict(size=5, opacity=0.6))

                plots.append({
                    "columns": [col1, col2],
                    "type": "scatter",
                    "correlation": float(corr),
                    "plotly_json": json.loads(fig.to_json())
                })

        # Box plots for categorical vs numeric (limit to reasonable sizes)
        for cat_col in self.categorical_cols[:5]:  # Limit categorical columns
            if self.df[cat_col].nunique() > 10:
                continue

            for num_col in self.numerical_cols[:3]:  # Limit numeric columns
                mask = ~(self.df[cat_col].isnull() | self.df[num_col].isnull())
                if mask.sum() == 0:
                    continue

                fig = px.box(
                    self.df[mask],
                    x=cat_col,
                    y=num_col,
                    title=f"{num_col} by {cat_col}"
                )
                fig.update_layout(
                    height=400,
                    template="plotly_white",
                    xaxis_tickangle=-45
                )

                plots.append({
                    "columns": [cat_col, num_col],
                    "type": "box",
                    "plotly_json": json.loads(fig.to_json())
                })
                break  # Only one numeric per categorical

        return plots

    def generate_outlier_plots(self) -> List[Dict]:
        """Generate box plots for outlier detection"""
        plots = []

        for col in self.numerical_cols:
            col_data = self.df[col].dropna()
            if len(col_data) == 0:
                continue

            fig = px.box(
                self.df,
                y=col,
                title=f"Outlier Detection - {col}"
            )
            fig.update_layout(
                height=400,
                showlegend=False,
                template="plotly_white"
            )
            fig.update_traces(marker_color='steelblue', boxmean='sd')

            plots.append({
                "column": col,
                "type": "box_outlier",
                "plotly_json": json.loads(fig.to_json())
            })

        return plots

    def generate_insights(self, summary_stats: Dict) -> List[str]:
        """Generate automated insights from the data"""
        insights = []

        # Dataset overview
        insights.append(f"Dataset contains {len(self.df):,} rows and {len(self.df.columns)} columns")

        # Missing values
        missing_cols = [col for col, stats in summary_stats.items() if stats['null_count'] > 0]
        if missing_cols:
            total_missing_pct = sum(summary_stats[col]['null_percentage'] for col in missing_cols) / len(missing_cols)
            insights.append(
                f"{len(missing_cols)} columns have missing values (avg {total_missing_pct:.1f}%): "
                f"{', '.join(missing_cols[:5])}{' and more' if len(missing_cols) > 5 else ''}"
            )

        # High cardinality categoricals
        for col, stats in summary_stats.items():
            if 'unique_values' in stats and 'cardinality_percentage' in stats:
                cardinality_pct = stats['cardinality_percentage']
                if cardinality_pct > 50:
                    insights.append(
                        f"Column '{col}' has high cardinality ({stats['unique_values']} unique values, "
                        f"{cardinality_pct:.1f}% of rows)"
                    )

        # Numeric columns summary
        if self.numerical_cols:
            insights.append(f"Dataset has {len(self.numerical_cols)} numeric columns for analysis")

        # Skewness
        for col in self.numerical_cols:
            if col in summary_stats and 'skewness' in summary_stats[col]:
                skewness = summary_stats[col]['skewness']
                if abs(skewness) > 1:
                    direction = "right" if skewness > 0 else "left"
                    insights.append(
                        f"Column '{col}' is highly skewed to the {direction} (skewness: {skewness:.2f})"
                    )

        # Outliers
        for col in self.numerical_cols:
            if col in summary_stats and 'outliers' in summary_stats[col]:
                outlier_pct = summary_stats[col]['outliers']['iqr_percentage']
                if outlier_pct > 5:
                    insights.append(
                        f"Column '{col}' has {outlier_pct:.1f}% outliers detected by IQR method"
                    )

        # Constant or quasi-constant features
        for col, stats in summary_stats.items():
            if 'unique_values' in stats:
                if stats['unique_values'] == 1:
                    insights.append(f"Column '{col}' is constant (only one unique value)")
                elif stats['unique_values'] < len(self.df) * 0.01:
                    insights.append(
                        f"Column '{col}' is quasi-constant ({stats['unique_values']} unique values)"
                    )

        return insights

    def get_target_insights(self, target_column: str) -> Dict[str, Any]:
        """Get comprehensive insights about the target variable"""
        target = self.df[target_column]
        target_clean = target.dropna()

        insights = {
            "column_name": target_column,
            "missing_values": int(target.isnull().sum()),
            "missing_percentage": float(target.isnull().sum() / len(self.df) * 100),
            "target_type": "classification" if target.nunique() < 20 or self.df[target_column].dtype == 'object' else "regression"
        }

        if insights["target_type"] == "classification":
            value_counts = target_clean.value_counts()
            total_samples = len(target_clean)

            insights["distribution"] = {
                "class_counts": {str(k): int(v) for k, v in value_counts.items()},
                "class_percentages": {str(k): float(v/total_samples*100) for k, v in value_counts.items()},
                "num_classes": int(target.nunique()),
                "total_samples": int(total_samples)
            }

            majority_count = value_counts.max()
            minority_count = value_counts.min()
            imbalance_ratio = majority_count / minority_count

            insights["imbalance_analysis"] = {
                "has_imbalance": bool(imbalance_ratio > 1.5),
                "imbalance_ratio": float(imbalance_ratio),
                "majority_class": str(value_counts.idxmax()),
                "minority_class": str(value_counts.idxmin()),
                "majority_percentage": float(majority_count / total_samples * 100),
                "minority_percentage": float(minority_count / total_samples * 100)
            }
        else:
            insights["distribution"] = {
                "mean": float(target_clean.mean()),
                "median": float(target_clean.median()),
                "std": float(target_clean.std()),
                "min": float(target_clean.min()),
                "max": float(target_clean.max()),
                "skewness": float(stats.skew(target_clean)),
                "kurtosis": float(stats.kurtosis(target_clean)),
                "total_samples": int(len(target_clean))
            }

        return insights

    def get_missing_data_patterns(self) -> Dict[str, Any]:
        """Analyze missing data patterns"""
        missing_df = self.df.isnull()

        patterns = {
            "summary": {
                "total_missing": int(missing_df.sum().sum()),
                "total_cells": int(self.df.shape[0] * self.df.shape[1]),
                "missing_percentage": float(missing_df.sum().sum() / (self.df.shape[0] * self.df.shape[1]) * 100)
            },
            "by_column": {},
            "missing_correlations": {}
        }

        for col in self.df.columns:
            missing_count = missing_df[col].sum()
            patterns["by_column"][col] = {
                "missing_count": int(missing_count),
                "missing_percentage": float(missing_count / len(self.df) * 100)
            }

        if missing_df.sum().sum() > 0:
            cols_with_missing = missing_df.columns[missing_df.sum() > 0]
            if len(cols_with_missing) > 1:
                missing_corr = missing_df[cols_with_missing].corr()
                high_missing_corr = []

                for i in range(len(missing_corr.columns)):
                    for j in range(i+1, len(missing_corr.columns)):
                        corr_val = missing_corr.iloc[i, j]
                        if abs(corr_val) > 0.5:
                            high_missing_corr.append({
                                "column1": missing_corr.columns[i],
                                "column2": missing_corr.columns[j],
                                "correlation": float(corr_val)
                            })

                patterns["missing_correlations"] = {
                    "high_correlations": high_missing_corr,
                    "interpretation": "High correlation suggests missing values might not be random"
                }

        return patterns

    def get_data_quality_flags(self) -> Dict[str, Any]:
        """Check for data quality issues"""
        flags = {
            "constant_features": [],
            "quasi_constant_features": [],
            "highly_correlated_pairs": [],
            "mixed_type_columns": [],
            "inconsistent_categories": []
        }

        # Constant and quasi-constant features
        for col in self.df.columns:
            unique_ratio = self.df[col].nunique() / len(self.df)

            if self.df[col].nunique() == 1:
                constant_value = self.df[col].dropna().iloc[0] if len(self.df[col].dropna()) > 0 else None
                flags["constant_features"].append({
                    "column": col,
                    "value": str(constant_value) if constant_value is not None else "NULL"
                })
            elif unique_ratio < 0.01:
                value_counts = self.df[col].value_counts()
                most_common = value_counts.iloc[0] if len(value_counts) > 0 else 0
                most_common_value = value_counts.index[0] if len(value_counts) > 0 else None

                flags["quasi_constant_features"].append({
                    "column": col,
                    "unique_values": int(self.df[col].nunique()),
                    "unique_ratio": float(unique_ratio),
                    "most_common_value": str(most_common_value) if most_common_value is not None else "NULL",
                    "most_common_frequency": float(most_common / len(self.df))
                })

        # Highly correlated pairs
        if len(self.numerical_cols) > 1:
            corr_matrix = self.df[self.numerical_cols].corr()
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if abs(corr_val) > 0.9:
                        flags["highly_correlated_pairs"].append({
                            "feature1": corr_matrix.columns[i],
                            "feature2": corr_matrix.columns[j],
                            "correlation": float(corr_val)
                        })

        return flags

    def get_class_imbalance_analysis(self, target_column: str) -> Dict[str, Any]:
        """Analyze class imbalance for classification problems"""
        target = self.df[target_column]

        if target.nunique() > 20 and self.df[target_column].dtype != 'object':
            return {"error": "Target appears to be continuous. Class imbalance analysis is for classification problems."}

        value_counts = target.value_counts()
        total_samples = len(target)

        analysis = {
            "class_distribution": {},
            "class_percentages": {},
            "imbalance_metrics": {},
            "recommended_weights": {}
        }

        for class_name, count in value_counts.items():
            analysis["class_distribution"][str(class_name)] = int(count)
            analysis["class_percentages"][str(class_name)] = float(count / total_samples * 100)

        majority_class_count = value_counts.max()
        minority_class_count = value_counts.min()

        analysis["imbalance_metrics"] = {
            "imbalance_ratio": float(majority_class_count / minority_class_count),
            "minority_class": str(value_counts.idxmin()),
            "minority_class_percentage": float(minority_class_count / total_samples * 100),
            "majority_class": str(value_counts.idxmax()),
            "majority_class_percentage": float(majority_class_count / total_samples * 100)
        }

        # Calculate recommended class weights
        classes = sorted(target.unique())
        y = target.values

        class_weights = compute_class_weight(
            'balanced',
            classes=np.array(classes),
            y=y
        )

        analysis["recommended_weights"] = {
            "class_weights": {str(cls): float(weight) for cls, weight in zip(classes, class_weights)},
            "description": "Use these weights in your model's class_weight parameter"
        }

        imbalance_ratio = majority_class_count / minority_class_count
        if imbalance_ratio > 10:
            severity = "severe"
        elif imbalance_ratio > 5:
            severity = "moderate"
        elif imbalance_ratio > 2:
            severity = "mild"
        else:
            severity = "balanced"

        analysis["severity"] = severity

        return analysis

    def get_target_leakage_detection(self, target_column: str) -> Dict[str, Any]:
        """Detect potential target leakage"""
        leakage = {
            "perfect_correlations": [],
            "high_correlations": [],
            "suspicious_columns": [],
            "summary": {}
        }

        target = self.df[target_column]
        is_classification = target.nunique() < 20 or target.dtype == 'object'

        # Check numerical columns for perfect/high correlation
        numerical_cols = [col for col in self.numerical_cols if col != target_column]

        for col in numerical_cols:
            if self.df[col].isna().sum() / len(self.df) > 0.9:
                continue

            try:
                corr = self.df[col].corr(target)

                if not np.isnan(corr):
                    if abs(corr) == 1.0:
                        leakage["perfect_correlations"].append({
                            "column": col,
                            "correlation": float(corr),
                            "warning": "Perfect correlation detected - likely target leakage!",
                            "severity": "critical"
                        })
                    elif abs(corr) > 0.95:
                        leakage["high_correlations"].append({
                            "column": col,
                            "correlation": float(corr),
                            "warning": "Very high correlation - possible target leakage",
                            "severity": "high"
                        })
            except:
                pass

        # Check for suspicious column names
        suspicious_patterns = [
            'target', 'label', 'outcome', 'result', 'prediction', 'forecast',
            'y_pred', 'predicted', 'output', 'response'
        ]

        for col in self.df.columns:
            if col == target_column:
                continue

            col_lower = col.lower()
            for pattern in suspicious_patterns:
                if pattern in col_lower:
                    leakage["suspicious_columns"].append({
                        "column": col,
                        "reason": f"Column name contains '{pattern}'",
                        "severity": "medium"
                    })
                    break

        # Summary
        total_issues = (
            len(leakage["perfect_correlations"]) +
            len(leakage["high_correlations"]) +
            len(leakage["suspicious_columns"])
        )

        critical_issues = len(leakage["perfect_correlations"])
        high_issues = len(leakage["high_correlations"])

        leakage["summary"] = {
            "total_issues": total_issues,
            "critical_issues": critical_issues,
            "high_severity_issues": high_issues,
            "features_analyzed": len(self.df.columns) - 1,
            "risk_level": "critical" if critical_issues > 0 else "high" if high_issues > 0 else "low" if total_issues > 0 else "none"
        }

        return leakage

    def get_feature_engineering_suggestions(self) -> Dict[str, Any]:
        """Suggest feature engineering opportunities"""
        suggestions = {
            "datetime_features": [],
            "binning_candidates": [],
            "normalization_candidates": []
        }

        # Datetime feature extraction
        for col in self.datetime_cols:
            suggestions["datetime_features"].append({
                "column": col,
                "suggested_extractions": ["year", "month", "day", "dayofweek", "hour", "quarter", "is_weekend"]
            })

        # Binning candidates (highly skewed numerical features)
        for col in self.numerical_cols:
            col_data = self.df[col].dropna()
            if len(col_data) > 10:
                skewness = stats.skew(col_data)
                if abs(skewness) > 2:
                    suggestions["binning_candidates"].append({
                        "column": col,
                        "skewness": float(skewness),
                        "suggested_bins": [
                            {"method": "Quantile-based", "n_bins": 5},
                            {"method": "Equal-width", "n_bins": 5}
                        ]
                    })

        # Normalization candidates
        for col in self.numerical_cols:
            col_data = self.df[col].dropna()
            if len(col_data) > 10:
                skewness = stats.skew(col_data)
                kurtosis = stats.kurtosis(col_data)

                if abs(skewness) > 1 or abs(kurtosis) > 3:
                    suggested_transforms = []
                    if skewness > 1:
                        suggested_transforms.extend(["Log Transform", "Square Root Transform"])
                    elif skewness < -1:
                        suggested_transforms.append("Square Transform")
                    suggested_transforms.extend(["StandardScaler", "RobustScaler"])

                    suggestions["normalization_candidates"].append({
                        "column": col,
                        "skewness": float(skewness),
                        "kurtosis": float(kurtosis),
                        "suggested_transformations": suggested_transforms
                    })

        return suggestions

    def generate_multivariate_outlier_detection(self) -> Dict[str, Any]:
        """Detect multivariate outliers using Isolation Forest and LOF"""
        if len(self.numerical_cols) < 2:
            return {}

        numerical_df = self.df[self.numerical_cols].dropna()
        if len(numerical_df) < 20:
            return {}

        outliers = {}

        # Standardize data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numerical_df)

        # Isolation Forest
        iso_forest = IsolationForest(contamination=0.1, random_state=42)
        outliers_iso = iso_forest.fit_predict(scaled_data)
        iso_scores = iso_forest.score_samples(scaled_data)

        outliers["isolation_forest"] = {
            "outlier_count": int((outliers_iso == -1).sum()),
            "outlier_percentage": float((outliers_iso == -1).sum() / len(numerical_df) * 100),
            "outlier_indices": numerical_df.index[outliers_iso == -1].tolist()[:20],
            "anomaly_scores": {
                "min": float(iso_scores.min()),
                "max": float(iso_scores.max()),
                "threshold": float(iso_forest.score_samples(scaled_data[outliers_iso == -1]).mean() if (outliers_iso == -1).any() else 0)
            }
        }

        # Local Outlier Factor
        if len(numerical_df) > 20:
            lof = LocalOutlierFactor(n_neighbors=min(20, len(numerical_df) - 1), contamination=0.1)
            outliers_lof = lof.fit_predict(scaled_data)
            lof_scores = lof.negative_outlier_factor_

            outliers["local_outlier_factor"] = {
                "outlier_count": int((outliers_lof == -1).sum()),
                "outlier_percentage": float((outliers_lof == -1).sum() / len(numerical_df) * 100),
                "outlier_indices": numerical_df.index[outliers_lof == -1].tolist()[:20],
                "lof_scores": {
                    "min": float(lof_scores.min()),
                    "max": float(lof_scores.max()),
                    "threshold": float(np.percentile(lof_scores, 10))
                }
            }

        # Mahalanobis distance using Elliptic Envelope
        try:
            ee = EllipticEnvelope(contamination=0.1, random_state=42)
            outliers_mahal = ee.fit_predict(scaled_data)
            mahal_scores = ee.score_samples(scaled_data)

            outliers["mahalanobis"] = {
                "outlier_count": int((outliers_mahal == -1).sum()),
                "outlier_percentage": float((outliers_mahal == -1).sum() / len(numerical_df) * 100),
                "outlier_indices": numerical_df.index[outliers_mahal == -1].tolist()[:20],
                "threshold": float(np.percentile(mahal_scores, 10)),
                "min_score": float(mahal_scores.min()),
                "max_score": float(mahal_scores.max())
            }
        except:
            pass

        # DBSCAN clustering
        try:
            dbscan = DBSCAN(eps=0.5, min_samples=5)
            clusters = dbscan.fit_predict(scaled_data)
            outliers_dbscan = clusters == -1

            outliers["dbscan"] = {
                "outlier_count": int(outliers_dbscan.sum()),
                "outlier_percentage": float(outliers_dbscan.sum() / len(numerical_df) * 100),
                "outlier_indices": numerical_df.index[outliers_dbscan].tolist()[:20],
                "n_clusters": int(max(clusters)) + 1 if max(clusters) >= 0 else 0
            }
        except:
            pass

        return outliers

    def get_feature_importance(self, target_column: str) -> Dict[str, Any]:
        """Calculate preliminary feature importance using Random Forest and mutual information"""
        if target_column not in self.df.columns:
            return {"error": "Target column not found"}

        importance = {
            "method": "Random Forest + Mutual Information",
            "numerical_features": {},
            "categorical_features": {},
            "top_features": [],
            "mutual_information": {}
        }

        # Prepare data
        X = self.df.drop(columns=[target_column])
        y = self.df[target_column]

        # Handle missing values
        X_filled = X.copy()
        for col in X.columns:
            if X[col].dtype in [np.number]:
                X_filled[col] = X[col].fillna(X[col].mean())
            else:
                X_filled[col] = X[col].fillna('missing')

        # Encode categorical variables
        categorical_cols = X.select_dtypes(include=['object', 'category']).columns
        X_encoded = X_filled.copy()

        for col in categorical_cols:
            le = LabelEncoder()
            X_encoded[col] = le.fit_transform(X_filled[col].astype(str))

        # Determine if classification or regression
        if y.nunique() < 20 or y.dtype == 'object':
            model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
            task_type = "classification"
            if y.dtype == 'object':
                le_target = LabelEncoder()
                y_encoded = le_target.fit_transform(y)
            else:
                y_encoded = y
        else:
            model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
            task_type = "regression"
            y_encoded = y

        # Fit model and get importances
        model.fit(X_encoded, y_encoded)

        # Get feature importances
        importances = model.feature_importances_
        feature_importance_dict = {}

        for idx, col in enumerate(X.columns):
            feature_importance_dict[col] = float(importances[idx])

        # Sort by importance
        sorted_features = sorted(feature_importance_dict.items(), key=lambda x: x[1], reverse=True)

        # Separate numerical and categorical
        for col, imp in feature_importance_dict.items():
            if col in self.numerical_cols:
                importance["numerical_features"][col] = imp
            else:
                importance["categorical_features"][col] = imp

        # Top features
        importance["top_features"] = [
            {"feature": feat, "importance": imp}
            for feat, imp in sorted_features[:10]
        ]

        importance["task_type"] = task_type

        # Calculate mutual information
        try:
            if task_type == "classification":
                mi_scores = mutual_info_classif(X_encoded, y_encoded, random_state=42)
            else:
                mi_scores = mutual_info_regression(X_encoded, y_encoded, random_state=42)

            mi_dict = {}
            for idx, col in enumerate(X.columns):
                mi_dict[col] = float(mi_scores[idx])

            importance["mutual_information"] = mi_dict
        except:
            importance["mutual_information"] = {}

        return importance

    def get_detailed_univariate_analysis(self) -> Dict[str, Any]:
        """Get detailed univariate analysis with KDE and boxplot data"""
        analysis = {
            "numerical": {},
            "categorical": {}
        }

        # Numerical features
        for col in self.numerical_cols:
            col_data = self.df[col].dropna()
            if len(col_data) == 0:
                continue

            # Calculate statistics
            stats_dict = {
                "mean": float(col_data.mean()),
                "median": float(col_data.median()),
                "std": float(col_data.std()),
                "min": float(col_data.min()),
                "max": float(col_data.max()),
                "q1": float(col_data.quantile(0.25)),
                "q3": float(col_data.quantile(0.75)),
                "iqr": float(col_data.quantile(0.75) - col_data.quantile(0.25)),
                "skewness": float(stats.skew(col_data)),
                "kurtosis": float(stats.kurtosis(col_data)),
                "missing_count": int(self.df[col].isnull().sum()),
                "missing_percentage": float(self.df[col].isnull().sum() / len(self.df) * 100)
            }

            # Outlier detection
            q1, q3 = col_data.quantile([0.25, 0.75])
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outliers_iqr = col_data[(col_data < lower_bound) | (col_data > upper_bound)]

            # Z-score outliers
            z_scores = np.abs(stats.zscore(col_data))
            outliers_zscore = col_data[z_scores > 3]

            stats_dict["outliers"] = {
                "iqr_count": int(len(outliers_iqr)),
                "iqr_percentage": float(len(outliers_iqr) / len(col_data) * 100),
                "zscore_count": int(len(outliers_zscore)),
                "zscore_percentage": float(len(outliers_zscore) / len(col_data) * 100)
            }

            # Histogram data
            hist_data, bin_edges = np.histogram(col_data, bins=30)
            stats_dict["histogram"] = {
                "counts": hist_data.tolist(),
                "bins": bin_edges.tolist()
            }

            # KDE data
            try:
                kde = gaussian_kde(col_data)
                x_range = np.linspace(col_data.min(), col_data.max(), 100)
                kde_values = kde(x_range)
                stats_dict["kde"] = {
                    "x": x_range.tolist(),
                    "y": kde_values.tolist()
                }
            except:
                stats_dict["kde"] = None

            # Boxplot data
            stats_dict["boxplot"] = {
                "min": float(col_data.min()),
                "q1": float(q1),
                "median": float(col_data.median()),
                "q3": float(q3),
                "max": float(col_data.max()),
                "outliers": outliers_iqr.tolist() if len(outliers_iqr) < 100 else outliers_iqr[:100].tolist()
            }

            analysis["numerical"][col] = stats_dict

        # Categorical features
        for col in self.categorical_cols:
            value_counts = self.df[col].value_counts()

            cat_stats = {
                "unique_values": int(self.df[col].nunique()),
                "cardinality": float(self.df[col].nunique() / len(self.df) * 100),
                "missing_count": int(self.df[col].isnull().sum()),
                "missing_percentage": float(self.df[col].isnull().sum() / len(self.df) * 100),
                "value_counts": value_counts.to_dict(),
                "value_percentages": (value_counts / len(self.df) * 100).round(2).to_dict(),
                "rare_categories": []
            }

            # Identify rare categories (< 1% of data)
            for cat, count in value_counts.items():
                if count / len(self.df) < 0.01:
                    cat_stats["rare_categories"].append({
                        "category": str(cat),
                        "count": int(count),
                        "percentage": float(count / len(self.df) * 100)
                    })

            analysis["categorical"][col] = cat_stats

        return analysis

    def get_multivariate_analysis(self) -> Dict[str, Any]:
        """Perform multivariate analysis with PCA"""
        analysis = {}

        # Correlation matrix for numerical features
        if len(self.numerical_cols) > 1:
            corr_matrix = self.df[self.numerical_cols].corr()

            # Find highly correlated pairs
            high_corr_pairs = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if abs(corr_val) > 0.9:
                        high_corr_pairs.append({
                            "feature1": corr_matrix.columns[i],
                            "feature2": corr_matrix.columns[j],
                            "correlation": float(corr_val)
                        })

            analysis["correlation_matrix"] = {
                "matrix": corr_matrix.to_dict(),
                "high_correlation_pairs": high_corr_pairs
            }

            # PCA analysis
            if len(self.numerical_cols) > 2:
                numerical_clean = self.df[self.numerical_cols].dropna()
                if len(numerical_clean) > 10:
                    scaler = StandardScaler()
                    scaled_data = scaler.fit_transform(numerical_clean)

                    pca = PCA(n_components=min(3, len(self.numerical_cols)))
                    pca_result = pca.fit_transform(scaled_data)

                    analysis["pca"] = {
                        "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
                        "cumulative_variance_ratio": np.cumsum(pca.explained_variance_ratio_).tolist(),
                        "components": pca.components_.tolist(),
                        "feature_names": self.numerical_cols
                    }

        return analysis

    def get_dimensionality_reduction_analysis(self) -> Dict[str, Any]:
        """Comprehensive dimensionality reduction analysis with PCA, t-SNE, and component interpretation"""
        analysis = {
            "pca": {},
            "tsne": {},
            "dimensionality_assessment": {},
            "recommendations": []
        }

        if len(self.numerical_cols) < 2:
            return {"error": "Need at least 2 numerical features for dimensionality reduction"}

        # Prepare data
        numerical_clean = self.df[self.numerical_cols].dropna()
        if len(numerical_clean) < 10:
            return {"error": "Insufficient data for dimensionality reduction (need at least 10 samples)"}

        # Standardize data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numerical_clean)

        # PCA Analysis (all components)
        n_features = len(self.numerical_cols)
        pca_full = PCA(n_components=min(n_features, len(numerical_clean)))
        pca_result_full = pca_full.fit_transform(scaled_data)

        # Calculate cumulative variance
        cumulative_variance = np.cumsum(pca_full.explained_variance_ratio_)

        # Find number of components for 95% variance
        n_components_95 = int(np.argmax(cumulative_variance >= 0.95) + 1) if any(cumulative_variance >= 0.95) else n_features

        analysis["pca"] = {
            "n_components": int(pca_full.n_components_),
            "explained_variance_ratio": pca_full.explained_variance_ratio_.tolist(),
            "explained_variance": pca_full.explained_variance_.tolist(),
            "cumulative_variance_ratio": cumulative_variance.tolist(),
            "n_components_for_95_variance": n_components_95,
            "feature_names": self.numerical_cols,
            "components": pca_full.components_.tolist(),
            "component_contributions": {}
        }

        # Get top contributing features for each principal component (top 3)
        for i in range(min(3, pca_full.n_components_)):
            component = pca_full.components_[i]
            # Get absolute values and sort
            abs_component = np.abs(component)
            top_indices = np.argsort(abs_component)[-5:][::-1]  # Top 5 features

            contributions = []
            for idx in top_indices:
                contributions.append({
                    "feature": self.numerical_cols[idx],
                    "loading": float(component[idx]),
                    "abs_loading": float(abs_component[idx])
                })

            analysis["pca"]["component_contributions"][f"PC{i+1}"] = contributions

        # t-SNE Analysis (if dataset is suitable)
        if len(numerical_clean) >= 30:  # t-SNE needs sufficient samples
            from sklearn.manifold import TSNE

            try:
                perplexity = min(30, len(numerical_clean) - 1)
                tsne = TSNE(n_components=2, random_state=42, perplexity=perplexity, n_iter=1000)
                tsne_result = tsne.fit_transform(scaled_data)

                analysis["tsne"] = {
                    "n_components": 2,
                    "perplexity": perplexity,
                    "kl_divergence": float(tsne.kl_divergence_),
                    "n_iter": int(tsne.n_iter_),
                    "coordinates": {
                        "tsne_1": tsne_result[:, 0].tolist()[:100],  # Limit for JSON size
                        "tsne_2": tsne_result[:, 1].tolist()[:100]
                    },
                    "note": "t-SNE is primarily for visualization and preserves local structure"
                }
            except Exception as e:
                analysis["tsne"] = {"error": f"t-SNE failed: {str(e)}"}
        else:
            analysis["tsne"] = {"error": "Insufficient samples for t-SNE (need at least 30)"}

        # Dimensionality Assessment
        intrinsic_dim = n_components_95
        original_dim = n_features

        analysis["dimensionality_assessment"] = {
            "original_dimensions": original_dim,
            "intrinsic_dimensions": intrinsic_dim,
            "dimensionality_reduction_potential": float((original_dim - intrinsic_dim) / original_dim * 100),
            "variance_preserved_95": float(cumulative_variance[n_components_95 - 1] * 100) if n_components_95 > 0 else 0
        }

        # Recommendations
        reduction_potential = (original_dim - intrinsic_dim) / original_dim * 100

        if reduction_potential > 50:
            analysis["recommendations"].append(
                f"High dimensionality reduction potential: Can reduce from {original_dim} to {intrinsic_dim} "
                f"dimensions while retaining 95% variance"
            )
            analysis["recommendations"].append(
                "Consider using PCA for preprocessing to reduce computational cost and potential overfitting"
            )
        elif reduction_potential > 25:
            analysis["recommendations"].append(
                f"Moderate dimensionality reduction possible: {original_dim} to {intrinsic_dim} dimensions"
            )
        else:
            analysis["recommendations"].append(
                "Low dimensionality reduction potential - most features contain unique information"
            )

        if analysis["pca"]["explained_variance_ratio"][0] > 0.5:
            analysis["recommendations"].append(
                f"First principal component explains {analysis['pca']['explained_variance_ratio'][0]*100:.1f}% "
                "of variance - strong linear structure present"
            )

        if len(analysis["pca"]["high_correlation_pairs"] if "high_correlation_pairs" in analysis.get("correlation_matrix", {}) else []) > 0:
            analysis["recommendations"].append(
                "High feature correlations detected - PCA can help remove redundancy"
            )

        return analysis

    def generate_pca_visualization(self, target_column: Optional[str] = None) -> Optional[Dict]:
        """Generate PCA 2D scatter plot visualization"""
        if len(self.numerical_cols) < 2:
            return None

        numerical_clean = self.df[self.numerical_cols].dropna()
        if len(numerical_clean) < 10:
            return None

        # Standardize data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numerical_clean)

        # Perform PCA
        pca = PCA(n_components=2)
        pca_result = pca.fit_transform(scaled_data)

        # Create visualization
        fig = go.Figure()

        if target_column and target_column in self.df.columns:
            target_values = self.df.loc[numerical_clean.index, target_column]

            if target_values.nunique() < 20:  # Categorical target
                for value in target_values.unique():
                    mask = target_values == value
                    fig.add_trace(go.Scatter(
                        x=pca_result[mask, 0],
                        y=pca_result[mask, 1],
                        mode='markers',
                        name=str(value),
                        marker=dict(size=8, opacity=0.7)
                    ))
            else:  # Continuous target
                fig.add_trace(go.Scatter(
                    x=pca_result[:, 0],
                    y=pca_result[:, 1],
                    mode='markers',
                    marker=dict(
                        size=8,
                        color=target_values,
                        colorscale='Viridis',
                        showscale=True,
                        colorbar=dict(title=target_column),
                        opacity=0.7
                    ),
                    name='Data Points'
                ))
        else:
            fig.add_trace(go.Scatter(
                x=pca_result[:, 0],
                y=pca_result[:, 1],
                mode='markers',
                marker=dict(size=8, color='steelblue', opacity=0.7),
                name='Data Points'
            ))

        fig.update_layout(
            title=f"PCA Projection{' (colored by ' + target_column + ')' if target_column else ''}",
            xaxis_title=f"PC1 ({pca.explained_variance_ratio_[0]*100:.1f}% variance)",
            yaxis_title=f"PC2 ({pca.explained_variance_ratio_[1]*100:.1f}% variance)",
            height=500,
            template="plotly_white",
            showlegend=True
        )

        return {
            "type": "pca_2d",
            "plotly_json": json.loads(fig.to_json())
        }

    def generate_tsne_visualization(self, target_column: Optional[str] = None) -> Optional[Dict]:
        """Generate t-SNE 2D scatter plot visualization"""
        if len(self.numerical_cols) < 2:
            return None

        numerical_clean = self.df[self.numerical_cols].dropna()
        if len(numerical_clean) < 30:  # t-SNE needs more samples
            return None

        # Standardize data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numerical_clean)

        # Perform t-SNE
        from sklearn.manifold import TSNE
        try:
            perplexity = min(30, len(numerical_clean) - 1)
            tsne = TSNE(n_components=2, random_state=42, perplexity=perplexity, n_iter=1000)
            tsne_result = tsne.fit_transform(scaled_data)
        except Exception as e:
            return {"error": f"t-SNE failed: {str(e)}"}

        # Create visualization
        fig = go.Figure()

        if target_column and target_column in self.df.columns:
            target_values = self.df.loc[numerical_clean.index, target_column]

            if target_values.nunique() < 20:  # Categorical target
                for value in target_values.unique():
                    mask = target_values == value
                    fig.add_trace(go.Scatter(
                        x=tsne_result[mask, 0],
                        y=tsne_result[mask, 1],
                        mode='markers',
                        name=str(value),
                        marker=dict(size=8, opacity=0.7)
                    ))
            else:  # Continuous target
                fig.add_trace(go.Scatter(
                    x=tsne_result[:, 0],
                    y=tsne_result[:, 1],
                    mode='markers',
                    marker=dict(
                        size=8,
                        color=target_values,
                        colorscale='Viridis',
                        showscale=True,
                        colorbar=dict(title=target_column),
                        opacity=0.7
                    ),
                    name='Data Points'
                ))
        else:
            fig.add_trace(go.Scatter(
                x=tsne_result[:, 0],
                y=tsne_result[:, 1],
                mode='markers',
                marker=dict(size=8, color='steelblue', opacity=0.7),
                name='Data Points'
            ))

        fig.update_layout(
            title=f"t-SNE Projection{' (colored by ' + target_column + ')' if target_column else ''}",
            xaxis_title="t-SNE Component 1",
            yaxis_title="t-SNE Component 2",
            height=500,
            template="plotly_white",
            showlegend=True
        )

        return {
            "type": "tsne_2d",
            "plotly_json": json.loads(fig.to_json()),
            "kl_divergence": float(tsne.kl_divergence_)
        }

    def generate_scree_plot(self) -> Optional[Dict]:
        """Generate PCA scree plot showing explained variance"""
        if len(self.numerical_cols) < 2:
            return None

        numerical_clean = self.df[self.numerical_cols].dropna()
        if len(numerical_clean) < 10:
            return None

        # Standardize data
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numerical_clean)

        # Perform PCA on all components
        n_features = len(self.numerical_cols)
        pca = PCA(n_components=min(n_features, len(numerical_clean)))
        pca.fit(scaled_data)

        cumulative_variance = np.cumsum(pca.explained_variance_ratio_)

        # Create figure with secondary y-axis
        fig = make_subplots(specs=[[{"secondary_y": True}]])

        # Add bar chart for individual variance
        fig.add_trace(
            go.Bar(
                x=[f"PC{i+1}" for i in range(pca.n_components_)],
                y=pca.explained_variance_ratio_,
                name="Individual Variance",
                marker_color='steelblue'
            ),
            secondary_y=False
        )

        # Add line for cumulative variance
        fig.add_trace(
            go.Scatter(
                x=[f"PC{i+1}" for i in range(pca.n_components_)],
                y=cumulative_variance,
                name="Cumulative Variance",
                mode='lines+markers',
                line=dict(color='red', width=2),
                marker=dict(size=8)
            ),
            secondary_y=True
        )

        # Add horizontal line at 95%
        fig.add_hline(
            y=0.95,
            line_dash="dash",
            line_color="green",
            annotation_text="95% threshold",
            secondary_y=True
        )

        fig.update_xaxes(title_text="Principal Components")
        fig.update_yaxes(title_text="Explained Variance Ratio", secondary_y=False)
        fig.update_yaxes(title_text="Cumulative Variance Ratio", secondary_y=True)

        fig.update_layout(
            title="PCA Scree Plot - Explained Variance by Component",
            height=500,
            template="plotly_white",
            showlegend=True
        )

        return {
            "type": "scree_plot",
            "plotly_json": json.loads(fig.to_json())
        }

    def generate_full_report(self, analysis_types: List[str], target_column: Optional[str] = None) -> Dict:
        """Generate complete EDA report"""
        report = {
            "summary_statistics": self.generate_summary_statistics(),
            "visualizations": {},
            "insights": [],
            "target_column": target_column
        }

        if "univariate" in analysis_types:
            report["visualizations"]["univariate"] = self.generate_univariate_plots()
            # Add detailed univariate analysis
            report["detailed_univariate_analysis"] = self.get_detailed_univariate_analysis()

        if "correlation" in analysis_types:
            corr_plot = self.generate_correlation_matrix()
            if corr_plot:
                report["visualizations"]["correlation_matrix"] = corr_plot

        if "bivariate" in analysis_types:
            report["visualizations"]["bivariate"] = self.generate_bivariate_plots()

        if "outliers" in analysis_types:
            report["visualizations"]["outlier_detection"] = self.generate_outlier_plots()

        # Dimensionality reduction analysis and visualizations
        if "dimensionality_reduction" in analysis_types or "multivariate" in analysis_types:
            dim_reduction = self.get_dimensionality_reduction_analysis()
            if "error" not in dim_reduction:
                report["dimensionality_reduction"] = dim_reduction

                # Add dimensionality reduction visualizations
                pca_viz = self.generate_pca_visualization(target_column)
                if pca_viz:
                    if "dimensionality_reduction_viz" not in report["visualizations"]:
                        report["visualizations"]["dimensionality_reduction_viz"] = []
                    report["visualizations"]["dimensionality_reduction_viz"].append(pca_viz)

                tsne_viz = self.generate_tsne_visualization(target_column)
                if tsne_viz and "error" not in tsne_viz:
                    if "dimensionality_reduction_viz" not in report["visualizations"]:
                        report["visualizations"]["dimensionality_reduction_viz"] = []
                    report["visualizations"]["dimensionality_reduction_viz"].append(tsne_viz)

                scree_viz = self.generate_scree_plot()
                if scree_viz:
                    if "dimensionality_reduction_viz" not in report["visualizations"]:
                        report["visualizations"]["dimensionality_reduction_viz"] = []
                    report["visualizations"]["dimensionality_reduction_viz"].append(scree_viz)

        # Add target-specific analyses if target is provided
        if target_column and target_column in self.df.columns:
            report["target_insights"] = self.get_target_insights(target_column)
            report["class_imbalance_analysis"] = self.get_class_imbalance_analysis(target_column)
            report["target_leakage_detection"] = self.get_target_leakage_detection(target_column)
            report["feature_importance"] = self.get_feature_importance(target_column)

        # Add additional analyses
        report["missing_data_patterns"] = self.get_missing_data_patterns()
        report["data_quality_flags"] = self.get_data_quality_flags()
        report["feature_engineering_suggestions"] = self.get_feature_engineering_suggestions()
        report["multivariate_outliers"] = self.generate_multivariate_outlier_detection()
        report["multivariate_analysis"] = self.get_multivariate_analysis()

        report["insights"] = self.generate_insights(report["summary_statistics"])

        return report
