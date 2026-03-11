"use client";

import { useState, useEffect } from "react";
import { Bot, CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";

export type SubagentStatus = "running" | "complete" | "failed" | "queued";

export interface InlineSubagentCardProps {
  taskLabel: string;
  status: SubagentStatus;
  startedAt?: string;
  completedAt?: string;
  result?: string;
}

export function InlineSubagentCard({
  taskLabel,
  status,
  startedAt,
  completedAt,
  result,
}: InlineSubagentCardProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "running" || !startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, startedAt]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const statusConfig = {
    queued: {
      icon: <Clock className="w-3.5 h-3.5 text-grid/50" />,
      label: "Queued",
      color: "text-grid/50",
      borderColor: "border-grid/20",
      bgColor: "bg-grid/5",
      dotColor: "bg-grid/40",
    },
    running: {
      icon: <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
      label: `Running${elapsed > 0 ? ` · ${formatTime(elapsed)}` : ""}`,
      color: "text-blue-600",
      borderColor: "border-blue-200",
      bgColor: "bg-blue-50",
      dotColor: "bg-blue-400",
    },
    complete: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
      label: "Complete",
      color: "text-emerald-600",
      borderColor: "border-emerald-200",
      bgColor: "bg-emerald-50",
      dotColor: "bg-emerald-400",
    },
    failed: {
      icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,
      label: "Failed",
      color: "text-red-600",
      borderColor: "border-red-200",
      bgColor: "bg-red-50",
      dotColor: "bg-red-400",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`my-2 rounded-lg border ${config.borderColor} ${config.bgColor} px-4 py-3 max-w-md transition-all duration-300`}
    >
      <div className="flex items-start gap-3">
        {/* Bot icon */}
        <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-white border border-grid/15 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-forest" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Task label */}
          <p className="font-body text-sm text-forest leading-snug">
            {taskLabel}
          </p>

          {/* Status line */}
          <div className={`flex items-center gap-1.5 mt-1.5 ${config.color}`}>
            {config.icon}
            <span className="font-mono text-xs">{config.label}</span>
          </div>

          {/* Result summary (only when complete) */}
          {status === "complete" && result && (
            <p className="mt-2 text-xs text-grid/60 font-body leading-relaxed border-t border-grid/10 pt-2">
              {result}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
