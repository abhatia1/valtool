"use client";

import { useState, useEffect } from "react";
import { Sparkles, Lightbulb, BarChart3, LineChart, PieChart, Activity, Target, AlertCircle, AlertTriangle, Search, TrendingUp, Shield, Zap, GitBranch, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EDAClient } from "@/lib/api/eda";
import { datasetsApi } from "@/lib/api/datasets";
import type { EDAReport } from "@/types/eda";
import { SummaryStatisticsTable } from "./eda/SummaryStatisticsTable";
import { InsightsList } from "./eda/InsightsList";
import { VisualizationGrid } from "./eda/VisualizationGrid";
import { CorrelationMatrix } from "./eda/CorrelationMatrix";

interface Props {
  datasetId: string | null;
  onProceedToNext?: () => void;
}

export function EDAStage({ datasetId, onProceedToNext }: Props) {
  const [loading, setLoading] = useState(false);
  const [edaReport, setEdaReport] = useState<EDAReport | null>(null);
  const [targetColumn, setTargetColumn] = useState<string | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Fetch dataset columns when component mounts or datasetId changes
  useEffect(() => {
    const fetchColumns = async () => {
      if (!datasetId) return;

      setLoadingColumns(true);
      try {
        const dataset = await datasetsApi.getDetails(datasetId);
        if (dataset.column_types) {
          setAvailableColumns(Object.keys(dataset.column_types));
        }
      } catch (error) {
        console.error("Failed to fetch dataset columns:", error);
      } finally {
        setLoadingColumns(false);
      }
    };

    fetchColumns();
  }, [datasetId]);

  const handleGenerateEDA = async () => {
    if (!datasetId) {
      return;
    }

    setLoading(true);
    try {
      const report = await EDAClient.generate({
        dataset_id: datasetId,
        analysis_types: ["univariate", "correlation", "bivariate", "outliers", "dimensionality_reduction"],
        target_column: targetColumn || undefined,
      });

      console.log("EDA Report received:", report);
      console.log("Dimensionality Reduction:", report.dimensionality_reduction);
      console.log("Dimensionality Reduction Viz:", report.visualizations.dimensionality_reduction_viz);

      setEdaReport(report);

      // Update available columns if needed
      if (report.summary_statistics && availableColumns.length === 0) {
        setAvailableColumns(Object.keys(report.summary_statistics));
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail || "Failed to generate EDA report";
      console.error("EDA generation error:", error);
      // TODO: Add toast notification instead of alert
    } finally {
      setLoading(false);
    }
  };

  const univariateCount = edaReport?.visualizations.univariate.length || 0;
  const bivariateCount = edaReport?.visualizations.bivariate.length || 0;
  const outlierCount = edaReport?.visualizations.outlier_detection.length || 0;
  const hasCorrelation = edaReport?.visualizations.correlation_matrix !== null;
  const dimReductionCount = edaReport?.visualizations.dimensionality_reduction_viz?.length || 0;
  const hasDimReduction = !!edaReport?.dimensionality_reduction;

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .eda-container {
          font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .eda-heading {
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .eda-mono {
          font-family: 'IBM Plex Mono', monospace;
          font-feature-settings: 'liga' 1, 'calt' 1;
        }

        .eda-grid-bg {
          background-image:
            linear-gradient(rgba(37, 99, 235, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37, 99, 235, 0.02) 1px, transparent 1px);
          background-size: 24px 24px;
          position: relative;
        }

        .eda-grid-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.04), transparent 60%);
          pointer-events: none;
        }

        .eda-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .eda-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .eda-stagger-1 { animation-delay: 0.1s; opacity: 0; }
        .eda-stagger-2 { animation-delay: 0.2s; opacity: 0; }
        .eda-stagger-3 { animation-delay: 0.3s; opacity: 0; }

        .section-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          font-size: 13px;
          font-weight: 600;
          font-family: 'IBM Plex Mono', monospace;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
        }

        .eda-btn-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .eda-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }

        .eda-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(226, 232, 240, 0.7);
          transition: all 0.3s ease;
        }

        .eda-card:hover {
          border-color: rgba(37, 99, 235, 0.3);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
        }
      `}</style>

      <div className="eda-container eda-grid-bg p-8 rounded-2xl border border-slate-200/60 bg-white/40 backdrop-blur-sm">
        {/* Header */}
        <div className="mb-8 eda-fade-in space-y-6">
          <div>
            <h2 className="text-3xl eda-heading text-slate-900 mb-2">
              Exploratory Data Analysis
            </h2>
            <p className="text-slate-600 eda-mono text-xs tracking-wide font-light">
              {edaReport
                ? `Report generated • ${new Date(edaReport.generated_at).toLocaleString()}`
                : "Configure your analysis parameters below"}
            </p>
          </div>

          {/* Configuration Card */}
          {!edaReport && (
            <Card className="border-slate-200/60 bg-white/90 backdrop-blur-sm shadow-sm">
              <CardContent className="p-6 space-y-5">
                {/* Target Column Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" strokeWidth={2} />
                    <label className="text-sm font-medium text-slate-900">
                      Target Variable <span className="text-slate-400 font-light">(Optional)</span>
                    </label>
                  </div>
                  <select
                    value={targetColumn || ""}
                    onChange={(e) => setTargetColumn(e.target.value || null)}
                    disabled={loadingColumns}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">No target variable</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 font-light">
                    Selecting a target enables advanced insights like feature importance and leakage detection
                  </p>
                </div>

                {/* Analyze Button */}
                <Button
                  onClick={handleGenerateEDA}
                  disabled={loading || !datasetId || loadingColumns}
                  size="lg"
                  className="w-full eda-btn-primary text-white border-0 px-8 py-6 text-base font-medium"
                >
                  <Sparkles className="mr-2 h-5 w-5" strokeWidth={2} />
                  {loading ? (
                    <span className="eda-shimmer">Analyzing Data...</span>
                  ) : (
                    "Analyze Dataset"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Re-analyze Section - Only show after report is generated */}
          {edaReport && (
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50/50 to-gold-50/30 rounded-xl border border-blue-200/40 backdrop-blur-sm">
              <div className="flex-1 flex items-center gap-3">
                <Target className="w-5 h-5 text-blue-600" strokeWidth={2} />
                <select
                  value={targetColumn || ""}
                  onChange={(e) => setTargetColumn(e.target.value || null)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors"
                >
                  <option value="">No target variable</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleGenerateEDA}
                disabled={loading}
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/20 transition-all px-6"
              >
                {loading ? "Re-analyzing..." : "Re-analyze"}
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {edaReport ? (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {/* 1. Dataset Overview */}
            <AccordionItem value="overview" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">1</span>
                  <BarChart3 className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">Dataset Overview</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6">
                  <InsightsList insights={edaReport.insights} />
                  <SummaryStatisticsTable stats={edaReport.summary_statistics} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Univariate Analysis */}
            <AccordionItem value="univariate" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">2</span>
                  <LineChart className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">Univariate Analysis ({univariateCount})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <VisualizationGrid
                  edaId={edaReport.eda_id}
                  category="univariate"
                  count={univariateCount}
                />
              </AccordionContent>
            </AccordionItem>

            {/* 3. Bivariate Analysis */}
            <AccordionItem value="bivariate" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">3</span>
                  <PieChart className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">Bivariate Analysis ({bivariateCount})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <VisualizationGrid
                  edaId={edaReport.eda_id}
                  category="bivariate"
                  count={bivariateCount}
                />
              </AccordionContent>
            </AccordionItem>

            {/* 4. Multivariate Analysis */}
            {hasCorrelation && (
              <AccordionItem value="multivariate" className="eda-card rounded-lg px-4">
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <span className="section-number">4</span>
                    <Activity className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold">Multivariate Analysis</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <CorrelationMatrix edaId={edaReport.eda_id} />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 4.5. Dimensionality Reduction */}
            {hasDimReduction && edaReport.dimensionality_reduction && (
              <AccordionItem value="dimensionality-reduction" className="eda-card rounded-xl px-5 py-1">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="section-number">4.5</span>
                    <Layers className="w-5 h-5 text-blue-600" strokeWidth={2} />
                    <span className="font-semibold text-slate-900 eda-heading text-base">
                      Dimensionality Reduction Analysis ({dimReductionCount} visualizations)
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    {/* Dimensionality Assessment */}
                    <Card>
                      <CardContent className="p-6">
                        <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <Layers className="w-5 h-5 text-blue-600" />
                          Dimensionality Assessment
                        </h4>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Original Dimensions</p>
                            <p className="text-2xl font-semibold">{edaReport.dimensionality_reduction.dimensionality_assessment.original_dimensions}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Intrinsic Dimensions</p>
                            <p className="text-2xl font-semibold text-blue-600">{edaReport.dimensionality_reduction.dimensionality_assessment.intrinsic_dimensions}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Reduction Potential</p>
                            <p className="text-2xl font-semibold text-green-600">
                              {edaReport.dimensionality_reduction.dimensionality_assessment.dimensionality_reduction_potential.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 mb-1">95% Variance</p>
                            <p className="text-2xl font-semibold">{edaReport.dimensionality_reduction.dimensionality_assessment.variance_preserved_95.toFixed(1)}%</p>
                          </div>
                        </div>
                        {edaReport.dimensionality_reduction.recommendations.length > 0 && (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="font-semibold text-blue-900 mb-2">Recommendations</h5>
                            <ul className="space-y-1">
                              {edaReport.dimensionality_reduction.recommendations.map((rec, idx) => (
                                <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                                  <span className="text-blue-600 mt-0.5">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* PCA Component Contributions */}
                    <Card>
                      <CardContent className="p-6">
                        <h4 className="font-semibold text-lg mb-4">Principal Component Analysis (PCA)</h4>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Total Components</p>
                            <p className="text-xl font-semibold">{edaReport.dimensionality_reduction.pca.n_components}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 mb-1">Components for 95% Variance</p>
                            <p className="text-xl font-semibold text-blue-600">{edaReport.dimensionality_reduction.pca.n_components_for_95_variance}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 mb-1">PC1 Variance</p>
                            <p className="text-xl font-semibold">{(edaReport.dimensionality_reduction.pca.explained_variance_ratio[0] * 100).toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* Top Contributing Features per Component */}
                        <div className="space-y-4 mt-6">
                          <h5 className="font-semibold text-sm text-slate-700">Top Contributing Features by Component</h5>
                          {Object.entries(edaReport.dimensionality_reduction.pca.component_contributions).map(([component, contributions]) => (
                            <div key={component} className="p-4 bg-slate-50 rounded-lg">
                              <h6 className="font-semibold text-sm mb-3 text-slate-900">{component}</h6>
                              <div className="space-y-2">
                                {contributions.map((contrib, idx) => (
                                  <div key={idx} className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{contrib.feature}</span>
                                    <div className="flex items-center gap-3">
                                      <div className="w-32 bg-white rounded-full h-2">
                                        <div
                                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                                          style={{ width: `${contrib.abs_loading * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-mono text-slate-600 w-16 text-right">
                                        {contrib.loading.toFixed(3)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* t-SNE Info */}
                    {edaReport.dimensionality_reduction.tsne && !('error' in edaReport.dimensionality_reduction.tsne) && (
                      <Card>
                        <CardContent className="p-6">
                          <h4 className="font-semibold text-lg mb-4">t-SNE Analysis</h4>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-sm text-slate-600 mb-1">Perplexity</p>
                              <p className="text-xl font-semibold">{edaReport.dimensionality_reduction.tsne.perplexity}</p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600 mb-1">KL Divergence</p>
                              <p className="text-xl font-semibold">{edaReport.dimensionality_reduction.tsne.kl_divergence.toFixed(4)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600 mb-1">Iterations</p>
                              <p className="text-xl font-semibold">{edaReport.dimensionality_reduction.tsne.n_iter}</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded">
                            {edaReport.dimensionality_reduction.tsne.note}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Visualizations */}
                    {dimReductionCount > 0 && (
                      <Card>
                        <CardContent className="p-6">
                          <h4 className="font-semibold text-lg mb-4">Visualizations</h4>
                          <VisualizationGrid
                            edaId={edaReport.eda_id}
                            category="dimensionality_reduction"
                            count={dimReductionCount}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 5. Target Variable Insights */}
            <AccordionItem value="target" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">5</span>
                  <Target className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">
                    Target Variable Insights
                    {edaReport.target_insights?.column_name && ` - ${edaReport.target_insights.column_name}`}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {edaReport.target_insights ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Target Type</p>
                          <p className="text-xl font-semibold capitalize">{edaReport.target_insights.target_type}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Missing Values</p>
                          <p className="text-xl font-semibold">{edaReport.target_insights.missing_percentage.toFixed(2)}%</p>
                        </CardContent>
                      </Card>
                    </div>

                    {edaReport.target_insights.imbalance_analysis && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">Class Imbalance</h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-slate-600">Imbalance Ratio</p>
                              <p className="text-lg font-semibold">{edaReport.target_insights.imbalance_analysis.imbalance_ratio.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Majority Class</p>
                              <p className="text-sm font-medium">{edaReport.target_insights.imbalance_analysis.majority_class} ({edaReport.target_insights.imbalance_analysis.majority_percentage.toFixed(1)}%)</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Minority Class</p>
                              <p className="text-sm font-medium">{edaReport.target_insights.imbalance_analysis.minority_class} ({edaReport.target_insights.imbalance_analysis.minority_percentage.toFixed(1)}%)</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.target_insights.distribution && typeof edaReport.target_insights.distribution === 'object' && 'class_counts' in edaReport.target_insights.distribution && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">Class Distribution</h4>
                          <div className="space-y-2">
                            {Object.entries(edaReport.target_insights.distribution.class_counts).map(([cls, count]) => (
                              <div key={cls} className="flex items-center justify-between">
                                <span className="text-sm font-medium">{cls}</span>
                                <span className="text-sm text-slate-600">{count} ({edaReport.target_insights?.distribution.class_percentages[cls].toFixed(1)}%)</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-slate-600">
                      <p className="eda-mono text-sm">
                        Select a target variable above to see detailed insights and relationships
                      </p>
                    </CardContent>
                  </Card>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 6. Feature Importance */}
            {edaReport.feature_importance && (
              <AccordionItem value="feature-importance" className="eda-card rounded-lg px-4">
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <span className="section-number">6</span>
                    <Zap className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold">
                      Feature Importance ({edaReport.feature_importance.task_type})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">Top 10 Important Features</h4>
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {edaReport.feature_importance.method}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {edaReport.feature_importance.top_features.map((item, idx) => (
                            <div key={item.feature} className="flex items-center gap-3">
                              <span className="text-xs font-medium text-slate-500 w-8">#{idx + 1}</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{item.feature}</span>
                                  <span className="text-xs text-slate-600">{(item.importance * 100).toFixed(2)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                  <div
                                    className="bg-gradient-to-r from-blue-500 to-blue-500 h-2 rounded-full transition-all"
                                    style={{ width: `${item.importance * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {Object.keys(edaReport.feature_importance.mutual_information).length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3">Mutual Information Scores</h4>
                          <p className="text-xs text-slate-600 mb-3">
                            Mutual information measures the dependency between features and target
                          </p>
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {Object.entries(edaReport.feature_importance.mutual_information)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 10)
                              .map(([feature, score]) => (
                                <div key={feature} className="flex items-center justify-between text-sm">
                                  <span className="font-medium">{feature}</span>
                                  <span className="text-slate-600">{typeof score === 'number' ? score.toFixed(4) : score}</span>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 7. Missing Data Patterns */}
            <AccordionItem value="missing" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">7</span>
                  <AlertCircle className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">
                    Missing Data Patterns
                    {edaReport.missing_data_patterns && ` (${edaReport.missing_data_patterns.summary.missing_percentage.toFixed(2)}% missing)`}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {edaReport.missing_data_patterns ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Total Missing</p>
                          <p className="text-xl font-semibold">{edaReport.missing_data_patterns.summary.total_missing}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Total Cells</p>
                          <p className="text-xl font-semibold">{edaReport.missing_data_patterns.summary.total_cells}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Missing %</p>
                          <p className="text-xl font-semibold">{edaReport.missing_data_patterns.summary.missing_percentage.toFixed(2)}%</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-3">Missing Values by Column</h4>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {Object.entries(edaReport.missing_data_patterns.by_column)
                            .filter(([, stats]) => stats.missing_count > 0)
                            .sort((a, b) => b[1].missing_percentage - a[1].missing_percentage)
                            .map(([col, stats]) => (
                              <div key={col} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                <span className="text-sm font-medium">{col}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm text-slate-600">{stats.missing_count} missing</span>
                                  <span className="text-sm font-semibold text-red-600">{stats.missing_percentage.toFixed(2)}%</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-slate-600">
                      <p className="eda-mono text-sm">No missing data analysis available</p>
                    </CardContent>
                  </Card>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 8. Data Quality Flags */}
            <AccordionItem value="quality" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">8</span>
                  <AlertTriangle className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">Data Quality Flags</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <InsightsList insights={edaReport.insights} />
              </AccordionContent>
            </AccordionItem>

            {/* 9. Feature Engineering Suggestions */}
            <AccordionItem value="engineering" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">9</span>
                  <Lightbulb className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">Feature Engineering Suggestions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {edaReport.feature_engineering_suggestions ? (
                  <div className="space-y-4">
                    {edaReport.feature_engineering_suggestions.binning_candidates.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3">Binning Candidates (Highly Skewed)</h4>
                          <div className="space-y-3">
                            {edaReport.feature_engineering_suggestions.binning_candidates.map((candidate: any) => (
                              <div key={candidate.column} className="p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">{candidate.column}</span>
                                  <span className="text-sm text-slate-600">Skewness: {candidate.skewness.toFixed(2)}</span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  {candidate.suggested_bins.map((bin: any, idx: number) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                      {bin.method} ({bin.n_bins} bins)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.feature_engineering_suggestions.normalization_candidates.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3">Normalization Candidates</h4>
                          <div className="space-y-3">
                            {edaReport.feature_engineering_suggestions.normalization_candidates.map((candidate: any) => (
                              <div key={candidate.column} className="p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">{candidate.column}</span>
                                  <div className="text-xs text-slate-600">
                                    Skew: {candidate.skewness.toFixed(2)} | Kurt: {candidate.kurtosis.toFixed(2)}
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  {candidate.suggested_transformations.map((transform: string, idx: number) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                      {transform}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.feature_engineering_suggestions.datetime_features.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3">Datetime Feature Extraction</h4>
                          <div className="space-y-2">
                            {edaReport.feature_engineering_suggestions.datetime_features.map((feature: any) => (
                              <div key={feature.column} className="p-3 bg-slate-50 rounded-lg">
                                <span className="font-medium">{feature.column}</span>
                                <p className="text-xs text-slate-600 mt-1">
                                  Suggested: {feature.suggested_extractions.join(', ')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-slate-600">
                      <p className="eda-mono text-sm">No feature engineering suggestions available</p>
                    </CardContent>
                  </Card>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 10. Outlier Detection */}
            <AccordionItem value="outliers" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">10</span>
                  <Search className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">Outlier Detection ({outlierCount})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <VisualizationGrid
                  edaId={edaReport.eda_id}
                  category="outlier"
                  count={outlierCount}
                />
              </AccordionContent>
            </AccordionItem>

            {/* 11. Multivariate Outliers */}
            {edaReport.multivariate_outliers && Object.keys(edaReport.multivariate_outliers).length > 0 && (
              <AccordionItem value="multivariate-outliers" className="eda-card rounded-lg px-4">
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <span className="section-number">11</span>
                    <GitBranch className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold">Multivariate Outlier Detection</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {edaReport.multivariate_outliers.isolation_forest && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Isolation Forest</span>
                          </h4>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-600">Outliers Detected</p>
                              <p className="text-lg font-semibold">{edaReport.multivariate_outliers.isolation_forest.outlier_count}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Percentage</p>
                              <p className="text-lg font-semibold text-red-600">
                                {edaReport.multivariate_outliers.isolation_forest.outlier_percentage.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Anomaly Threshold</p>
                              <p className="text-sm font-mono">
                                {edaReport.multivariate_outliers.isolation_forest.anomaly_scores?.threshold.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">
                            Isolation Forest isolates anomalies by randomly selecting features and split values
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.multivariate_outliers.local_outlier_factor && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Local Outlier Factor</span>
                          </h4>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-600">Outliers Detected</p>
                              <p className="text-lg font-semibold">{edaReport.multivariate_outliers.local_outlier_factor.outlier_count}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Percentage</p>
                              <p className="text-lg font-semibold text-red-600">
                                {edaReport.multivariate_outliers.local_outlier_factor.outlier_percentage.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">LOF Threshold</p>
                              <p className="text-sm font-mono">
                                {edaReport.multivariate_outliers.local_outlier_factor.lof_scores?.threshold.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">
                            LOF identifies outliers by comparing local density to neighbors densities
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.multivariate_outliers.mahalanobis && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Mahalanobis Distance</span>
                          </h4>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-600">Outliers Detected</p>
                              <p className="text-lg font-semibold">{edaReport.multivariate_outliers.mahalanobis.outlier_count}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Percentage</p>
                              <p className="text-lg font-semibold text-red-600">
                                {edaReport.multivariate_outliers.mahalanobis.outlier_percentage.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Score Range</p>
                              <p className="text-sm font-mono">
                                {edaReport.multivariate_outliers.mahalanobis.min_score.toFixed(2)} to{' '}
                                {edaReport.multivariate_outliers.mahalanobis.max_score.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">
                            Mahalanobis distance detects outliers based on distance from data center considering covariance
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.multivariate_outliers.dbscan && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">DBSCAN</span>
                          </h4>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-600">Noise Points</p>
                              <p className="text-lg font-semibold">{edaReport.multivariate_outliers.dbscan.outlier_count}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Percentage</p>
                              <p className="text-lg font-semibold text-red-600">
                                {edaReport.multivariate_outliers.dbscan.outlier_percentage.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">Clusters Found</p>
                              <p className="text-lg font-semibold">{edaReport.multivariate_outliers.dbscan.n_clusters}</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">
                            DBSCAN marks low-density points as outliers (noise points)
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 12. Class Imbalance Analysis */}
            {edaReport.class_imbalance_analysis && !edaReport.class_imbalance_analysis.error && (
            <AccordionItem value="imbalance" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">12</span>
                  <TrendingUp className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">
                    Class Imbalance Analysis
                    {edaReport.class_imbalance_analysis && ` (${edaReport.class_imbalance_analysis.severity})`}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {edaReport.class_imbalance_analysis && !edaReport.class_imbalance_analysis.error ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Severity</p>
                          <p className="text-xl font-semibold capitalize">{edaReport.class_imbalance_analysis.severity}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Imbalance Ratio</p>
                          <p className="text-xl font-semibold">{edaReport.class_imbalance_analysis.imbalance_metrics.imbalance_ratio.toFixed(2)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Majority Class</p>
                          <p className="text-sm font-medium">{edaReport.class_imbalance_analysis.imbalance_metrics.majority_class}</p>
                          <p className="text-xs text-slate-500">{edaReport.class_imbalance_analysis.imbalance_metrics.majority_class_percentage.toFixed(1)}%</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Minority Class</p>
                          <p className="text-sm font-medium">{edaReport.class_imbalance_analysis.imbalance_metrics.minority_class}</p>
                          <p className="text-xs text-slate-500">{edaReport.class_imbalance_analysis.imbalance_metrics.minority_class_percentage.toFixed(1)}%</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-3">Class Distribution</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(edaReport.class_imbalance_analysis.class_distribution).map(([cls, count]) => (
                            <div key={cls} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                              <span className="font-medium">{cls}</span>
                              <span className="text-sm text-slate-600">
                                {count} ({edaReport.class_imbalance_analysis!.class_percentages[cls].toFixed(1)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {edaReport.class_imbalance_analysis.recommended_weights && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-3">Recommended Class Weights</h4>
                          <p className="text-sm text-slate-600 mb-3">{edaReport.class_imbalance_analysis.recommended_weights.description}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(edaReport.class_imbalance_analysis.recommended_weights.class_weights).map(([cls, weight]) => (
                              <div key={cls} className="p-2 bg-blue-50 rounded text-center">
                                <p className="text-xs text-slate-600">{cls}</p>
                                <p className="text-sm font-semibold">{(weight as number).toFixed(3)}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-slate-600">
                      <p className="eda-mono text-sm">
                        {edaReport.class_imbalance_analysis?.error ||
                         "Select a classification target variable to see class imbalance analysis"}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </AccordionContent>
            </AccordionItem>
            )}

            {/* 13. Target Leakage Detection */}
            {edaReport.target_leakage_detection && (
            <AccordionItem value="leakage" className="eda-card rounded-xl px-5 py-1">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="section-number">11</span>
                  <Shield className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  <span className="font-semibold text-slate-900 eda-heading text-base">
                    Target Leakage Detection
                    {edaReport.target_leakage_detection && ` (${edaReport.target_leakage_detection.summary.risk_level})`}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {edaReport.target_leakage_detection ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Risk Level</p>
                          <p className="text-xl font-semibold capitalize">{edaReport.target_leakage_detection.summary.risk_level}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Total Issues</p>
                          <p className="text-xl font-semibold">{edaReport.target_leakage_detection.summary.total_issues}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">Critical</p>
                          <p className="text-xl font-semibold text-red-600">{edaReport.target_leakage_detection.summary.critical_issues}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600 mb-1">High Severity</p>
                          <p className="text-xl font-semibold text-orange-600">{edaReport.target_leakage_detection.summary.high_severity_issues}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {edaReport.target_leakage_detection.perfect_correlations.length > 0 && (
                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-red-900 mb-3">⚠️ Perfect Correlations (Critical)</h4>
                          <div className="space-y-2">
                            {edaReport.target_leakage_detection.perfect_correlations.map((leak: any, idx: number) => (
                              <div key={idx} className="p-3 bg-white rounded-lg border border-red-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{leak.column}</span>
                                  <span className="text-sm font-semibold text-red-600">Corr: {leak.correlation.toFixed(3)}</span>
                                </div>
                                <p className="text-sm text-red-800">{leak.warning}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.target_leakage_detection.high_correlations.length > 0 && (
                      <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-orange-900 mb-3">High Correlations</h4>
                          <div className="space-y-2">
                            {edaReport.target_leakage_detection.high_correlations.map((leak: any, idx: number) => (
                              <div key={idx} className="p-3 bg-white rounded-lg border border-orange-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{leak.column}</span>
                                  <span className="text-sm font-semibold text-orange-600">Corr: {leak.correlation.toFixed(3)}</span>
                                </div>
                                <p className="text-sm text-orange-800">{leak.warning}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.target_leakage_detection.suspicious_columns.length > 0 && (
                      <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-yellow-900 mb-3">Suspicious Column Names</h4>
                          <div className="space-y-2">
                            {edaReport.target_leakage_detection.suspicious_columns.map((susp: any, idx: number) => (
                              <div key={idx} className="p-2 bg-white rounded border border-yellow-200">
                                <span className="font-medium">{susp.column}</span>
                                <p className="text-sm text-yellow-800">{susp.reason}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {edaReport.target_leakage_detection.summary.total_issues === 0 && (
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="py-8 text-center">
                          <p className="text-green-900 font-semibold">✓ No obvious target leakage detected</p>
                          <p className="text-sm text-green-700 mt-2">Good feature hygiene!</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-slate-600">
                      <p className="eda-mono text-sm">
                        Select a target variable to detect potential target leakage
                      </p>
                    </CardContent>
                  </Card>
                )}
              </AccordionContent>
            </AccordionItem>
            )}
          </Accordion>
        ) : (
          <Card className="eda-card border-dashed border-2 border-blue-200/60 bg-gradient-to-br from-blue-50/30 to-slate-50">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 blur-2xl opacity-20" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  <Lightbulb className="h-10 w-10 text-blue-600" strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-2xl eda-heading text-slate-900 mb-3">
                No Analysis Yet
              </h3>
              <p className="text-slate-600 text-center max-w-md text-sm font-light leading-relaxed">
                Click "Generate Analysis" to explore your dataset with automated statistics,
                visualizations, and insights
              </p>
            </CardContent>
          </Card>
        )}

        {/* Proceed Button */}
        {edaReport && onProceedToNext && (
          <div className="flex justify-end mt-8 eda-fade-in">
            <Button
              onClick={onProceedToNext}
              size="lg"
              className="eda-btn-primary text-white border-0 px-8 font-medium shadow-lg"
            >
              Proceed to Configuration
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
