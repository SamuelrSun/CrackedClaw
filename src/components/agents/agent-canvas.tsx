"use client";

import { useEffect, useRef, useState } from "react";
import { AgentPanel, AgentInstance } from "./agent-panel";
import { AgentSidePanel } from "./agent-expand-modal";
import { BUILTIN_TEMPLATES, AgentTemplate } from "@/lib/agent/templates";

const MODEL_OPTIONS = [
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
];

const MODE_OPTIONS = [
  { value: "agent", label: "Agent" },
  { value: "research", label: "Research" },
  { value: "code", label: "Code" },
  { value: "browse", label: "Browse" },
  { value: "email", label: "Email" },
];

type FilterType = "all" | "running" | "idle" | "failed";

interface AgentCanvasProps {
  agents: AgentInstance[];
  onSpawnAgent: (task: string, model?: string, mode?: string) => void;
  onSendMessage: (agentId: string, message: string) => void;
  onStopAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
}

const selectClass =
  "bg-white/[0.04] border border-white/[0.08] rounded-[3px] text-[11px] text-white/70 font-mono px-2 py-1.5 outline-none appearance-none cursor-pointer hover:bg-white/[0.08] transition-colors flex-shrink-0";

export function AgentCanvas({
  agents,
  onSpawnAgent,
  onSendMessage,
  onStopAgent,
  onDeleteAgent,
}: AgentCanvasProps) {
  const [spawnInput, setSpawnInput] = useState("");
  const [spawning, setSpawning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("sonnet");
  const [selectedMode, setSelectedMode] = useState("agent");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showTemplates, setShowTemplates] = useState(false);

  const templatesDropdownRef = useRef<HTMLDivElement>(null);
  const spawnInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showTemplates) return;
    const handler = (e: MouseEvent) => {
      if (
        templatesDropdownRef.current &&
        !templatesDropdownRef.current.contains(e.target as Node)
      ) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTemplates]);

  const handleSelectTemplate = (template: AgentTemplate) => {
    setSpawnInput(template.task);
    setSelectedMode(template.mode);
    setSelectedModel(template.model);
    setShowTemplates(false);
    // Focus input so user can edit placeholders
    setTimeout(() => spawnInputRef.current?.focus(), 0);
  };

  const handleSpawn = async () => {
    if (!spawnInput.trim() || spawning) return;
    setSpawning(true);
    await onSpawnAgent(spawnInput.trim(), selectedModel, selectedMode);
    setSpawnInput("");
    setSpawning(false);
  };

  const expandedAgent = expandedId ? agents.find((a) => a.id === expandedId) : null;

  const runningAgents = agents.filter((a) => a.status === "running");
  const runningCount = runningAgents.length;
  const idleCount = agents.filter(
    (a) => a.status === "idle" || a.status === "done" || a.status === "scheduled"
  ).length;
  const failedCount = agents.filter((a) => a.status === "failed").length;

  const filterCounts: Record<FilterType, number> = {
    all: agents.length,
    running: runningCount,
    idle: idleCount,
    failed: failedCount,
  };

  const filteredAgents = agents.filter((a) => {
    if (filter === "all") return true;
    if (filter === "running") return a.status === "running";
    if (filter === "idle")
      return a.status === "idle" || a.status === "done" || a.status === "scheduled";
    if (filter === "failed") return a.status === "failed";
    return true;
  });

  const handleStopAll = () => {
    runningAgents.forEach((a) => onStopAgent(a.id));
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-56px)]">
      {/* Top spawn bar */}
      <div className="border-b border-white/[0.08] bg-black/[0.07] backdrop-blur-[10px] px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-white/[0.04] border border-white/[0.08] rounded-[3px] px-3 py-2">
            <span className="text-[13px] select-none flex-shrink-0">✨</span>
            <input
              ref={spawnInputRef}
              type="text"
              value={spawnInput}
              onChange={(e) => setSpawnInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSpawn()}
              placeholder="What do you want done? Press Enter to deploy an agent..."
              className="flex-1 text-[13px] bg-transparent outline-none text-white/80 placeholder-white/20"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              disabled={spawning}
            />
          </div>

          {/* Mode selector */}
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            className={selectClass}
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white/80">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Model selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className={selectClass}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white/80">
                {opt.label}
              </option>
            ))}
          </select>

          {/* Templates dropdown button */}
          <div className="relative flex-shrink-0" ref={templatesDropdownRef}>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className={[
                "font-mono text-[11px] uppercase tracking-wider px-3 py-2 border rounded-[3px] transition-colors flex items-center gap-1.5",
                showTemplates
                  ? "bg-white/[0.10] border-white/[0.18] text-white/80"
                  : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white/70",
              ].join(" ")}
              title="Templates"
            >
              {/* Grid icon */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="opacity-70"
              >
                <rect x="0" y="0" width="5" height="5" rx="0.5" fill="currentColor" />
                <rect x="7" y="0" width="5" height="5" rx="0.5" fill="currentColor" />
                <rect x="0" y="7" width="5" height="5" rx="0.5" fill="currentColor" />
                <rect x="7" y="7" width="5" height="5" rx="0.5" fill="currentColor" />
              </svg>
              Templates
            </button>

            {/* Templates dropdown */}
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-black/[0.85] backdrop-blur-[10px] border border-white/10 rounded-[3px] p-2 shadow-xl">
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/30 px-2 pb-2">
                  Quick templates
                </p>
                {BUILTIN_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="w-full text-left flex items-start gap-2.5 px-2 py-2 rounded-[3px] hover:bg-white/[0.07] transition-colors group"
                  >
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">{tpl.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-white/70 group-hover:text-white/90 transition-colors">
                        {tpl.name}
                      </div>
                      <div className="text-[11px] text-white/35 leading-snug truncate">
                        {tpl.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSpawn}
            disabled={!spawnInput.trim() || spawning}
            className="font-mono text-[11px] uppercase tracking-wider px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-white disabled:opacity-30 transition-colors rounded-[3px] flex-shrink-0"
          >
            {spawning ? "Deploying..." : "Deploy"}
          </button>

          {runningCount > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-[#9EFFBF] animate-pulse" />
              <span className="text-[11px] font-mono text-white/60">{runningCount} active</span>
            </div>
          )}
        </div>
      </div>

      {/* Batch controls bar — only visible when agents exist */}
      {agents.length > 0 && (
        <div className="border-b border-white/[0.06] bg-white/[0.03] px-4 sm:px-6 py-2 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex items-center gap-2">
            {(["all", "running", "idle", "failed"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-[3px] transition-colors",
                  filter === f
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/40 hover:text-white/60",
                ].join(" ")}
              >
                {f} ({filterCounts[f]})
              </button>
            ))}

            <div className="flex-1" />

            {runningCount > 0 && (
              <button
                onClick={handleStopAll}
                className="text-[11px] font-mono uppercase tracking-wider text-[#FF8C69]/70 hover:text-[#FF8C69] hover:bg-[#FF8C69]/10 px-3 py-1.5 rounded-[3px] transition-colors"
              >
                Stop All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {agents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center gap-6">
            <div className="bg-black/[0.07] backdrop-blur-[10px] border border-white/10 rounded-[3px] px-8 py-10 space-y-2">
              <h2
                className="text-lg font-medium text-white/80"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                No agents deployed yet
              </h2>
              <p className="text-[13px] text-white/50">
                Deploy agents to work on tasks concurrently. Each agent runs independently with
                access to tools.
              </p>
            </div>

            {/* Template cards grid */}
            <div className="w-full">
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/25 mb-3">
                Start from a template
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-[7px]">
                {BUILTIN_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-[3px] p-3 hover:bg-white/[0.08] hover:border-white/[0.12] transition-colors cursor-pointer text-left"
                  >
                    <div className="text-xl mb-1.5">{tpl.emoji}</div>
                    <div className="text-[12px] font-medium text-white/70 mb-0.5">{tpl.name}</div>
                    <div className="text-[11px] text-white/40 leading-snug line-clamp-2">
                      {tpl.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Agent grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[7px] max-w-7xl mx-auto">
            {filteredAgents.map((agent) => (
              <AgentPanel
                key={agent.id}
                agent={agent}
                onStop={() => onStopAgent(agent.id)}
                onDelete={() => onDeleteAgent(agent.id)}
                onExpand={() => setExpandedId(agent.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Side panel */}
      {expandedAgent && (
        <AgentSidePanel
          agent={expandedAgent}
          onClose={() => setExpandedId(null)}
          onSendMessage={(msg) => onSendMessage(expandedAgent.id, msg)}
        />
      )}

      <style>{`
        @keyframes agentFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
