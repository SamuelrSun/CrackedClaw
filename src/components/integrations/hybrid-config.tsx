"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PipelineStep {
  id: string;
  type: "api" | "browser" | "transform";
  name: string;
  config: Record<string, string>;
}

interface HybridConfigProps {
  config: {
    steps?: PipelineStep[];
  };
  onChange: (config: HybridConfigProps["config"]) => void;
}

export function HybridConfig({ config, onChange }: HybridConfigProps) {
  const steps = config.steps || [];

  const addStep = (type: PipelineStep["type"]) => {
    const newStep: PipelineStep = {
      id: `step-${Date.now()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
      config: {},
    };
    onChange({ ...config, steps: [...steps, newStep] });
  };

  const removeStep = (id: string) => {
    onChange({ ...config, steps: steps.filter((s) => s.id !== id) });
  };

  const updateStep = (id: string, updates: Partial<PipelineStep>) => {
    onChange({
      ...config,
      steps: steps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2 block">
          Pipeline Steps
        </span>

        {steps.length === 0 ? (
          <div className="p-6 border border-dashed border-[rgba(58,58,56,0.3)] text-center">
            <p className="font-mono text-[11px] text-grid/40">
              No steps added yet. Add steps to build your pipeline.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="p-4 border border-[rgba(58,58,56,0.2)] bg-white"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-forest/10 text-forest px-2 py-0.5">
                      {index + 1}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                      {step.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStep(step.id)}
                    className="font-mono text-[10px] text-coral hover:text-coral/70"
                  >
                    Remove
                  </button>
                </div>

                <Input
                  label="Step Name"
                  placeholder="Name this step"
                  value={step.name}
                  onChange={(e) => updateStep(step.id, { name: e.target.value })}
                />

                {step.type === "api" && (
                  <div className="mt-3">
                    <Input
                      label="Endpoint"
                      placeholder="/api/data"
                      value={step.config.endpoint || ""}
                      onChange={(e) =>
                        updateStep(step.id, {
                          config: { ...step.config, endpoint: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {step.type === "browser" && (
                  <div className="mt-3">
                    <Input
                      label="Target URL"
                      placeholder="https://example.com/page"
                      value={step.config.url || ""}
                      onChange={(e) =>
                        updateStep(step.id, {
                          config: { ...step.config, url: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {step.type === "transform" && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                      Transform Expression
                    </label>
                    <textarea
                      className="w-full bg-cream border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-2 font-mono text-xs text-forest placeholder:text-grid/30 outline-none focus:border-forest transition-colors min-h-[60px] resize-y"
                      placeholder="data.items.map(i => i.name)"
                      value={step.config.expression || ""}
                      onChange={(e) =>
                        updateStep(step.id, {
                          config: { ...step.config, expression: e.target.value },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2 block">
          Add Step
        </span>
        <div className="flex gap-2">
          <Button type="button" onClick={() => addStep("api")} size="sm">
            + API Call
          </Button>
          <Button type="button" onClick={() => addStep("browser")} size="sm">
            + Browser Action
          </Button>
          <Button type="button" onClick={() => addStep("transform")} size="sm">
            + Transform
          </Button>
        </div>
      </div>

      <div className="p-3 bg-forest/5 border border-forest/20">
        <span className="font-mono text-[10px] uppercase tracking-wide text-forest/70">
          Hybrid Pipeline
        </span>
        <p className="font-mono text-[11px] text-grid/60 mt-1">
          Hybrid integrations combine multiple data sources and transformations.
          Steps execute in order, with each step receiving the output of the
          previous one.
        </p>
      </div>
    </div>
  );
}
