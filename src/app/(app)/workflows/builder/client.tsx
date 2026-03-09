"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { WorkflowVisualizer, type WorkflowDef } from "@/components/workflows/workflow-visualizer";
import { parseMessageContent } from "@/lib/chat/message-parser";
import { WORKFLOW_BUILDER_SYSTEM_PROMPT } from "@/lib/workflows/workflow-prompt";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessage extends Message {
  id: string;
}

function MessageBubble({ msg, onWorkflowParsed }: {
  msg: ChatMessage;
  onWorkflowParsed: (wf: WorkflowDef) => void;
}) {
  const segments = parseMessageContent(msg.content);
  const isUser = msg.role === "user";

  useEffect(() => {
    for (const seg of segments) {
      if (seg.type === "workflow-preview") {
        onWorkflowParsed(seg.workflow);
      }
    }
  }, [segments, onWorkflowParsed]);

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-[#1A3C2B] text-[#F5F3EF] rounded-tr-sm"
            : "bg-[#F5F3EF] border border-[rgba(58,58,56,0.15)] text-[#1a1a19] rounded-tl-sm"
        )}
      >
        {segments.map((seg, i) => {
          if (seg.type === "workflow-preview") return null; // handled via effect
          if (seg.type === "text") {
            return (
              <div key={i} className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <ReactMarkdown>{seg.content}</ReactMarkdown>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function WorkflowBuilderClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your workflow builder. Describe what you'd like to automate and I'll set it up for you.\n\nFor example: *\"Every morning at 8am, check my Gmail for urgent emails and summarize them in a Slack message\"*",
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowDef | null>(null);
  const [highlightedNode, setHighlightedNode] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleWorkflowParsed = useCallback((wf: WorkflowDef) => {
    setWorkflow(wf);
    setSaved(false);
  }, []);

  const handleNodeClick = useCallback((nodeId: string, nodeName: string) => {
    setHighlightedNode(nodeId);
    setInput(`Tell me more about the "${nodeName}" step, or I want to change it to `);
    inputRef.current?.focus();
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = inputRef.current.value.length;
        inputRef.current.selectionEnd = inputRef.current.value.length;
      }
    }, 50);
  }, []);

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history: Message[] = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: messageText });

      const res = await fetch("/api/gateway/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          system_prompt_override: WORKFLOW_BUILDER_SYSTEM_PROMPT,
          conversation_history: history,
        }),
      });

      const data = await res.json();
      const reply = data.message || data.response || data.content || "Sorry, I couldn't process that.";

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workflow || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workflows/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflow),
      });
      if (res.ok) {
        setSaved(true);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: `✅ Workflow **"${workflow.name}"** saved successfully! You can find it on your [Workflows page](/workflows).`,
        }]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => {
    sendMessage("Looks good! Please confirm and save this workflow.");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#F5F3EF]">
      {/* Left: Chat */}
      <div className="flex flex-col w-1/2 border-r border-[rgba(58,58,56,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(58,58,56,0.1)] bg-white/60">
          <div className="flex items-center gap-2">
            <Link href="/workflows" className="font-mono text-[10px] uppercase tracking-wide text-[#1A3C2B]/60 hover:text-[#1A3C2B] transition-colors">
              ← Workflows
            </Link>
            <span className="text-[rgba(58,58,56,0.2)]">/</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-[#1A3C2B]">AI Builder</span>
          </div>
          <span className="text-lg">💬</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} onWorkflowParsed={handleWorkflowParsed} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F5F3EF] border border-[rgba(58,58,56,0.15)] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1A3C2B]/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1A3C2B]/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1A3C2B]/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {/* Confirm button if workflow is ready */}
          {workflow && !saved && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 bg-[#1A3C2B] text-white font-mono text-[11px] uppercase tracking-wide rounded-lg hover:bg-[#1A3C2B]/80 transition-colors disabled:opacity-40"
              >
                ✓ Confirm &amp; Save
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[rgba(58,58,56,0.1)] p-3 bg-white/40">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your workflow... (Enter to send)"
              disabled={loading}
              rows={2}
              className="flex-1 resize-none bg-white border border-[rgba(58,58,56,0.2)] rounded-xl px-3 py-2 font-mono text-xs outline-none placeholder:text-[rgba(58,58,56,0.3)] text-[#1a1a19] focus:border-[#1A3C2B]/40 transition-colors disabled:opacity-60"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-[#1A3C2B] text-white rounded-xl font-mono text-[11px] hover:bg-[#1A3C2B]/80 transition-colors disabled:opacity-40 self-end"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Right: Visual Preview */}
      <div className="flex flex-col w-1/2 bg-white/30">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(58,58,56,0.1)] bg-white/60">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-mono text-[11px] uppercase tracking-wide text-[#1A3C2B]">Workflow Preview</span>
          </div>
          {workflow && (
            <div className="flex gap-2">
              <button
                onClick={() => sendMessage("Let me edit this workflow")}
                className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide border border-[rgba(58,58,56,0.2)] rounded-lg hover:bg-gray-50 transition-colors"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => sendMessage("Test this workflow with sample data")}
                className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide border border-[rgba(58,58,56,0.2)] rounded-lg hover:bg-gray-50 transition-colors"
              >
                ▶️ Test
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide bg-[#1A3C2B] text-white rounded-lg hover:bg-[#1A3C2B]/80 transition-colors disabled:opacity-50"
              >
                {saved ? "✓ Saved" : saving ? "Saving..." : "💾 Save"}
              </button>
            </div>
          )}
        </div>

        {/* Visualizer */}
        <div className="flex-1 overflow-y-auto p-4">
          <WorkflowVisualizer
            workflow={workflow}
            onNodeClick={handleNodeClick}
            highlightedId={highlightedNode}
          />
        </div>
      </div>
    </div>
  );
}
