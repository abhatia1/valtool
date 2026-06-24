"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Grid3x3, Shuffle, Sparkles } from "lucide-react";
import type { HyperparameterTuningConfig, SearchMethod } from "@/types/config";

interface HyperparameterTuningPanelProps {
  config: HyperparameterTuningConfig;
  onChange: (config: HyperparameterTuningConfig) => void;
}

const SEARCH_METHODS = [
  {
    value: "grid" as SearchMethod,
    label: "Grid Search",
    description: "Exhaustive search over all parameter combinations",
    icon: Grid3x3,
    details: "Best for small parameter spaces with guaranteed optimal results",
  },
  {
    value: "random" as SearchMethod,
    label: "Random Search",
    description: "Random sampling of parameter combinations",
    icon: Shuffle,
    details: "Efficient for large parameter spaces with faster convergence",
  },
  {
    value: "bayesian" as SearchMethod,
    label: "Bayesian Optimization",
    description: "Intelligent search using past evaluation results",
    icon: Sparkles,
    details: "Most efficient for expensive evaluations with smart exploration",
  },
];

export function HyperparameterTuningPanel({ config, onChange }: HyperparameterTuningPanelProps) {
  return (
    <div className="space-y-8">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl config-heading text-slate-900" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Hyperparameter Tuning
        </h2>
        <p className="text-slate-600 text-sm font-light tracking-wide" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Optimize model parameters for peak performance
        </p>
      </div>

      {/* Search Method Selection */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-slate-900" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Search Strategy
        </Label>
        <RadioGroup
          value={config.search_method}
          onValueChange={(value: SearchMethod) =>
            onChange({ ...config, search_method: value })
          }
          className="grid gap-4"
        >
          {SEARCH_METHODS.map((method) => {
            const Icon = method.icon;
            const isSelected = config.search_method === method.value;

            return (
              <div key={method.value} className="relative group">
                <input
                  type="radio"
                  value={method.value}
                  id={`method-${method.value}`}
                  className="peer sr-only"
                  checked={isSelected}
                  onChange={() => onChange({ ...config, search_method: method.value })}
                />
                <Label
                  htmlFor={`method-${method.value}`}
                  className="cursor-pointer block"
                >
                  {/* Glow Effect */}
                  <div
                    className={`absolute inset-0 rounded-xl blur-xl transition-all duration-500 ${
                      isSelected
                        ? "bg-gradient-to-br from-blue-400/30 to-gold-400/30 opacity-100 scale-105"
                        : "opacity-0"
                    }`}
                  />

                  <Card
                    className={`
                      relative transition-all duration-500 overflow-hidden
                      bg-white/90 backdrop-blur-sm
                      ${isSelected
                        ? "border-2 border-blue-400/60 shadow-lg shadow-blue-500/10 scale-[1.01]"
                        : "border border-slate-200/60 hover:border-blue-300/40 hover:shadow-md hover:scale-[1.005]"
                      }
                    `}
                  >
                    {/* Top Accent Bar */}
                    <div
                      className={`
                        h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-gold-400
                        transition-all duration-500
                        ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-30"}
                      `}
                    />

                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="relative">
                          <div
                            className={`
                              absolute inset-0 rounded-lg blur-md transition-all duration-500
                              ${isSelected
                                ? "bg-gradient-to-br from-blue-400 to-gold-400 opacity-30"
                                : "opacity-0"
                              }
                            `}
                          />
                          <div
                            className={`
                              relative p-3 rounded-lg transition-all duration-500
                              ${isSelected
                                ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20"
                                : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                              }
                            `}
                          >
                            <Icon className="w-5 h-5" strokeWidth={2} />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3
                                className={`text-base font-semibold transition-colors duration-300 ${
                                  isSelected ? "text-slate-900" : "text-slate-800"
                                }`}
                                style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                              >
                                {method.label}
                              </h3>
                              <p className="text-xs text-slate-600 font-light mt-0.5" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                                {method.description}
                              </p>
                            </div>

                            {/* Radio Indicator */}
                            <div
                              className={`
                                mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                transition-all duration-300
                                ${isSelected
                                  ? "border-blue-500 bg-blue-500 shadow-sm shadow-blue-500/30"
                                  : "border-slate-300 bg-white"
                                }
                              `}
                            >
                              {isSelected && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <p
                            className={`text-[11px] leading-relaxed transition-all duration-500 pt-1 ${
                              isSelected ? "text-slate-700 opacity-100" : "text-slate-500 opacity-0 group-hover:opacity-100"
                            }`}
                            style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 300 }}
                          >
                            {method.details}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      {/* Iterations Configuration */}
      {(config.search_method === "random" || config.search_method === "bayesian") && (
        <div className="relative">
          {/* Glow Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-gold-500/5 rounded-xl blur-2xl" />

          <Card className="relative border border-slate-200/60 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Top Accent */}
            <div className="h-0.5 bg-gradient-to-r from-blue-500 via-blue-400 to-gold-400" />

            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Iteration Count
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 font-light" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Number of parameter combinations to evaluate
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Input */}
              <div className="space-y-2">
                <Label htmlFor="n-iter" className="text-sm font-medium text-slate-700" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Iterations
                </Label>
                <Input
                  id="n-iter"
                  type="number"
                  min={1}
                  value={config.n_iter || 10}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      n_iter: parseInt(e.target.value) || 10,
                    })
                  }
                  className="max-w-xs h-11 border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-slate-900"
                />
                <p className="text-[11px] text-slate-500 font-light leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Higher values increase optimization quality but require more computation time
                </p>
              </div>

              {/* Visual Indicator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    Evaluation progress visualization
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {Math.min(config.n_iter || 10, 50)} {(config.n_iter || 10) > 50 ? `of ${config.n_iter}` : 'iterations'}
                  </span>
                </div>

                {/* Progress Bar Container */}
                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-blue-400 to-gold-400 rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.min((config.n_iter || 10) / 100 * 100, 100)}%`,
                      boxShadow: '0 0 12px rgba(59, 130, 246, 0.3)'
                    }}
                  />
                </div>

                {/* Discrete Steps Visualization */}
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: Math.min(config.n_iter || 10, 50) }).map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue-500 to-gold-400 opacity-70 transition-all duration-300 hover:opacity-100 hover:scale-125"
                      style={{
                        animationDelay: `${i * 30}ms`,
                        animation: 'fadeIn 0.5s ease-out forwards'
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 0.7;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
