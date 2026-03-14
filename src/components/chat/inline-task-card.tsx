"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Square, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export interface InlineTaskCardProps {
  taskId: string;
  taskName: string;
  status: "running" | "complete" | "failed";
  statusText?: string;
  model?: string;
  runtime?: string;
  details?: string;
  result?: string;
  error?: string;
  onStop?: () => void;
}

function useElapsedTime(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!active) return;
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function InlineTaskCard({
  taskName,
  status,
  statusText,
  model,
  runtime,
  details,
  result,
  error,
  onStop,
}: InlineTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const elapsedTime = useElapsedTime(status === "running");

  const displayRuntime = runtime || elapsedTime;

  const statusIcon =
    status === "running" ? (
      <Loader2 className="w-3.5 h-3.5 text-[#9EFFBF] animate-spin flex-shrink-0" />
    ) : status === "complete" ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
    ) : (
      <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
    );

  const collapsedLabel =
    status === "running"
      ? `Task in progress · ${taskName}${statusText ? ` · ${statusText}` : ""}`
      : status === "complete"
      ? `${taskName} · Done${displayRuntime ? ` · ${displayRuntime}` : ""}`
      : `${taskName} · Failed`;

  const expandedContent = result || details || error;

  return (
    <div
      className={cn(
        "my-2 border font-mono text-xs transition-all duration-200 rounded-lg",
        status === "running" && "border-white/[0.1] bg-white/[0.04]",
        status === "complete" && "border-emerald-400/25 bg-emerald-500/[0.06]",
        status === "failed" && "border-red-400/25 bg-red-500/[0.06]"
      )}
    >
      {/* Collapsed bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        {statusIcon}

        <span
          className={cn(
            "flex-1 truncate text-[11px]",
            status === "running" && "text-[#9EFFBF]",
            status === "complete" && "text-emerald-400",
            status === "failed" && "text-red-400"
          )}
        >
          {collapsedLabel}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {status === "running" && onStop && (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(); }}
              className="flex items-center gap-1 px-2 py-0.5 border border-white/[0.1] text-white/40 hover:text-white/80 hover:border-white/[0.2] transition-colors text-[10px] uppercase tracking-wide rounded"
            >
              <Square className="w-2.5 h-2.5" />
              Stop
            </button>
          )}
          {expandedContent && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-white/40 hover:text-white/70 transition-colors p-0.5"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && expandedContent && (
        <div
          className={cn(
            "border-t px-3 py-2.5 space-y-2",
            status === "running" && "border-white/[0.06]",
            status === "complete" && "border-emerald-400/15",
            status === "failed" && "border-red-400/15"
          )}
        >
          <p
            className={cn(
              "text-[11px] leading-relaxed whitespace-pre-wrap",
              status === "failed" ? "text-red-400" : "text-white/70"
            )}
          >
            {error || result || details}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              {model && (
                <span className="px-1.5 py-0.5 border border-white/[0.1] bg-white/[0.04] rounded">
                  {model}
                </span>
              )}
              {displayRuntime && <span>Runtime: {displayRuntime}</span>}
            </div>

            {status === "running" && onStop && (
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.08] text-white/80 text-[10px] uppercase tracking-wide hover:bg-white/[0.12] transition-colors rounded"
              >
                <Square className="w-2.5 h-2.5" />
                Stop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
