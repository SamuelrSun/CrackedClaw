"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, X, Loader2, CheckCircle2, XCircle } from "lucide-react";

export interface SubagentSession {
  id: string;
  label?: string;
  task?: string;
  model?: string;
  status?: "running" | "done" | "failed" | "killed";
  startedAt?: number;
  endedAt?: number;
  messages?: Array<{ role: string; content: string }>;
  output?: string;
}

interface SubagentCardProps {
  session: SubagentSession;
  onKill: (id: string) => Promise<void>;
}

function formatRuntime(startedAt?: number, endedAt?: number): string {
  if (!startedAt) return "";
  const end = endedAt || Date.now();
  const ms = end - startedAt;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function ModelBadge({ model }: { model?: string }) {
  if (!model) return null;
  const isOpus = model.toLowerCase().includes("opus");
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wide",
        isOpus
          ? "bg-purple-100 text-purple-700 border border-purple-200"
          : "bg-emerald-100 text-emerald-700 border border-emerald-200"
      )}
    >
      {isOpus ? "opus" : "sonnet"}
    </span>
  );
}

function StatusIcon({ status }: { status?: string }) {
  if (status === "running") {
    return <Loader2 className="w-3.5 h-3.5 text-[#1A3C2B] animate-spin flex-shrink-0" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />;
  }
  return <XCircle className="w-3.5 h-3.5 text-[#FF6B6B] flex-shrink-0" />;
}

export function SubagentCard({ session, onKill }: SubagentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [killing, setKilling] = useState(false);

  const label = session.label || session.task || session.id;
  const status = session.status || "running";
  const isRunning = status === "running";
  const runtime = formatRuntime(session.startedAt, session.endedAt);

  const recentMessages = session.messages?.slice(-3) || [];

  const handleKill = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setKilling(true);
    setConfirming(false);
    try {
      await onKill(session.id);
    } finally {
      setKilling(false);
    }
  };

  return (
    <div
      className={cn(
        "border rounded-none transition-all duration-200",
        isRunning
          ? "border-[rgba(26,60,43,0.2)] bg-[#F5F3EF]"
          : status === "done"
          ? "border-emerald-200/60 bg-emerald-50/30"
          : "border-red-200/60 bg-red-50/20"
      )}
    >
      {/* Compact header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-grid/40 hover:text-grid/70 transition-colors flex-shrink-0"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        <StatusIcon status={status} />

        {/* Label */}
        <span
          className="flex-1 font-mono text-[11px] text-[#1A3C2B] truncate cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          {label}
        </span>

        <ModelBadge model={session.model} />

        {/* Runtime */}
        {runtime && (
          <span className="font-mono text-[9px] text-grid/40 flex-shrink-0">{runtime}</span>
        )}

        {/* Kill button — only for running */}
        {isRunning && (
          <button
            onClick={handleKill}
            disabled={killing}
            className={cn(
              "flex-shrink-0 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide transition-colors border rounded-none",
              confirming
                ? "bg-[#FF6B6B] text-white border-[#FF6B6B] hover:bg-red-700"
                : "text-grid/40 border-grid/20 hover:border-[#FF6B6B] hover:text-[#FF6B6B]"
            )}
          >
            {killing ? "..." : confirming ? "Confirm?" : <X className="w-2.5 h-2.5" />}
          </button>
        )}
      </div>

      {/* Progress bar for running */}
      {isRunning && (
        <div className="h-0.5 bg-[#1A3C2B]/10 overflow-hidden">
          <div className="h-full bg-[#1A3C2B]/40" style={{ animation: "progress-bar 1.8s ease-in-out infinite" }} />
        </div>
      )}

      {/* Expanded: recent messages */}
      {expanded && (
        <div className="border-t border-[rgba(58,58,56,0.1)] px-3 py-2 space-y-1.5">
          {recentMessages.length > 0 ? (
            recentMessages.map((msg, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="font-mono text-[9px] text-grid/40 flex-shrink-0 mt-0.5">
                  {msg.role === "assistant" ? "✦" : "›"}
                </span>
                <p className="font-mono text-[10px] text-[#1A3C2B]/70 leading-relaxed line-clamp-2">
                  {msg.content}
                </p>
              </div>
            ))
          ) : session.output ? (
            <p className="font-mono text-[10px] text-[#1A3C2B]/70 leading-relaxed line-clamp-3">
              {session.output}
            </p>
          ) : (
            <p className="font-mono text-[10px] text-grid/30 italic">No output yet</p>
          )}
        </div>
      )}
    </div>
  );
}
