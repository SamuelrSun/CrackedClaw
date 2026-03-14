"use client";

import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";

interface SubagentInfo {
  name: string;
  status: "scanning" | "complete" | "error";
  source: string;
}

interface SubagentProgressCardProps {
  agents: SubagentInfo[];
}

function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1">
      <span
        className="w-1 h-1 bg-forest/60 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1 h-1 bg-forest/60 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1 h-1 bg-forest/60 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

const sourceEmoji: Record<string, string> = {
  gmail: "📧",
  calendar: "📅",
  drive: "📁",
  slack: "💬",
  notion: "📝",
  default: "🔍",
};

export function SubagentProgressCard({ agents }: SubagentProgressCardProps) {
  return (
    <div className="border border-white/[0.1] rounded-none bg-white p-4 max-w-sm">
      <div className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-3">
        Learning about you
      </div>

      <div className="space-y-2">
        {agents.map((agent, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 rounded-none",
              agent.status === "scanning" && "bg-forest/5",
              agent.status === "complete" && "bg-[#9EFFBF]/10",
              agent.status === "error" && "bg-[#FF6B6B]/10"
            )}
          >
            <span className="text-sm">
              {sourceEmoji[agent.source.toLowerCase()] || sourceEmoji.default}
            </span>

            <span className="flex-1 text-xs text-forest">
              {agent.status === "scanning" && (
                <>
                  Scanning {agent.name}
                  <AnimatedDots />
                </>
              )}
              {agent.status === "complete" && <>{agent.name} complete</>}
              {agent.status === "error" && <>{agent.name} failed</>}
            </span>

            <span className="flex-shrink-0">
              {agent.status === "complete" && (
                <Check className="w-3.5 h-3.5 text-forest" />
              )}
              {agent.status === "error" && (
                <AlertCircle className="w-3.5 h-3.5 text-[#FF6B6B]" />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
