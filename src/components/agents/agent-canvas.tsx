"use client";

import { useRef, useState, useCallback } from "react";
import { AgentPanel, AgentInstance } from "./agent-panel";
import { AgentExpandModal } from "./agent-expand-modal";

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
    const handleMove = (ev: MouseEvent) => {
      if (!isPanning.current) return;
      setCanvasOffset({
        x: panStart.current.offsetX + (ev.clientX - panStart.current.mouseX),
        y: panStart.current.offsetY + (ev.clientY - panStart.current.mouseY),
      });
    };
    const handleUp = () => {
      isPanning.current = false;
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

  const expandedAgent = expandedId ? agents.find((a) => a.id === expandedId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Canvas area */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{
          background: '#FAFAF8',
          backgroundImage: 'radial-gradient(circle, #ccc 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          cursor: 'default',
        }}
        onMouseDown={handleCanvasMouseDown}
      >
        {/* Panning layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
          }}
        >
          {agents.map((agent) => (
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
              className="absolute text-center"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            >
              <div className="text-4xl mb-3">✨</div>
              <p className="text-sm text-gray-400 font-mono">No agents yet. Spawn one below.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom spawn bar */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-3">
        <span className="text-base">✨</span>
        <input
          type="text"
          value={spawnInput}
          onChange={(e) => setSpawnInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSpawn()}
          placeholder='e.g. "Research competitors in the AR glasses space"'
          className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
          disabled={spawning}
        />
        <button
          onClick={handleSpawn}
          disabled={!spawnInput.trim() || spawning}
          className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {spawning ? 'Spawning...' : 'Enter ↵'}
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
    </div>
  );
}
