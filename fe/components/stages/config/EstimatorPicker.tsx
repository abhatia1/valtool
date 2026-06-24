"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckSquare, Square, Sparkles } from "lucide-react";
import { configApi } from "@/lib/api/config";
import type { TaskType, EstimatorInfo } from "@/types/config";

interface EstimatorPickerProps {
  taskType: TaskType;
  selected: string[];
  onChange: (estimators: string[]) => void;
}

export function EstimatorPicker({ taskType, selected, onChange }: EstimatorPickerProps) {
  const [estimators, setEstimators] = useState<EstimatorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEstimators = async () => {
      setLoading(true);
      try {
        const response = await configApi.getEstimators(taskType);
        setEstimators(response.estimators);
      } catch (err: any) {
        setError(err.message || "Failed to load estimators");
      } finally {
        setLoading(false);
      }
    };

    fetchEstimators();
  }, [taskType]);

  const toggleEstimator = (estimatorId: string) => {
    if (selected.includes(estimatorId)) {
      onChange(selected.filter((id) => id !== estimatorId));
    } else {
      onChange([...selected, estimatorId]);
    }
  };

  const selectAll = () => {
    onChange(estimators.map((e) => e.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  // Group estimators by category
  const grouped = estimators.reduce((acc, est) => {
    if (!acc[est.category]) acc[est.category] = [];
    acc[est.category].push(est);
    return acc;
  }, {} as Record<string, EstimatorInfo[]>);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50/50 border border-red-200/60 rounded-xl text-center">
        <p className="text-red-700 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl config-heading text-slate-900">Select ML Algorithms</h3>
          <p className="text-slate-600 text-sm font-light mt-1">
            {selected.length} of {estimators.length} estimators selected
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={selected.length === 0}
            className="border-slate-300 hover:border-slate-400"
          >
            <Square className="w-4 h-4 mr-2" />
            Clear All
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={selectAll}
            disabled={selected.length === estimators.length}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/20"
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Select All
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-500 rounded-full shadow-sm"
          style={{
            width: `${(selected.length / estimators.length) * 100}%`,
          }}
        />
      </div>

      {/* Estimators by Category */}
      <ScrollArea className="h-[500px] pr-4">
        <Accordion type="multiple" defaultValue={Object.keys(grouped)} className="space-y-3">
          {Object.entries(grouped).map(([category, ests]) => {
            const selectedInCategory = ests.filter((e) => selected.includes(e.id)).length;

            return (
              <AccordionItem
                key={category}
                value={category}
                className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <div className="w-1 h-12 rounded-full bg-gradient-to-b from-blue-600 to-blue-500" />
                      <div className="text-left">
                        <h4 className="text-base font-semibold text-slate-900 capitalize">
                          {category.replace(/_/g, " ")}
                        </h4>
                        <p className="text-xs text-slate-600 font-light">
                          {selectedInCategory} of {ests.length} selected
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={selectedInCategory > 0 ? "default" : "outline"}
                      className={selectedInCategory > 0
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0 shadow-sm"
                        : "border-slate-300 text-slate-600"}
                    >
                      {selectedInCategory}/{ests.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                  <div className="space-y-3 pt-2">
                    {ests.map((est) => {
                      const isSelected = selected.includes(est.id);

                      return (
                        <div
                          key={est.id}
                          className={`
                            flex items-start gap-4 p-4 rounded-lg border transition-all duration-200 cursor-pointer
                            ${isSelected
                              ? "border-blue-300 bg-blue-50/30 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }
                          `}
                          onClick={() => toggleEstimator(est.id)}
                        >
                          <Checkbox
                            id={est.id}
                            checked={isSelected}
                            onCheckedChange={() => toggleEstimator(est.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={est.id}
                                className="text-sm font-semibold text-slate-900 cursor-pointer"
                              >
                                {est.name}
                              </label>
                              {Object.keys(est.tunable_params).length > 0 && (
                                <Sparkles className="w-4 h-4 text-gold-500" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {est.description}
                            </p>
                            {Object.keys(est.tunable_params).length > 0 && (
                              <p className="text-xs text-slate-500 mt-2">
                                {Object.keys(est.tunable_params).length} tunable parameters
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>

      {/* Footer Note */}
      {selected.length === 0 && (
        <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">No estimators selected.</span> Select at least one
            algorithm to proceed with training.
          </p>
        </div>
      )}
    </div>
  );
}
