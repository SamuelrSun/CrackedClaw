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

export function AgentExpandModal({ agent, onClose, onSendMessage }: AgentExpandModalProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agent.messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-2xl h-[80vh] flex flex-col rounded-sm shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="font-medium text-gray-900">{agent.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{agent.task}</p>
          </div>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: agent.status === 'running' ? '#10B981' : agent.status === 'failed' ? '#EF4444' : agent.status === 'done' ? '#3B82F6' : '#9CA3AF',
            }}
          />
          <span className="font-mono text-[10px] uppercase text-gray-500">{agent.status}</span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {agent.messages.map((msg: AgentMessage, i: number) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] px-3 py-2 text-sm rounded-sm",
                  msg.role === 'user'
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-800"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {agent.status === 'running' && (
            <div className="flex gap-3">
              <div className="bg-gray-100 px-3 py-2 text-sm rounded-sm text-gray-400 animate-pulse">...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Message ${agent.name}...`}
            className="flex-1 text-sm bg-gray-50 border border-gray-200 px-3 py-2 outline-none focus:border-gray-400 rounded-sm text-gray-700 placeholder-gray-400"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || agent.status === 'running'}
            className="p-2 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors rounded-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
