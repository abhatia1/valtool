"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Zap, Loader2 } from "lucide-react";
import { generateExperimentName } from "@/lib/api/experiments";
import { datasetsApi } from "@/lib/api/datasets";

interface ExperimentSetupPanelProps {
  datasetId: string;
  onSetupChange: (setup: ExperimentSetup) => void;
  initialSetup?: ExperimentSetup;
}

export interface ExperimentSetup {
  saveAsExperiment: boolean;
  experimentName: string;
  experimentDescription: string;
}

export function ExperimentSetupPanel({
  datasetId,
  onSetupChange,
  initialSetup,
}: ExperimentSetupPanelProps) {
  const [saveAsExperiment, setSaveAsExperiment] = useState(
    initialSetup?.saveAsExperiment ?? true
  );
  const [experimentName, setExperimentName] = useState(
    initialSetup?.experimentName ?? ""
  );
  const [experimentDescription, setExperimentDescription] = useState(
    initialSetup?.experimentDescription ?? ""
  );
  const [loading, setLoading] = useState(true);

  // Load dataset info for auto-generating name
  useEffect(() => {
    const loadDataset = async () => {
      try {
        const details = await datasetsApi.getDetails(datasetId);

        // Auto-generate name only if no initial name was provided
        if (!initialSetup?.experimentName) {
          const autoName = generateExperimentName(details.name || "dataset", "classification");
          setExperimentName(autoName);
        }
      } catch (err) {
        console.error("Failed to load dataset:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDataset();
  }, [datasetId, initialSetup?.experimentName]);

  // Update parent when values change
  useEffect(() => {
    onSetupChange({
      saveAsExperiment,
      experimentName,
      experimentDescription,
    });
  }, [saveAsExperiment, experimentName, experimentDescription, onSetupChange]);

  const handleOptionChange = (save: boolean) => {
    setSaveAsExperiment(save);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl config-heading text-slate-900">
          Save as Experiment?
        </h2>
        <p className="text-slate-600 text-sm font-light tracking-wide max-w-xl mx-auto">
          Saved experiments can be accessed later for benchmarking, monitoring, and comparison.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {/* Yes, save as experiment */}
        <div className="relative group">
          <input
            type="radio"
            value="yes"
            id="save-yes"
            className="peer sr-only"
            checked={saveAsExperiment}
            onChange={() => handleOptionChange(true)}
          />
          <Label htmlFor="save-yes" className="cursor-pointer block h-full">
            <Card
              className={`
                relative h-full transition-all duration-300
                border overflow-hidden
                ${saveAsExperiment
                  ? "border-blue-500 bg-blue-50/30 shadow-lg shadow-blue-500/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                }
              `}
            >
              <CardHeader className="relative z-10 space-y-4 p-6">
                <div className="flex items-start justify-between">
                  <div
                    className={`
                      p-3 rounded-xl transition-all duration-300
                      ${saveAsExperiment
                        ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20"
                        : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                      }
                    `}
                  >
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <Badge className="bg-gradient-to-r from-gold-500 to-gold-600 text-white border-0 shadow-sm">
                    Recommended
                  </Badge>
                </div>

                <div className="space-y-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Yes, save as experiment
                  </CardTitle>
                  <CardDescription className="text-slate-600 leading-relaxed text-sm">
                    Track this training run. Access results later for benchmarking and monitoring.
                  </CardDescription>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Benefits
                  </p>
                  <ul className="text-sm text-slate-700 space-y-1">
                    <li>Compare models across experiments</li>
                    <li>Run benchmarking on test data</li>
                    <li>Monitor for data drift</li>
                  </ul>
                </div>

                {/* Selection Indicator */}
                <div
                  className={`
                    absolute top-6 right-6 w-5 h-5 rounded-full border-2 flex items-center justify-center
                    transition-all duration-300
                    ${saveAsExperiment
                      ? "border-blue-500 bg-blue-500"
                      : "border-slate-300 bg-white"
                    }
                  `}
                >
                  {saveAsExperiment && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </CardHeader>
            </Card>
          </Label>
        </div>

        {/* No, quick training only */}
        <div className="relative group">
          <input
            type="radio"
            value="no"
            id="save-no"
            className="peer sr-only"
            checked={!saveAsExperiment}
            onChange={() => handleOptionChange(false)}
          />
          <Label htmlFor="save-no" className="cursor-pointer block h-full">
            <Card
              className={`
                relative h-full transition-all duration-300
                border overflow-hidden
                ${!saveAsExperiment
                  ? "border-blue-500 bg-blue-50/30 shadow-lg shadow-blue-500/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                }
              `}
            >
              <CardHeader className="relative z-10 space-y-4 p-6">
                <div className="flex items-start justify-between">
                  <div
                    className={`
                      p-3 rounded-xl transition-all duration-300
                      ${!saveAsExperiment
                        ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20"
                        : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                      }
                    `}
                  >
                    <Zap className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    No, quick training only
                  </CardTitle>
                  <CardDescription className="text-slate-600 leading-relaxed text-sm">
                    Train models without saving. Results available during this session only.
                  </CardDescription>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Use for
                  </p>
                  <ul className="text-sm text-slate-700 space-y-1">
                    <li>Quick exploratory training</li>
                    <li>Testing configurations</li>
                    <li>One-off experiments</li>
                  </ul>
                </div>

                {/* Selection Indicator */}
                <div
                  className={`
                    absolute top-6 right-6 w-5 h-5 rounded-full border-2 flex items-center justify-center
                    transition-all duration-300
                    ${!saveAsExperiment
                      ? "border-blue-500 bg-blue-500"
                      : "border-slate-300 bg-white"
                    }
                  `}
                >
                  {!saveAsExperiment && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </CardHeader>
            </Card>
          </Label>
        </div>
      </div>

      {/* Experiment Details (only shown when saving) */}
      {saveAsExperiment && (
        <Card className="border-slate-200/60 bg-white/90 backdrop-blur-sm shadow-sm max-w-2xl mx-auto">
          <CardHeader className="space-y-4 p-6">
            <div className="space-y-2">
              <CardTitle className="text-lg font-semibold text-slate-900">
                Experiment Details
              </CardTitle>
              <CardDescription className="text-slate-600 text-sm">
                Give your experiment a memorable name
              </CardDescription>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="experiment-name" className="text-sm font-medium text-slate-900">
                  Experiment Name
                </Label>
                <Input
                  id="experiment-name"
                  value={experimentName}
                  onChange={(e) => setExperimentName(e.target.value)}
                  placeholder="e.g., iris_classification_20250128"
                  className="h-11 border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500">
                  Auto-generated from dataset name. Feel free to customize.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experiment-description" className="text-sm font-medium text-slate-900">
                  Description <span className="text-slate-400">(optional)</span>
                </Label>
                <Textarea
                  id="experiment-description"
                  value={experimentDescription}
                  onChange={(e) => setExperimentDescription(e.target.value)}
                  placeholder="Add notes about this experiment..."
                  rows={3}
                  className="border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {saveAsExperiment && experimentName && (
        <div className="p-4 bg-blue-50/50 border border-blue-200/60 rounded-xl max-w-2xl mx-auto">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Experiment will be saved as:</span>{" "}
            <span className="font-mono">{experimentName}</span>
          </p>
        </div>
      )}
    </div>
  );
}
