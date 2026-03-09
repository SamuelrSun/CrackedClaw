"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { SubagentCard, type SubagentSession } from "./subagent-card";

interface SubagentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubagentCountChange?: (count: number) => void;
}

export function SubagentPanel({ isOpen, onClose, onSubagentCountChange }: SubagentPanelProps) {
  const [subagents, setSubagents] = useState<SubagentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevCountRef = useRef(0);

  const fetchSubagents = useCallback(async () => {
    if (!isOpen) return;
    try {
      const res = await fetch("/api/gateway/subagents");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sessions: SubagentSession[] = data.subagents || [];
      setSubagents(sessions);
      setError(null);

      const running = sessions.filter((s) => s.status === "running" || !s.status).length;
      if (running !== prevCountRef.current) {
        prevCountRef.current = running;
        onSubagentCountChange?.(running);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [isOpen, onSubagentCountChange]);

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setLoading(true);
    fetchSubagents();
    intervalRef.current = setInterval(fetchSubagents, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, fetchSubagents]);

  const handleKill = async (sessionId: string) => {
    await fetch(`/api/gateway/subagents?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    // Optimistically update status
    setSubagents((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: "killed" as const } : s))
    );
    setTimeout(fetchSubagents, 1000);
  };

  const runningCount = subagents.filter((s) => !s.status || s.status === "running").length;

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute right-0 bottom-0 z-20 w-80 border-l border-t border-[rgba(58,58,56,0.2)] bg-[#F5F3EF] shadow-lg flex flex-col transition-all duration-300",
        collapsed ? "h-10" : "h-96"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-10 border-b border-[rgba(58,58,56,0.15)] flex-shrink-0 bg-[#F5F3EF]">
        <Cpu className="w-3.5 h-3.5 text-[#1A3C2B]/60" />
        <span className="font-mono text-[10px] uppercase tracking-wide text-[#1A3C2B]/60 flex-1">
          Background Tasks
        </span>
        {runningCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#1A3C2B] text-white font-mono text-[9px]">
            {runningCount}
          </span>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-grid/40 hover:text-grid/70 transition-colors"
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onClose} className="text-grid/40 hover:text-grid/70 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && subagents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="font-mono text-[10px] text-grid/40 animate-pulse">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <span className="font-mono text-[10px] text-[#FF6B6B]">{error}</span>
            </div>
          ) : subagents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="w-8 h-8 rounded-full border border-[rgba(58,58,56,0.15)] flex items-center justify-center">
                <Cpu className="w-4 h-4 text-grid/30" />
              </div>
              <p className="font-mono text-[10px] text-grid/40 text-center">
                No background tasks running
              </p>
            </div>
          ) : (
            subagents.map((session) => (
              <SubagentCard key={session.id} session={session} onKill={handleKill} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
