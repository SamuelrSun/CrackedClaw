"use client";

import { useState } from "react";
import { AgentPanel, AgentInstance } from "./agent-panel";
import { AgentExpandModal } from "./agent-expand-modal";

const SUGGESTIONS = [
  "Research AR glasses market trends",
  "Search my emails for invoices this month",
  "Monitor competitor pricing pages",
  "Draft a follow-up email to leads",
  "Summarize recent industry news",
  "Find open-source alternatives to Notion",
];

interface AgentCanvasProps {
  agents: AgentInstance[];
  onSpawnAgent: (task: string) => void;
  onSendMessage: (agentId: string, message: string) => void;
  onStopAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
}

export function AgentCanvas({
  agents,
  onSpawnAgent,
  onSendMessage,
  onStopAgent,
  onDeleteAgent,
}: AgentCanvasProps) {
  const [spawnInput, setSpawnInput] = useState('');
  const [spawning, setSpawning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSpawn = async () => {
    if (!spawnInput.trim() || spawning) return;
    setSpawning(true);
    await onSpawnAgent(spawnInput.trim());
    setSpawnInput('');
    setSpawning(false);
  };

  const expandedAgent = expandedId ? agents.find((a) => a.id === expandedId) : null;

  const runningCount = agents.filter(a => a.status === 'running').length;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-[#F7F7F5]">
      {/* Top spawn bar */}
      <div className="border-b border-[#3A3A38]/10 bg-white px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-[#F7F7F5] border border-[#3A3A38]/15 rounded-[2px] px-3 py-2">
            <span className="text-[13px] select-none flex-shrink-0">✨</span>
            <input
              type="text"
              value={spawnInput}
              onChange={(e) => setSpawnInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSpawn()}
              placeholder="What do you want done? Press Enter to deploy an agent..."
              className="flex-1 text-[13px] bg-transparent outline-none text-[#1A3C2B] placeholder-[#3A3A38]/35"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              disabled={spawning}
            />
          </div>
          <button
            onClick={handleSpawn}
            disabled={!spawnInput.trim() || spawning}
            className="font-mono text-[11px] uppercase tracking-wider px-4 py-2 bg-[#1A3C2B] text-white hover:bg-[#1A3C2B]/80 disabled:opacity-30 transition-colors rounded-[2px] flex-shrink-0"
          >
            {spawning ? 'Deploying...' : 'Deploy'}
          </button>
          {runningCount > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-[#9EFFBF] animate-pulse" />
              <span className="text-[11px] font-mono text-[#1A3C2B]/60">
                {runningCount} active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {agents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center gap-6">
            <div className="space-y-2">
              <h2
                className="text-lg font-medium text-[#1A3C2B]"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                No agents deployed yet
              </h2>
              <p className="text-[13px] text-[#3A3A38]/50">
                Deploy agents to work on tasks concurrently. Each agent runs independently with access to tools.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSpawnInput(s);
                    // Focus the input
                    const input = document.querySelector<HTMLInputElement>('input[placeholder*="deploy"]');
                    input?.focus();
                  }}
                  className="text-[11px] font-mono px-3 py-1.5 border border-[#3A3A38]/15 rounded-[2px] text-[#3A3A38]/60 hover:text-[#1A3C2B] hover:border-[#1A3C2B]/30 hover:bg-[#9EFFBF]/5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Agent grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {agents.map((agent) => (
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

      {/* Expand modal */}
      {expandedAgent && (
        <AgentExpandModal
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
        @keyframes spawn-pulse {
          0%, 100% { border-color: rgba(58, 58, 56, 0.15); }
          50% { border-color: #F4D35E; }
        }
        @keyframes running-border {
          0%, 100% { border-color: #9EFFBF; }
          50% { border-color: #1A3C2B; }
        }
        .animate-spawn-pulse {
          animation: spawn-pulse 1.5s ease-in-out infinite;
        }
        .animate-running-border {
          animation: running-border 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
