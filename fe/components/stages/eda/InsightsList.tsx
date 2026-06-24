"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, AlertTriangle, Info } from "lucide-react";

interface Props {
  insights: string[];
}

export function InsightsList({ insights }: Props) {
  if (!insights || insights.length === 0) {
    return null;
  }

  // Categorize insights based on keywords
  const getInsightIcon = (insight: string) => {
    const lowerInsight = insight.toLowerCase();
    if (
      lowerInsight.includes("correlation") ||
      lowerInsight.includes("relationship") ||
      lowerInsight.includes("trend")
    ) {
      return <TrendingUp className="h-4 w-4 text-blue-600" />;
    }
    if (
      lowerInsight.includes("warning") ||
      lowerInsight.includes("outlier") ||
      lowerInsight.includes("missing") ||
      lowerInsight.includes("skew")
    ) {
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    }
    return <Info className="h-4 w-4 text-cyan-600" />;
  };

  const getInsightStyle = (insight: string) => {
    const lowerInsight = insight.toLowerCase();
    if (
      lowerInsight.includes("warning") ||
      lowerInsight.includes("outlier") ||
      lowerInsight.includes("missing") ||
      lowerInsight.includes("skew")
    ) {
      return "bg-amber-50 border-amber-200 hover:bg-amber-100";
    }
    if (
      lowerInsight.includes("correlation") ||
      lowerInsight.includes("relationship")
    ) {
      return "bg-blue-50 border-blue-200 hover:bg-blue-100";
    }
    return "bg-cyan-50 border-cyan-200 hover:bg-cyan-100";
  };

  return (
    <Card className="eda-card border border-slate-200 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-cyan-50 via-blue-50 to-transparent pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl eda-heading">Key Insights</CardTitle>
            <p className="text-sm text-slate-600 eda-mono mt-1">
              {insights.length} automated discoveries from your data
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-3">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-all duration-300 ${getInsightStyle(
                insight
              )}`}
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            >
              <div className="flex-shrink-0 mt-0.5">{getInsightIcon(insight)}</div>
              <p className="text-sm text-slate-800 leading-relaxed flex-1">
                {insight}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
