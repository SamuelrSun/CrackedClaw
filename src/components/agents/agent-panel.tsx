"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Square, X, Send, Clock, CheckCircle, AlertCircle } from "lucide-react";

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

const STATUS_COLORS: Record<string, string> = {
  running: '#10B981',
  idle: '#9CA3AF',
  done: '#3B82F6',
  failed: '#EF4444',
  scheduled: '#F59E0B',
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

function getModelLabel(model?: string): string {
  if (!model) return 'Claude';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  if (model.includes('opus')) return 'Opus';
  return 'Claude';
}

function MessageBubble({ msg }: { msg: AgentMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = msg.role === 'user';
  const lines = msg.content.split('\n');
  const isLong = lines.length > 4 || msg.content.length > 200;
  const displayContent = !expanded && isLong
    ? msg.content.slice(0, 200) + '...'
    : msg.content;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-2.5 py-1.5 rounded-md text-[12px] leading-relaxed",
          isUser
            ? "bg-emerald-600 text-white"
            : "bg-white border border-gray-200 text-gray-800 shadow-sm"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{displayContent}</p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "text-[10px] mt-0.5 opacity-70 hover:opacity-100",
              isUser ? "text-emerald-100" : "text-blue-500"
            )}
          >
            {expanded ? 'show less' : 'show more'}
          </button>
        )}
      </div>
    </div>
  );
}

export function AgentPanel({ agent, onSendMessage, onStop, onDelete, onExpand, onMove }: AgentPanelProps) {
  const [input, setInput] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [size, setSize] = useState({ width: 360, height: 380 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);
  const resizeStart = useRef<{ mouseX: number; mouseY: number; width: number; height: number } | null>(null);

  const statusColor = STATUS_COLORS[agent.status] ?? '#9CA3AF';
  const modelLabel = getModelLabel(agent.model);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.messages]);

  // Header drag
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
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
      onMove({
        x: Math.max(0, dragStart.current.panelX + (ev.clientX - dragStart.current.mouseX)),
        y: Math.max(0, dragStart.current.panelY + (ev.clientY - dragStart.current.mouseY)),
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

  // Resize handle
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: size.width,
      height: size.height,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeStart.current) return;
      const newWidth = Math.min(600, Math.max(300, resizeStart.current.width + (ev.clientX - resizeStart.current.mouseX)));
      const newHeight = Math.min(500, Math.max(200, resizeStart.current.height + (ev.clientY - resizeStart.current.mouseY)));
      setSize({ width: newWidth, height: newHeight });
    };
    const handleMouseUp = () => {
      resizeStart.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [size]);

  const handleSend = () => {
    if (!input.trim() || agent.status === 'running') return;
    onSendMessage(input.trim());
    setInput('');
  };

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
        "absolute bg-[#FAFAF8] border border-gray-200 rounded-lg shadow-md flex flex-col",
        "transition-shadow duration-150",
        isDragging ? "shadow-2xl z-50 ring-1 ring-gray-300" : "hover:shadow-lg z-10",
      )}
      style={{
        left: agent.position.x,
        top: agent.position.y,
        width: size.width,
        height: size.height,
        animation: 'agentFadeIn 0.2s ease-out',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowDeleteConfirm(false); }}
    >
      {/* Header / Drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 rounded-t-lg bg-white select-none"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleHeaderMouseDown}
      >
        {/* Status dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: statusColor,
            boxShadow: agent.status === 'running' ? `0 0 6px ${statusColor}` : 'none',
          }}
        />
        {/* Name */}
        <span className="flex-1 text-[13px] font-medium text-gray-800 truncate">{agent.name}</span>
        {/* Controls shown on hover */}
        <div className={cn("flex items-center gap-0.5 no-drag transition-opacity", isHovered ? "opacity-100" : "opacity-0")}>
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
              className="p-1 hover:bg-orange-50 rounded text-gray-400 hover:text-orange-500 transition-colors"
              title="Stop"
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className={cn(
              "p-1 rounded transition-colors text-gray-400",
              showDeleteConfirm
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "hover:bg-red-50 hover:text-red-500"
            )}
            title={showDeleteConfirm ? "Click again to confirm" : "Delete"}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 no-drag" style={{ minHeight: 0 }}>
        {agent.messages.length === 0 ? (
          <div className="text-[11px] text-gray-400 italic py-2 text-center">Starting task...</div>
        ) : (
          agent.messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        {agent.status === 'running' && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-2.5 py-1.5 rounded-md shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-2.5 py-2 no-drag flex items-center gap-1.5 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          className="flex-1 text-[12px] bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-md outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 text-gray-700 placeholder-gray-400 transition-colors"
          disabled={agent.status === 'running'}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || agent.status === 'running'}
          className="p-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-gray-100 bg-white rounded-b-lg flex items-center gap-1.5 no-drag">
        {agent.status === 'done' && <CheckCircle className="w-2.5 h-2.5 text-blue-400" />}
        {agent.status === 'failed' && <AlertCircle className="w-2.5 h-2.5 text-red-400" />}
        {agent.status === 'scheduled' && <Clock className="w-2.5 h-2.5 text-amber-400" />}
        <span className="text-[10px] text-gray-400 font-mono">
          {modelLabel} · {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          {agent.status === 'idle' && ` · ${timeAgo(agent.lastActiveAt)}`}
        </span>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-30 hover:opacity-70 transition-opacity no-drag"
        style={{ borderRight: '2px solid #9CA3AF', borderBottom: '2px solid #9CA3AF', borderRadius: '0 0 4px 0' }}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
}
