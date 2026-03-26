"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface SubagentInlineCardProps {
  taskId: string;
  label: string;
  status: "pending" | "running" | "complete" | "failed";
  startedAt?: number;
  runtime?: string;
  onStop?: () => void;
}

function useElapsedTime(active: boolean, startedAt?: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = startedAt || Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active, startedAt]);

  if (!active) return null;
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function SubagentInlineCard({
  label,
  status,
  startedAt,
  runtime,
}: SubagentInlineCardProps) {
  const elapsedTime = useElapsedTime(
    status === "running" || status === "pending",
    startedAt,
  );
  const displayTime = runtime || elapsedTime;

  return (
    <div
      className={cn(
        "w-[280px] h-[72px] flex-shrink-0 rounded-lg border overflow-hidden",
        "bg-white/[0.03] backdrop-blur-sm",
        "border-white/[0.08]",
        "transition-all duration-300",
      )}
    >
      <div className="flex flex-col justify-center h-full px-3.5 py-2.5 gap-1">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Status dot / icon */}
            {(status === "running" || status === "pending") && (
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    status === "pending" ? "bg-amber-400" : "bg-emerald-400",
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    status === "pending" ? "bg-amber-400" : "bg-emerald-400",
                  )}
                />
              </span>
            )}

            {status === "complete" && (
              <svg
                className="w-3.5 h-3.5 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}

            {status === "failed" && (
              <svg
                className="w-3.5 h-3.5 text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}

            {/* "Subagent" label */}
            <span className="font-mono text-[10px] uppercase tracking-wide text-white/50">
              Subagent
            </span>

            {/* Status text */}
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wide",
                status === "pending" && "text-amber-400/70",
                status === "running" && "text-emerald-400/70",
                status === "complete" && "text-emerald-400/70",
                status === "failed" && "text-red-400/70",
              )}
            >
              {status === "pending"
                ? "Starting..."
                : status === "running"
                  ? "Running"
                  : status === "complete"
                    ? "Complete"
                    : "Failed"}
            </span>
          </div>

          {/* Timer — shown while running/pending, or final runtime when complete */}
          {displayTime && (status === "running" || status === "pending") && (
            <span className="font-mono text-[10px] text-white/30">
              {displayTime}
            </span>
          )}
          {status === "complete" && runtime && (
            <span className="font-mono text-[10px] text-white/30">{runtime}</span>
          )}
        </div>

        {/* Task summary — up to 2 lines, truncated */}
        <p className="text-[11.5px] text-white/50 leading-snug line-clamp-2 font-body">
          {label}
        </p>
      </div>
    </div>
  );
}
