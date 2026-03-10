"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send } from "lucide-react";
import { AgentInstance, AgentMessage } from "./agent-panel";
import { cn } from "@/lib/utils";

interface AgentExpandModalProps {
  agent: AgentInstance;
  onClose: () => void;
  onSendMessage: (message: string) => void;
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

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageRow({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-7 h-7 rounded-[2px] flex items-center justify-center text-[11px] font-medium flex-shrink-0 mt-0.5",
        isUser ? "bg-[#1A3C2B] text-white" : "bg-[#F7F7F5] text-[#3A3A38] border border-[#3A3A38]/15"
      )}>
        {isUser ? 'You' : '🤖'}
      </div>
      <div className={cn("flex flex-col max-w-[75%]", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "px-3 py-2 rounded-[2px] text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-[#1A3C2B] text-white"
            : "bg-white border border-[#3A3A38]/15 text-[#3A3A38]"
        )}>
          {msg.content}
        </div>
        <span className="text-[10px] text-[#3A3A38]/30 mt-1 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
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
  const isRunning = agent.status === 'running';
  const toolInfo = agent.currentTool ? TOOL_LABELS[agent.currentTool] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.messages, agent.streamBuffer]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSend = () => {
    if (!input.trim() || isRunning) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#F7F7F5] w-full max-w-2xl h-[85vh] flex flex-col rounded-[2px] border border-[#3A3A38]/15 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#3A3A38]/10 bg-white flex-shrink-0">
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full flex-shrink-0",
              isRunning && "animate-pulse",
            )}
            style={{
              backgroundColor: isRunning ? '#9EFFBF' : agent.status === 'failed' ? '#FF8C69' : '#3A3A38',
              opacity: isRunning || agent.status === 'failed' ? 1 : 0.3,
            }}
          />
          <div className="flex-1 min-w-0">
            <h2
              className="font-medium text-[#1A3C2B] text-[15px]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {agent.name}
            </h2>
            <p className="text-[11px] text-[#3A3A38]/50 truncate mt-0.5 font-mono">{agent.task}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn(
              "text-[10px] font-mono px-2 py-0.5 rounded-[2px] border",
              isRunning ? "border-[#9EFFBF]/50 text-[#1A3C2B] bg-[#9EFFBF]/10" :
              agent.status === 'failed' ? "border-[#FF8C69]/50 text-[#FF8C69] bg-[#FF8C69]/5" :
              "border-[#3A3A38]/15 text-[#3A3A38]/50"
            )}>
              {agent.status.toUpperCase()}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#3A3A38]/5 rounded-[2px] text-[#3A3A38]/40 hover:text-[#1A3C2B] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tool indicator bar */}
        {toolInfo && (
          <div className="px-5 py-2 border-b border-[#3A3A38]/5 bg-[#9EFFBF]/10 flex items-center gap-2 flex-shrink-0">
            <span className="text-[13px]">{toolInfo.icon}</span>
            <span className="text-[12px] font-mono text-[#1A3C2B]/70">{toolInfo.label}...</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {agent.messages.length === 0 && !agent.streamBuffer ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <div className="text-[13px] text-[#3A3A38]/40 font-mono">
                {isRunning ? 'Agent is starting...' : 'No messages yet'}
              </div>
            </div>
          ) : (
            <>
              {agent.messages.map((msg, i) => <MessageRow key={i} msg={msg} />)}

              {/* Streaming buffer as partial assistant message */}
              {isRunning && agent.streamBuffer && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-[2px] bg-[#F7F7F5] border border-[#3A3A38]/15 flex items-center justify-center text-[11px] flex-shrink-0">
                    🤖
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white border border-[#9EFFBF]/30 px-3 py-2 rounded-[2px] text-sm leading-relaxed whitespace-pre-wrap break-words text-[#3A3A38]">
                      {agent.streamBuffer}
                      <span className="inline-block w-1.5 h-3.5 bg-[#1A3C2B] ml-0.5 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {/* Typing indicator when running but no buffer yet */}
              {isRunning && !agent.streamBuffer && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-[2px] bg-[#F7F7F5] border border-[#3A3A38]/15 flex items-center justify-center text-[11px] flex-shrink-0">
                    🤖
                  </div>
                  <div className="bg-white border border-[#3A3A38]/15 px-3 py-2 rounded-[2px]">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-[#3A3A38]/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#3A3A38]/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#3A3A38]/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[#3A3A38]/10 bg-white px-4 py-3 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message ${agent.name}...`}
              rows={1}
              disabled={isRunning}
              className="flex-1 text-sm bg-[#F7F7F5] border border-[#3A3A38]/15 px-3 py-2 rounded-[2px] outline-none focus:border-[#1A3C2B]/30 text-[#3A3A38] placeholder-[#3A3A38]/35 transition-colors resize-none disabled:opacity-50 font-mono"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isRunning}
              className="p-2.5 bg-[#1A3C2B] text-white rounded-[2px] hover:bg-[#1A3C2B]/80 disabled:opacity-30 transition-colors flex-shrink-0 self-end"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-[#3A3A38]/30 mt-1.5 ml-1 font-mono">Enter to send · Shift+Enter for new line · Esc to close</p>
        </div>
      </div>
    </div>
  );
}
