"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/ui/code-block";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  description: string;
  code?: string;
  language?: string;
  note?: string;
}

interface TunnelGuideProps {
  steps: Step[];
  onTestConnection?: () => void;
  testingConnection?: boolean;
  connectionStatus?: "idle" | "testing" | "success" | "error";
}

export function TunnelGuide({ 
  steps, 
  onTestConnection, 
  testingConnection = false,
  connectionStatus = "idle" 
}: TunnelGuideProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (index: number) => {
    setCompletedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="space-y-6">
      {steps.map((step, index) => (
        <div
          key={index}
          className={cn(
            "relative pl-10 pb-6",
            index !== steps.length - 1 && "border-l border-[rgba(58,58,56,0.15)] ml-4"
          )}
        >
          {/* Step number / check indicator */}
          <button
            onClick={() => toggleStep(index)}
            className={cn(
              "absolute left-0 top-0 w-8 h-8 flex items-center justify-center",
              "font-mono text-xs font-bold border rounded-none transition-all",
              completedSteps.includes(index)
                ? "bg-mint text-forest border-mint"
                : "bg-paper text-forest border-forest/30 hover:border-forest"
            )}
          >
            {completedSteps.includes(index) ? "✓" : index + 1}
          </button>

          {/* Step content */}
          <div className="ml-4">
            <h3 className="font-header text-lg font-semibold text-forest mb-2">
              {step.title}
            </h3>
            <p className="font-mono text-[11px] text-grid/70 mb-3 leading-relaxed">
              {step.description}
            </p>

            {step.code && (
              <CodeBlock 
                code={step.code} 
                language={step.language} 
                className="mb-3" 
              />
            )}

            {step.note && (
              <div className="flex items-start gap-2 p-3 bg-gold/10 border border-gold/30">
                <span className="text-gold text-sm">💡</span>
                <p className="font-mono text-[10px] text-grid/70">
                  {step.note}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Test Connection Section */}
      {onTestConnection && (
        <div className="mt-8 pt-6 border-t border-[rgba(58,58,56,0.15)]">
          <div className="flex items-center gap-4">
            <Button
              variant="solid"
              size="md"
              onClick={onTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </Button>

            {connectionStatus === "success" && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-mint rounded-none animate-pulse" />
                <span className="font-mono text-[11px] text-forest">
                  Connection successful!
                </span>
              </div>
            )}

            {connectionStatus === "error" && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-coral rounded-none" />
                <span className="font-mono text-[11px] text-coral">
                  Connection failed. Check your tunnel is running.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
