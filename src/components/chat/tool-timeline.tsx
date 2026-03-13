"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ToolCallDetail } from "./tool-call-detail";

export interface ToolStep {
  id: string;
  label: string;
  tool: string;
  duration?: number;
  input?: Record<string, unknown>;
  result?: string;
  status: "running" | "done";
}

interface ToolTimelineProps {
  steps: ToolStep[];
  trailingSummary?: string;
}

export function ToolTimeline({ steps, trailingSummary }: ToolTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleStep = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-0 pl-1">
      {steps.map((step) => {
        const isExpanded = expandedId === step.id;

        return (
          <div key={step.id} className="flex gap-2">
            {/* Left column: dot + line */}
            <div className="flex flex-col items-center" style={{ minWidth: 12 }}>
              <div
                className={cn(
                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  step.status === "running"
                    ? "bg-grid/30 animate-pulse"
                    : "bg-grid/30"
                )}
              />
              <div className="flex-1 border-l border-[rgba(58,58,56,0.15)] mt-0.5" />
            </div>

            {/* Right column: content */}
            <div className="flex-1 pb-2">
              <button
                type="button"
                onClick={() => toggleStep(step.id)}
                className={cn(
                  "flex items-center gap-1 text-[12px] text-grid/60 hover:text-grid/80",
                  "transition-colors bg-transparent border-0 p-0 cursor-pointer font-sans w-full text-left"
                )}
              >
                <span className="flex-1">
                  {step.label}
                  {step.duration !== undefined && (
                    <span className="ml-1 font-mono text-[10px] text-grid/40">
                      ({step.duration < 1 ? "<1s" : `${step.duration}s`})
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-grid/40">{isExpanded ? "▼" : "▶"}</span>
              </button>

              {isExpanded && (
                <div className="mt-1">
                  <ToolCallDetail
                    tool={step.tool}
                    input={step.input}
                    result={step.result}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {trailingSummary && (
        <div className="flex gap-2 pt-1">
          <div style={{ minWidth: 12 }} />
          <p className="text-[12px] text-grid/60 leading-relaxed flex-1">
            {trailingSummary}
          </p>
        </div>
      )}
    </div>
  );
}
