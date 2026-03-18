"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Square, X } from "lucide-react";
import { AGENT_MODES } from "@/lib/agent/modes";

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentInstance {
  id: string;
  name: string;
  task: string;
  status: 'running' | 'idle' | 'done' | 'failed' | 'scheduled';
  messages: AgentMessage[];
  position: { x: number; y: number };
  createdAt: string;
  lastActiveAt: string;
  model?: string;
  mode?: string;
  integrations?: string[];
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCost?: number;
  // Client-side streaming state
  currentTool?: string | null;
  streamBuffer?: string;
  startedAt?: number;
}

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  web_search: { label: 'Searching web', icon: '🔍' },
  web_fetch: { label: 'Fetching page', icon: '🌐' },
  browser: { label: 'Browsing', icon: '🖥' },
  gmail_search: { label: 'Reading emails', icon: '📧' },
  gmail_send: { label: 'Sending email', icon: '✉️' },
  gmail_drafts: { label: 'Managing drafts', icon: '📝' },
  gmail_labels: { label: 'Organizing email', icon: '🏷' },
  exec: { label: 'Running command', icon: '⚡' },
  file_read: { label: 'Reading file', icon: '📄' },
  file_write: { label: 'Writing file', icon: '💾' },
  memory_search: { label: 'Searching memory', icon: '🧠' },
  memory_add: { label: 'Saving to memory', icon: '💡' },
  scan_integration: { label: 'Scanning', icon: '📡' },
  get_integration_token: { label: 'Authenticating', icon: '🔑' },
  list_integrations: { label: 'Checking integrations', icon: '🔗' },
};

function getModelLabel(model?: string): string {
  if (!model) return 'Claude';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  if (model.includes('opus')) return 'Opus';
  return 'Claude';
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="font-mono text-[10px] text-white/60 tabular-nums">
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
    </span>
  );
}

function MiniLog({ content }: { content: string }) {
  const lines = content.split('\n').filter(Boolean);
  const lastLines = lines.slice(-5);

  return (
    <div
      className="font-mono text-[11px] leading-[1.5] text-white/50 whitespace-pre-wrap break-words overflow-hidden"
      style={{ maxHeight: '7.5em' }}
    >
      {lastLines.length > 0 ? lastLines.join('\n') : (
        <span className="text-white/25 italic">Thinking...</span>
      )}
    </div>
  );
}

interface AgentPanelProps {
  agent: AgentInstance;
  onStop: () => void;
  onDelete: () => void;
  onExpand: () => void;
}

export function AgentPanel({ agent, onStop, onDelete, onExpand }: AgentPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isRunning = agent.status === 'running';
  const isFailed = agent.status === 'failed';
  const isSpawning = isRunning && !agent.streamBuffer && !agent.currentTool;
  const modelLabel = getModelLabel(agent.model);
  const modeEmoji = AGENT_MODES[agent.mode || 'agent']?.emoji || '🤖';
  const toolInfo = agent.currentTool ? TOOL_LABELS[agent.currentTool] : null;

  // Content for the mini-log
  const miniLogContent = agent.streamBuffer
    || agent.messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content
    || '';

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete();
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div
      className={cn(
        "bg-black/[0.07] backdrop-blur-[10px] border flex flex-col overflow-hidden",
        "transition-colors duration-300",
        "rounded-[3px]",
        isSpawning && "border-[#F4D35E]/30",
        isRunning && !isSpawning && "border-[#9EFFBF]/30",
        isFailed && "border-[#FF8C69]/30",
        !isRunning && !isFailed && "border-white/10",
      )}
      style={{ animation: 'agentFadeIn 0.3s ease-out' }}
      onMouseLeave={() => setShowDeleteConfirm(false)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] bg-white/[0.04]">
        {/* Status dot */}
        <div
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            isRunning && "animate-pulse",
          )}
          style={{
            backgroundColor: isRunning ? '#9EFFBF' : isFailed ? '#FF8C69' : '#3A3A38',
            opacity: isRunning || isFailed ? 1 : 0.3,
          }}
        />
        {/* Name */}
        <span
          className="flex-1 text-[13px] font-medium text-white/80 truncate"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {agent.name}
        </span>
        {/* Elapsed timer */}
        {isRunning && agent.startedAt && <ElapsedTimer startedAt={agent.startedAt} />}
        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onExpand}
            className="p-1 hover:bg-white/[0.06] rounded-[3px] text-white/25 hover:text-white/80 transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          {isRunning && (
            <button
              onClick={onStop}
              className="p-1 hover:bg-[#FF8C69]/10 rounded-[3px] text-white/25 hover:text-[#FF8C69] transition-colors"
              title="Stop"
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className={cn(
              "p-1 rounded-[3px] transition-colors text-white/25",
              showDeleteConfirm
                ? "bg-[#FF8C69]/15 text-[#FF8C69]"
                : "hover:bg-[#FF8C69]/10 hover:text-[#FF8C69]"
            )}
            title={showDeleteConfirm ? "Click again to confirm" : "Delete"}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Task description */}
      <div className="px-3 py-2 border-b border-white/[0.05]">
        <p className="text-[11px] text-white/50 truncate">{agent.task}</p>
      </div>

      {/* Tool indicator */}
      {toolInfo && (
        <div className="px-3 py-1.5 border-b border-white/[0.05] bg-[#9EFFBF]/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px]">{toolInfo.icon}</span>
            <span className="text-[11px] font-medium text-white/80 font-mono">
              {toolInfo.label}...
            </span>
          </div>
        </div>
      )}

      {/* Spawning indicator */}
      {isSpawning && (
        <div className="px-3 py-1.5 border-b border-white/[0.05] bg-[#F4D35E]/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] animate-pulse">✨</span>
            <span className="text-[11px] font-medium text-white/50 font-mono">
              Deploying agent...
            </span>
          </div>
        </div>
      )}

      {/* Mini-log */}
      <div className="flex-1 px-3 py-2 min-h-[80px] max-h-[120px] overflow-hidden">
        {miniLogContent ? (
          <MiniLog content={miniLogContent} />
        ) : (
          <div className="text-[11px] text-white/30 italic font-mono">
            No output yet
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-white/[0.06] bg-white/[0.03] flex items-center gap-1.5">
        <span className="text-[10px] text-white/50 font-mono">
          {modeEmoji} {modelLabel}
          {' · '}
          {isRunning ? (
            <span className="text-white/80">Running</span>
          ) : isFailed ? (
            <span className="text-[#FF8C69]">Failed</span>
          ) : (
            <>Idle · {timeAgo(agent.lastActiveAt)}</>
          )}
        </span>
        <span className="flex-1" />
        {agent.totalCost != null && agent.totalCost > 0 && (
          <span className="text-[10px] text-white/40 font-mono">
            ${agent.totalCost.toFixed(4)}
          </span>
        )}
        <span className="text-[10px] text-white/30 font-mono">
          {agent.messages.length} msg{agent.messages.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
