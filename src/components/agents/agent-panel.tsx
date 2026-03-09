"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Square, X, Send, Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";

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
  integrations?: string[];
}

interface AgentPanelProps {
  agent: AgentInstance;
  onSendMessage: (message: string) => void;
  onStop: () => void;
  onDelete: () => void;
  onExpand: () => void;
  onMove: (position: { x: number; y: number }) => void;
}

const statusConfig = {
  running: { color: '#10B981', label: 'Running', icon: null, border: 'border-l-[#10B981]' },
  idle: { color: '#9CA3AF', label: 'Idle', icon: null, border: 'border-l-[#9CA3AF]' },
  done: { color: '#3B82F6', label: 'Done', icon: CheckCircle, border: 'border-l-[#3B82F6]' },
  failed: { color: '#EF4444', label: 'Failed', icon: AlertCircle, border: 'border-l-[#EF4444]' },
  scheduled: { color: '#F59E0B', label: 'Scheduled', icon: Clock, border: 'border-l-[#F59E0B]' },
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AgentPanel({ agent, onSendMessage, onStop, onDelete, onExpand, onMove }: AgentPanelProps) {
  const [input, setInput] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);

  const cfg = statusConfig[agent.status];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.messages]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    e.preventDefault();
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: agent.position.x,
      panelY: agent.position.y,
    };
    setIsDragging(true);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mouseX;
      const dy = ev.clientY - dragStart.current.mouseY;
      onMove({
        x: Math.max(0, dragStart.current.panelX + dx),
        y: Math.max(0, dragStart.current.panelY + dy),
      });
    };

    const handleMouseUp = () => {
      dragStart.current = null;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [agent.position, onMove]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const recentMessages = agent.messages.slice(-8);

  return (
    <div
      className={cn(
        "absolute bg-white border border-gray-200 border-l-4 rounded-sm shadow-md",
        "flex flex-col transition-shadow",
        cfg.border,
        isDragging ? "shadow-xl scale-[1.02] z-50" : "hover:shadow-lg z-10",
      )}
      style={{
        left: agent.position.x,
        top: agent.position.y,
        width: 320,
        minHeight: 200,
        maxHeight: 400,
        cursor: isDragging ? 'grabbing' : 'grab',
        animation: 'agentFadeIn 0.25s ease-out',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 select-none">
        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{agent.name}</span>
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: cfg.color,
            animation: agent.status === 'running' ? 'pulse 2s infinite' : 'none',
          }}
        />
        {/* Controls - shown on hover */}
        <div className={cn("flex items-center gap-1 no-drag transition-opacity", isHovered ? "opacity-100" : "opacity-0")}>
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          {agent.status === 'running' && (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(); }}
              className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
              title="Stop"
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50/50 border-b border-gray-100">
        {cfg.icon && <cfg.icon className="w-3 h-3" style={{ color: cfg.color }} />}
        {!cfg.icon && <Zap className="w-3 h-3" style={{ color: cfg.color }} />}
        <span className="font-mono text-[10px] text-gray-500">
          {cfg.label}
          {agent.model && ` · ${agent.model.includes('sonnet') ? 'Sonnet' : agent.model.includes('haiku') ? 'Haiku' : 'Claude'}`}
          {agent.status === 'idle' && ` · ${timeAgo(agent.lastActiveAt)}`}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 no-drag" style={{ maxHeight: 220 }}>
        {recentMessages.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-2">Starting task...</div>
        ) : (
          recentMessages.map((msg, i) => (
            <div key={i} className={cn("text-xs", msg.role === 'user' ? "text-gray-500" : "text-gray-800")}>
              {msg.role === 'user' && <span className="text-gray-400 mr-1">&gt;</span>}
              <span className="leading-relaxed">{msg.content}</span>
            </div>
          ))
        )}
        {agent.status === 'running' && (
          <div className="text-xs text-gray-400 animate-pulse">...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-2 py-1.5 no-drag flex items-center gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Message..."
          className="flex-1 text-xs bg-gray-50 border border-gray-200 px-2 py-1 outline-none focus:border-gray-400 rounded-sm text-gray-700 placeholder-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || agent.status === 'running'}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
