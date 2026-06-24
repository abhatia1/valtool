"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Zap, Target, Microscope } from "lucide-react";
import { configApi } from "@/lib/api/config";
import type { ConfigTemplate } from "@/types/config";

interface TemplateSelectorProps {
  onSelect: (template: ConfigTemplate) => void;
  selectedTemplateId?: string;
}

const templateIcons = {
  quick_start: Zap,
  standard: Target,
  deep_search: Microscope,
};

export function TemplateSelector({ onSelect, selectedTemplateId }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await configApi.getTemplates();
        setTemplates(response.templates);
      } catch (err: any) {
        setError(err.message || "Failed to load templates");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      onSelect(template);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-64 rounded-xl bg-slate-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50/50 border border-red-200/60 rounded-xl">
        <p className="text-red-700 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl config-heading text-slate-900">
          Choose Your Training Strategy
        </h2>
        <p className="text-slate-600 text-sm font-light tracking-wide">
          Select a configuration template to get started quickly
        </p>
      </div>

      <RadioGroup
        value={selectedTemplateId}
        onValueChange={handleTemplateChange}
        className="grid gap-6 md:grid-cols-3"
      >
        {templates.map((template, index) => {
          const Icon = templateIcons[template.id as keyof typeof templateIcons] || Target;
          const isRecommended = template.id === "standard";
          const isSelected = selectedTemplateId === template.id;

          return (
            <div key={template.id} className="relative group">
              <input
                type="radio"
                value={template.id}
                id={template.id}
                className="peer sr-only"
                checked={isSelected}
                onChange={() => handleTemplateChange(template.id)}
              />
              <Label
                htmlFor={template.id}
                className="cursor-pointer block"
              >
                <Card
                  className={`
                    relative h-full transition-all duration-300
                    border overflow-hidden
                    ${isSelected
                      ? "border-blue-500 bg-blue-50/30 shadow-lg shadow-blue-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                    }
                  `}
                  style={{
                    animationDelay: `${index * 0.1}s`,
                  }}
                >
                  <CardHeader className="relative z-10 space-y-4 p-6">
                    {/* Icon and Badge Row */}
                    <div className="flex items-start justify-between">
                      <div className={`
                        p-3 rounded-xl transition-all duration-300
                        ${isSelected
                          ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20"
                          : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                        }
                      `}>
                        <Icon className="w-6 h-6" />
                      </div>
                      {isRecommended && (
                        <Badge className="bg-gradient-to-r from-gold-500 to-gold-600 text-white border-0 shadow-sm">
                          Recommended
                        </Badge>
                      )}
                    </div>

                    {/* Template Info */}
                    <div className="space-y-2">
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="text-slate-600 leading-relaxed text-sm">
                        {template.description}
                      </CardDescription>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          CV Folds
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {template.config.model_selection.cv_folds}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          Search
                        </p>
                        <p className="text-base font-semibold text-slate-900 capitalize">
                          {template.config.hyperparameter_tuning.search_method}
                        </p>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    <div className={`
                      absolute top-6 right-6 w-5 h-5 rounded-full border-2 flex items-center justify-center
                      transition-all duration-300
                      ${isSelected
                        ? "border-blue-500 bg-blue-500"
                        : "border-slate-300 bg-white"
                      }
                    `}>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      {selectedTemplateId && (
        <div className="p-4 bg-blue-50/50 border border-blue-200/60 rounded-xl">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Template selected!</span> You can customize the
            configuration in the next steps.
          </p>
        </div>
      )}
    </div>
  );
}
