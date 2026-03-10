"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { AgentPanel, AgentInstance } from "./agent-panel";
import { AgentExpandModal } from "./agent-expand-modal";

const PANEL_W = 360;
const PANEL_H = 380;
const GRID_COLS = 3;
const GAP = 24;
const CANVAS_PAD = 32;

function getAutoPosition(index: number): { x: number; y: number } {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: CANVAS_PAD + col * (PANEL_W + GAP),
    y: CANVAS_PAD + row * (PANEL_H + GAP),
  };
}

interface AgentCanvasProps {
  agents: AgentInstance[];
  onSpawnAgent: (task: string) => void;
  onSendMessage: (agentId: string, message: string) => void;
  onStopAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
  onMoveAgent: (agentId: string, position: { x: number; y: number }) => void;
}

export function AgentCanvas({
  agents,
  onSpawnAgent,
  onSendMessage,
  onStopAgent,
  onDeleteAgent,
  onMoveAgent,
}: AgentCanvasProps) {
  const [spawnInput, setSpawnInput] = useState('');
  const [spawning, setSpawning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.agent-panel-root')) return;
    isPanning.current = true;
    panStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: canvasOffset.x,
      offsetY: canvasOffset.y,
    };
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';

    const handleMove = (ev: MouseEvent) => {
      if (!isPanning.current) return;
      setCanvasOffset({
        x: panStart.current.offsetX + (ev.clientX - panStart.current.mouseX),
        y: panStart.current.offsetY + (ev.clientY - panStart.current.mouseY),
      });
    };
    const handleUp = (ev: MouseEvent) => {
      isPanning.current = false;
      (document.querySelector('.canvas-area') as HTMLElement | null)?.style.setProperty('cursor', 'default');
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [canvasOffset]);

  const handleSpawn = async () => {
    if (!spawnInput.trim() || spawning) return;
    setSpawning(true);
    await onSpawnAgent(spawnInput.trim());
    setSpawnInput('');
    setSpawning(false);
  };

  // Auto-position agents that have default position (0,0)
  const agentsWithPositions = agents.map((agent, i) => {
    if (agent.position.x === 0 && agent.position.y === 0) {
      return { ...agent, position: getAutoPosition(i) };
    }
    return agent;
  });

  const expandedAgent = expandedId ? agentsWithPositions.find((a) => a.id === expandedId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Canvas area */}
      <div
        className="canvas-area flex-1 relative overflow-hidden"
        style={{
          background: '#F7F7F5',
          backgroundImage: 'radial-gradient(circle, #d0d0cc 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        onMouseDown={handleCanvasMouseDown}
      >
        {/* Pannable layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
            willChange: 'transform',
          }}
        >
          {agentsWithPositions.map((agent) => (
            <div key={agent.id} className="agent-panel-root">
              <AgentPanel
                agent={agent}
                onSendMessage={(msg) => onSendMessage(agent.id, msg)}
                onStop={() => onStopAgent(agent.id)}
                onDelete={() => onDeleteAgent(agent.id)}
                onExpand={() => setExpandedId(agent.id)}
                onMove={(pos) => onMoveAgent(agent.id, pos)}
              />
            </div>
          ))}

          {agents.length === 0 && (
            <div
              className="absolute flex flex-col items-center gap-3 text-center"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            >
              <div className="text-5xl">✨</div>
              <p className="text-sm text-gray-400">No agents yet.</p>
              <p className="text-xs text-gray-300">Type a task below to spawn your first agent.</p>
            </div>
          )}
        </div>

        {/* Canvas controls overlay */}
        {agents.length > 0 && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => setCanvasOffset({ x: 0, y: 0 })}
              className="text-[10px] font-mono px-2.5 py-1 bg-white/80 hover:bg-white border border-gray-200 text-gray-500 rounded-md shadow-sm transition-colors backdrop-blur-sm"
              title="Reset canvas view"
            >
              ⌖ Reset
            </button>
          </div>
        )}
      </div>

      {/* Bottom spawn bar */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-base select-none">✨</span>
        <input
          type="text"
          value={spawnInput}
          onChange={(e) => setSpawnInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSpawn()}
          placeholder='Spawn an agent... e.g. "Research AR glasses competitors"'
          className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
          disabled={spawning}
        />
        <button
          onClick={handleSpawn}
          disabled={!spawnInput.trim() || spawning}
          className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors rounded-md"
        >
          {spawning ? 'Spawning...' : 'Spawn ↵'}
        </button>
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
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
