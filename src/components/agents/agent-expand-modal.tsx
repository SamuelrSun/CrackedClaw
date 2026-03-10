"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, CheckCircle, AlertCircle, Clock, Wrench } from "lucide-react";
import { AgentInstance, AgentMessage } from "./agent-panel";
import { cn } from "@/lib/utils";

interface AgentExpandModalProps {
  agent: AgentInstance;
  onClose: () => void;
  onSendMessage: (message: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  running: '#10B981',
  idle: '#9CA3AF',
  done: '#3B82F6',
  failed: '#EF4444',
  scheduled: '#F59E0B',
};

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageRow({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 mt-0.5",
        isUser ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 border border-gray-200"
      )}>
        {isUser ? 'You' : '🤖'}
      </div>
      <div className={cn("flex flex-col max-w-[75%]", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-emerald-600 text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-800 shadow-sm rounded-tl-sm"
        )}>
          {msg.content}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
}

export function AgentExpandModal({ agent, onClose, onSendMessage }: AgentExpandModalProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const statusColor = STATUS_COLORS[agent.status] ?? '#9CA3AF';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.messages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || agent.status === 'running') return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#FAFAF8] w-full max-w-2xl h-[85vh] flex flex-col rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: statusColor,
              boxShadow: agent.status === 'running' ? `0 0 8px ${statusColor}` : 'none',
            }}
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-[15px]">{agent.name}</h2>
            <p className="text-xs text-gray-500 truncate mt-0.5">{agent.task}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn(
              "text-[10px] font-mono px-2 py-0.5 rounded-full",
              agent.status === 'running' ? "bg-emerald-50 text-emerald-700" :
              agent.status === 'failed' ? "bg-red-50 text-red-600" :
              agent.status === 'done' ? "bg-blue-50 text-blue-600" :
              "bg-gray-100 text-gray-500"
            )}>
              {agent.status.toUpperCase()}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {agent.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <div className="text-3xl">🤖</div>
              <p className="text-sm text-gray-500">Agent is ready. Send a message to get started.</p>
              <p className="text-xs text-gray-400 max-w-xs">{agent.task}</p>
            </div>
          ) : (
            agent.messages.map((msg, i) => <MessageRow key={i} msg={msg} />)
          )}
          {agent.status === 'running' && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] flex-shrink-0">
                🤖
              </div>
              <div className="bg-white border border-gray-200 shadow-sm px-3 py-2 rounded-xl rounded-tl-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agent.name}...`}
              rows={1}
              disabled={agent.status === 'running'}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 text-gray-700 placeholder-gray-400 transition-colors resize-none disabled:opacity-50"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || agent.status === 'running'}
              className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors flex-shrink-0 self-end"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
