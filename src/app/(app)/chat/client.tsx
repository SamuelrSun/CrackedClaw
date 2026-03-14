"use client";

import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Conversation, Message } from "@/lib/mock-data";
import { useGateway } from "@/hooks/use-gateway";
import { useToast } from "@/hooks/use-toast";
import type { GatewayError } from "@/types/gateway";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationListSkeleton } from "@/components/skeletons/list-skeleton";
import { ChatSkeleton } from "@/components/skeletons/chat-skeleton";
import { parseMessageContent, type ParsedSegment } from "@/lib/chat/message-parser";
import { DynamicIntegrationsCard } from "@/components/chat/dynamic-integrations-card";

import { ScanTriggerCard } from "@/components/chat/scan-trigger-card";
import { ScanProgressCard } from "@/components/chat/scan-progress-card";
import type { ScanProgressCardProps } from "@/components/chat/scan-progress-card";
import { SkillSuggestCard } from "@/components/chat/skill-suggest-card";
import {
  IntegrationConnectCard,
  IntegrationStatusCard,
  SubagentProgressCard,
  WorkflowSuggestionCard,
  ContextSummaryCard,
} from "@/components/chat";
import { ActiveAgentsPanel } from "@/components/chat/active-agents-panel";
import { AgentActivityPanel } from "@/components/chat/agent-activity-panel";
import type { AgentActivityEntry } from "@/components/chat/agent-activity-panel";
import { SubagentPanel } from "@/components/chat/subagent-panel";
import { InlineTaskCard } from "@/components/chat/inline-task-card";
import type { SubagentSession } from "@/components/chat/subagent-card";
import { ChatError } from "@/components/chat/chat-error";
import { useNodeStatus } from "@/hooks/use-node-status";
import { MemoryPanel, type MemoryInsights } from "@/components/chat/memory-panel";
import { BrowserPreviewCard } from "@/components/chat/browser-preview-card";
import { BrowserOpenCard } from "@/components/chat/browser-open-card";
import { getIntegration } from "@/lib/integrations/registry";
import { LinkedContextBadge } from "@/components/chat/linked-context-badge";
import { ConversationContextMenu } from "@/components/chat/conversation-context-menu";
import { ConversationPickerModal } from "@/components/chat/conversation-picker-modal";
import { FileUploadButton, uploadFiles } from "@/components/chat/file-upload-button";
import type { UploadedFile } from "@/components/chat/file-upload-button";
import { FilePreview } from "@/components/chat/file-preview";
import { FileMessageCard } from "@/components/chat/file-message-card";
import type { FileAttachmentMeta } from "@/lib/chat/message-parser";
import { VoiceInputButton } from "@/components/chat/voice-input-button";
import { VoiceOutputButton } from "@/components/chat/voice-output-button";
import { EmailComposerCard } from "@/components/chat/email-composer-card";
import type { EmailDraft } from "@/lib/email/gmail-client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { useGatewayWS, type WSChatEvent } from "@/hooks/use-gateway-ws";
import { useSystemPrompt } from "@/hooks/use-system-prompt";
import { ThinkingBlock } from "@/components/chat/thinking-block";
import { ToolTimeline } from "@/components/chat/tool-timeline";
import { ModelSelector } from "@/components/chat/model-selector";
import { InputToolbar } from "@/components/chat/input-toolbar";
import { MessageFeedback } from "@/components/chat/message-feedback";

interface ToolCallInfo {
  tool: string;
  status: "running" | "done";
  label: string;
  startTime?: number;
  duration?: number;
  input?: Record<string, unknown>;
  result?: string;
}

// Extended message type with streaming fields
interface StreamingMessage extends Message {
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
}

function getToolEmoji(tool: string): string {
  if (tool === "browser") return "🌐";
  if (tool === "exec") return "⚙️";
  if (tool === "web_search" || tool === "web_fetch") return "🔍";
  if (tool.includes("skill")) return "📦";
  if (tool === "thinking") return "💭";
  return "🔧";
}

function getToolLabel(tool: string, input?: Record<string, unknown>): string {
  if (tool === "browser") {
    const action = input?.action as string | undefined;
    const url = (input?.url || input?.targetUrl) as string | undefined;
    if (url) {
      try {
        const host = new URL(url).hostname.replace("www.", "");
        if (action === "navigate") return `Navigating to ${host}`;
        if (action === "screenshot") return `Taking screenshot of ${host}`;
        if (action === "snapshot") return `Capturing ${host}`;
        return `Browser: ${action || "action"} on ${host}`;
      } catch { /* invalid URL */ }
    }
    return `Browser: ${action || "action"}`;
  }
  if (tool === "web_search" || tool === "web_fetch") {
    const query = (input?.query || input?.url) as string | undefined;
    if (query) return `Searching for "${query.length > 40 ? query.slice(0, 40) + "..." : query}"`;
    return "Searching the web";
  }
  if (tool === "exec") {
    const cmd = input?.command as string | undefined;
    if (cmd) return `Running: ${cmd.length > 40 ? cmd.slice(0, 40) + "..." : cmd}`;
    return "Running command";
  }
  if (tool.includes("skill")) return "Installing skill";
  return `Using ${tool}`;
}


function getAgentTaskLabel(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case 'browser': {
      const url = (input.url as string) || (input.targetUrl as string) || '';
      const action = (input.action as string) || '';
      if (url) {
        try { return `Browsing ${new URL(url).hostname}...`; } catch { return `Browsing...`; }
      }
      return `Browser: ${action}...`;
    }
    case 'exec':
      return `Running: ${String(input.command || '').slice(0, 40)}...`;
    case 'web_search':
      return `Searching: ${String(input.query || '').slice(0, 40)}...`;
    case 'web_fetch': {
      const url = input.url as string || '';
      try { return `Reading ${new URL(url).hostname}...`; } catch { return 'Reading webpage...'; }
    }
    default:
      return `Running ${tool}...`;
  }
}

function TokenUsageBar() {
  const [usage, setUsage] = useState<{
    percentWeekly: number;
    percentMonthly: number;
    weekly: { used: number; limit: number };
    plan: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/usage/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => setUsage(d))
      .catch(() => {});
  }, []);

  if (!usage) return null;

  const pct = Math.max(usage.percentWeekly, usage.percentMonthly);
  const isWarning = pct >= 80 && pct < 100;
  const isExceeded = pct >= 100;

  if (pct < 60) return null; // hide when usage is low

  return (
    <div className={`flex-shrink-0 px-4 py-1.5 border-t border-white/[0.08] flex items-center gap-3 ${
      isExceeded ? 'bg-red-500/10' : isWarning ? 'bg-amber-500/10' : 'bg-transparent'
    }`}>
      <div className="flex-1 h-1 bg-white/[0.06]">
        <div
          className={`h-full transition-all ${isExceeded ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`font-mono text-[10px] uppercase tracking-wide flex-shrink-0 ${
        isExceeded ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white/50'
      }`}>
        {isExceeded ? (
          <a href="/settings/billing" className="underline">Limit reached — Upgrade</a>
        ) : (
          `${pct}% of weekly limit`
        )}
      </span>
    </div>
  );
}

interface ChatPageClientProps {
  initialConversations: Conversation[];
  initialMessages: Message[];
  hasGateway?: boolean;
  gatewayHost?: string;
  initialConversationId?: string;
}

interface RichMessageProps {
  segments: ParsedSegment[];
  onIntegrationConnect: (provider: string) => Promise<boolean>;
  onWorkflowSelect: (id: string) => void;
  onWorkflowCustom: () => void;
  onScanComplete?: (summary: string) => void;
  onOpenMemory?: (insights: MemoryInsights, source: string) => void;
  gatewayHost?: string;
  onOpenBrowser?: (url: string, control?: boolean) => void;
  onSendEmail?: (email: EmailDraft) => Promise<void>;
  onSaveDraftEmail?: (email: EmailDraft) => Promise<void>;
  onViewActivity: () => void;
}

function RichMessage({
  segments,
  onIntegrationConnect,
  onWorkflowSelect,
  onWorkflowCustom,
  onScanComplete,
  onOpenMemory,
  gatewayHost,
  onOpenBrowser,
  onSendEmail,
  onSaveDraftEmail,
  onViewActivity,
}: RichMessageProps) {
  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => {
        switch (segment.type) {
          case "file-attachment":
            return (
              <FileMessageCard
                key={idx}
                files={(segment.files as FileAttachmentMeta[]).map(f => ({
                  id: f.id,
                  name: f.name,
                  size: f.size,
                  mimeType: f.mimeType,
                  url: f.url,
                }))}
                message={segment.message}
              />
            );
          case "text":
            return (
              <div key={idx} className="prose prose-base max-w-none prose-p:my-0 prose-p:mb-3 prose-p:leading-[26px] prose-headings:font-semibold prose-headings:text-white/90 prose-strong:text-white/90 prose-strong:font-semibold prose-code:text-sm prose-code:bg-white/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/[0.06] prose-pre:rounded-lg prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 text-white/[0.88]">
                <ReactMarkdown>{segment.content}</ReactMarkdown>
              </div>
            );
          case "integration-connect":
            return (
              <IntegrationConnectCard
                key={idx}
                provider={segment.provider}
                onConnect={async () => { return await onIntegrationConnect(segment.provider); }}
              />
            );
          case "integration-status":
            return (
              <IntegrationStatusCard
                key={idx}
                provider={segment.provider}
                status={segment.status}
                accountName={segment.accountName}
              />
            );
          case "subagent-progress":
            return <SubagentProgressCard key={idx} agents={segment.agents} />;
          case "workflow-suggest":
            return (
              <WorkflowSuggestionCard
                key={idx}
                suggestions={segment.suggestions}
                onSelect={onWorkflowSelect}
                onCustom={onWorkflowCustom}
              />
            );
          case "context-summary":
            return (
              <ContextSummaryCard
                key={idx}
                insights={segment.insights}
                source={segment.source}
                rawInsights={segment.rawInsights}
                onOpenMemory={onOpenMemory}
              />
            );
          case "welcome":
            return null; // removed - redundant with agent's intro message
          case "integrations-resolve":
            return (
              <DynamicIntegrationsCard
                key={idx}
                services={segment.services}
                gatewayHost={gatewayHost}
                onOpenBrowser={(url) => onOpenBrowser?.(url, false)}
              />
            );
          case "skill-suggest":
            return (
              <SkillSuggestCard
                key={idx}
                skillId={segment.skillId}
                reason={segment.reason}
              />
            );
          case "inline-task":
            return (
              <InlineTaskCard
                key={idx}
                taskId={`inline-${idx}`}
                taskName={segment.taskName}
                status={segment.status}
                details={segment.details}
              />
            );
          case "browser-preview":
            return (
              <BrowserPreviewCard
                key={idx}
                currentUrl={segment.url}
                status={segment.status}
                message={segment.message}
                onOpenPopup={() => onOpenBrowser?.(segment.url, false)}
                onTakeControl={() => onOpenBrowser?.(segment.url, true)}
                onIgnore={() => {}}
              />
            );
          case "browser-open":
            return (
              <BrowserOpenCard
                key={idx}
                url={segment.url}
                message={segment.message}
              />
            );
          case "email-composer":
            return (
              <EmailComposerCard
                key={idx}
                to={segment.to}
                cc={segment.cc}
                bcc={segment.bcc}
                subject={segment.subject}
                body={segment.body}
                integration={segment.integration}
                onSend={async (email) => {
                  if (onSendEmail) await onSendEmail(email);
                }}
                onSaveDraft={async (email) => {
                  if (onSaveDraftEmail) await onSaveDraftEmail(email);
                }}
              />
            );
          case "scan-trigger":
            // Scan trigger UI removed — deep scan is no longer surfaced in chat
            return null;
          case "scan-result":
            // Scan result UI removed — deep scan is no longer surfaced in chat
            return null;
          default:
            return null;
        }
      })}
    </div>
  );
}



// Enhanced connection status component for sidebar
function GatewayStatusPanel({
  status,
  latencyMs,
  reconnectAttempt,
  reconnectCountdown,
  isReconnecting,
  isCanceled,
  error,
  onRetry,
  onCancel,
}: {
  status: string;
  latencyMs: number | null;
  reconnectAttempt: number;
  reconnectCountdown: number | null;
  isReconnecting: boolean;
  isCanceled: boolean;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const statusColors: Record<string, string> = {
    connected: "bg-[#9EFFBF]",
    checking: "bg-[#F4D35E] animate-pulse",
    connecting: "bg-[#F4D35E] animate-pulse",
    reconnecting: "bg-[#F4D35E] animate-pulse",
    disconnected: "bg-grid/30",
    error: "bg-[#FF6B6B]",
  };

  const statusLabels: Record<string, string> = {
    connected: "Connected",
    checking: "Checking...",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
    error: "Error",
  };

  return (
    <div className="px-4 py-3 border-t border-white/[0.1] bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", statusColors[status] || statusColors.disconnected)} />
          <span className="font-mono text-[9px] uppercase tracking-wide text-white/50">
            Gateway {statusLabels[status] || status}
          </span>
        </div>
        {status === "connected" && latencyMs && (
          <span className="font-mono text-[8px] text-white/30">{latencyMs}ms</span>
        )}
      </div>
      
      {/* Reconnection UI */}
      {isReconnecting && (
        <div className="mt-2 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] text-white/50">
              Attempt {reconnectAttempt}/5
            </span>
            {reconnectCountdown && (
              <span className="font-mono text-[9px] text-[#F4D35E]">
                {reconnectCountdown}s
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={onRetry}
              className="flex-1 px-2 py-1 text-[8px] font-mono uppercase tracking-wide bg-white/[0.12] text-white hover:bg-white/[0.18] transition-colors"
            >
              Retry Now
            </button>
            <button
              onClick={onCancel}
              className="px-2 py-1 text-[8px] font-mono uppercase tracking-wide border border-white/[0.1] hover:bg-grid/5 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Error state or disconnected/canceled — show reconnect button */}
      {(status === "error" || status === "disconnected" || isCanceled) && !isReconnecting && (
        <div className="mt-2">
          {error && (
            <p className="text-[9px] text-[#FF6B6B] mb-1.5 truncate" title={error}>
              {error.length > 40 ? error.slice(0, 40) + '...' : error}
            </p>
          )}
          {isCanceled && !error && (
            <p className="text-[9px] text-white/50 mb-1.5">Reconnection canceled</p>
          )}
          <button
            onClick={onRetry}
            className="w-full px-2 py-1 text-[8px] font-mono uppercase tracking-wide bg-white/[0.12] text-white hover:bg-white/[0.18] transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}

// Reconnection banner for chat area
function ReconnectionBanner({
  isReconnecting,
  isCanceled,
  gatewayStatus,
  reconnectAttempt,
  reconnectCountdown,
  onRetry,
  onCancel,
}: {
  isReconnecting: boolean;
  isCanceled: boolean;
  gatewayStatus: string;
  reconnectAttempt: number;
  reconnectCountdown: number | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  // Show reconnecting state
  if (isReconnecting) {
    return (
      <div className="bg-[#F4D35E]/10 border-b border-[#F4D35E]/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#F4D35E] animate-pulse" />
          <span className="text-sm text-[#B8860B]">
            Connection lost. Reconnecting
            {reconnectCountdown ? ` in ${reconnectCountdown}s` : '...'}
            <span className="text-xs opacity-60 ml-1">(attempt {reconnectAttempt}/5)</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="text-xs font-mono uppercase tracking-wide text-[#B8860B] hover:text-[#8B6914] px-2 py-1 bg-[#F4D35E]/20 hover:bg-[#F4D35E]/30 transition-colors"
          >
            Retry Now
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-[#B8860B]/60 hover:text-[#B8860B]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Bug 5 fix: Show disconnected/canceled state with Reconnect button
  if (isCanceled || gatewayStatus === 'disconnected' || gatewayStatus === 'error') {
    return (
      <div className="bg-[#FF6B6B]/10 border-b border-[#FF6B6B]/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#FF6B6B]" />
          <span className="text-sm text-[#CC4444]">
            {isCanceled ? 'Reconnection canceled.' : 'Gateway disconnected.'}
          </span>
        </div>
        <button
          onClick={onRetry}
          className="text-xs font-mono uppercase tracking-wide text-white px-3 py-1 bg-[#CC4444] hover:bg-[#AA2222] transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  return null;
}

function parseFileAttachment(content: string): { files: Array<{name: string; size: number; mimeType: string}>; message: string } | null {
  const PREFIX = "[Attached files:";
  const SEP = "]\nUser message: ";
  if (!content.startsWith(PREFIX)) return null;
  const closeIdx = content.indexOf(SEP);
  if (closeIdx === -1) return null;
  const filesStr = content.slice(PREFIX.length, closeIdx);
  const message = content.slice(closeIdx + SEP.length).trim();
  const files = filesStr.split(",").map(s => s.trim()).filter(Boolean).map(line => {
    const parenOpen = line.lastIndexOf("(");
    const parenClose = line.lastIndexOf(")");
    if (parenOpen !== -1 && parenClose !== -1) {
      const name = line.slice(0, parenOpen).trim();
      const meta = line.slice(parenOpen + 1, parenClose);
      const parts = meta.split(",").map(s => s.trim());
      const sizeStr = parts[0] || "0";
      const mimeType = parts[1] || "application/octet-stream";
      const sizeNum = parseFloat(sizeStr);
      const sizeBytes = sizeStr.includes("MB") ? sizeNum * 1024 * 1024 : sizeStr.includes("KB") ? sizeNum * 1024 : sizeNum;
      return { name, size: sizeBytes, mimeType };
    }
    return { name: line, size: 0, mimeType: "application/octet-stream" };
  });
  return { files, message };
}

function UserMessageContent({ content }: { content: string }) {
  const parsed = parseFileAttachment(content);
  if (parsed) {
    return (
      <div>
        <FileMessageCard files={parsed.files} message={parsed.message || undefined} />
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-base leading-[24px]">{content}</p>;
}

// Fixed background — renders the landing image behind the chat UI
function ChatBg() {
  return (
    <>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: "rgba(0,0,0,0.45)" }}
      />
    </>
  );
}

function NewConversationLanding({ onSend }: { onSend: (message: string) => void }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const msg = input.trim();
    if (!msg) return;
    onSend(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, [input]);

  return (
    <>
      <ChatBg />
      <div
        className="relative z-[1] flex flex-col items-center justify-center h-[calc(100vh-64px)] px-6"
        style={{ paddingBottom: '15vh' }}
      >
        <h1
          className="text-4xl font-bold text-white/90 mb-8 text-center"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: '44px' }}
        >
          What can I do for you?
        </h1>

        <div className="w-full max-w-3xl">
          <div
            className="border border-white/[0.25]"
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(40px) saturate(150%)",
              WebkitBackdropFilter: "blur(40px) saturate(150%)",
              borderRadius: 0,
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a task or responsibility..."
              className="w-full bg-transparent text-base text-white/90 placeholder:text-white/30 p-4 resize-none outline-none min-h-[56px] max-h-[200px]"
              rows={1}
              autoFocus
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default function ChatPageClient({ 
  initialConversations, 
  initialMessages, 
  hasGateway: initialHasGateway = false,
  gatewayHost,
  initialConversationId,
}: ChatPageClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  // Only auto-select a conversation when a specific ID was provided (e.g. /chat/[id]).
  // When landing at bare /chat (no ID), start with empty string to show the landing view.
  const [activeConvo, setActiveConvo] = useState(initialConversationId || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<StreamingMessage[]>(initialMessages as StreamingMessage[]);
  // Sync messages when initialMessages prop updates (async load from page-content)
  useEffect(() => { if (initialMessages.length > 0) setMessages(initialMessages as StreamingMessage[]); }, [initialMessages]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GatewayError | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeAgentTasks, setActiveAgentTasks] = useState<Array<{id: string, label: string, startedAt: number}>>([]); 
  const [showSubagentPanel, setShowSubagentPanel] = useState(false); 
  const [subagentCount, setSubagentCount] = useState(0);
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [agentActivities, setAgentActivities] = useState<AgentActivityEntry[]>([]);
  const [activityActiveTab, setActivityActiveTab] = useState<string | undefined>(undefined);
  const [scanCardState, setScanCardState] = useState<Omit<ScanProgressCardProps, 'onViewActivity'> | null>(null);
  const [scanStartedAt, setScanStartedAt] = useState<number | undefined>(undefined); 
  const [inlineSubagents, setInlineSubagents] = useState<SubagentSession[]>([]);
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [memoryPanelData, setMemoryPanelData] = useState<{ insights?: MemoryInsights; source?: string }>({});
  const [browserPopupOpen, setBrowserPopupOpen] = useState(false);
  const [browserMode, setBrowserMode] = useState<"watching" | "control" | "paused">("watching");
  const [browserCurrentUrl, setBrowserCurrentUrl] = useState<string | undefined>(undefined);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [linkedConversations, setLinkedConversations] = useState<Array<{id: string; title: string; link_type: string; link_id: string}>>([]);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const prevSubagentCountRef = { current: 0 };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('dopl-model-level') || 'sonnet';
    return 'sonnet';
  });
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastFailedMessage = useRef<string | null>(null);
  const handleSendRef = useRef<(messageOverride?: string) => Promise<void>>(async () => {});
  const userIdRef = useRef<string | null>(null);

  // Fetch and cache the current user's ID on mount
  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) userIdRef.current = user.id;
    }).catch(() => {});
  }, []);

  // Update document title when active conversation changes
  useEffect(() => {
    const title = conversations.find(c => c.id === activeConvo)?.title;
    document.title = title ? `${title} — Dopl` : 'Chat — Dopl';
  }, [activeConvo, conversations]);

  // Handle browser back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/chat\/([^/]+)$/);
      if (match) {
        const convoId = match[1];
        setActiveConvo(convoId);
        setConversationId(convoId);
        setMessages([]);
        setIsLoading(true);
        fetch(`/api/conversations/${convoId}/messages`)
          .then(res => res.ok ? res.json() : { messages: [] })
          .then(data => {
            const loaded = (data.messages || []).map((m: { id?: string; role: string; content: string; timestamp?: string; created_at?: string }) => ({
              id: m.id || crypto.randomUUID(),
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: m.timestamp || (m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""),
              toolCalls: [],
            }));
            setMessages(loaded);
          })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      } else if (path === '/chat') {
        // Back to landing view
        setActiveConvo('');
        setConversationId(null);
        setMessages([]);
        setError(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const { 
    gateway, 
    loading: gatewayLoading, 
    status: gatewayStatus, 
    isConnected,
    latencyMs,
    reconnectAttempt,
    reconnectCountdown,
    isReconnecting,
    isCanceled: gatewayIsCanceled,
    error: gatewayError,
    forceReconnect,
    cancelReconnect,
  } = useGateway();

  // ── WebSocket chat state ────────────────────────────────────────────────
  // Refs to the currently-streaming message so the WS event handler can
  // update it without stale closures.
  const wsStreamingMsgIdRef = useRef<string | null>(null);
  const wsFullTextRef = useRef<string>("");
  const wsConvoIdRef = useRef<string | null>(null);
  const wsSessionKeyRef = useRef<string | null>(null);

  const handleWSEvent = useCallback((event: WSChatEvent) => {
    if (event.type === "token" && event.delta) {
      const msgId = wsStreamingMsgIdRef.current;
      if (!msgId) return;
      setIsLoading(false);
      wsFullTextRef.current += event.delta;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, content: (m.content || "") + event.delta! } : m
        )
      );
    } else if (event.type === "lifecycle_start") {
      setIsLoading(false);
    } else if (event.type === "done") {
      const msgId = wsStreamingMsgIdRef.current;
      if (!msgId) return;
      const fullText = event.fullText ?? wsFullTextRef.current;
      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, content: fullText, isStreaming: false } : m
        )
      );
      setIsLoading(false);
      setRetryCount(0);
      lastFailedMessage.current = null;
      wsStreamingMsgIdRef.current = null;
      wsFullTextRef.current = "";

      // Persist assistant message + task cards to Supabase
      const convoId = wsConvoIdRef.current;
      if (convoId && fullText) {
        const supabase = createSupabaseClient();
        supabase.from("messages").insert({
          conversation_id: convoId,
          role: "assistant",
          content: fullText,
        }).then(() => {}, (e) => console.error("[WS] Failed to save assistant msg:", e));

        supabase.from("conversations").update({ updated_at: new Date().toISOString() })
          .eq("id", convoId).then(() => {}, () => {});

        // Process [[task:...]] tags in the accumulated text
        const taskTagRegex = /\[\[task:([^:]+):([^:\]]+)(?::([^\]]+))?\]\]/g;
        let match;
        while ((match = taskTagRegex.exec(fullText)) !== null) {
          const taskName = match[1];
          const taskStatus = match[2];
          const taskDetails = match[3] ?? null;
          if (taskStatus === "running") {
            supabase.from("agent_tasks").insert({
              user_id: userIdRef.current ?? "",
              conversation_id: convoId,
              name: taskName,
              label: taskName,
              status: "running",
              started_at: new Date().toISOString(),
            }).then(() => {}, () => {});
          } else if (taskStatus === "complete" || taskStatus === "completed") {
            supabase.from("agent_tasks").update({
              status: "completed",
              result: taskDetails,
              completed_at: new Date().toISOString(),
            })
              .eq("name", taskName)
              .in("status", ["running", "pending"])
              .then(() => {}, () => {});
          } else if (taskStatus === "failed") {
            supabase.from("agent_tasks").update({
              status: "failed",
              error: taskDetails,
              completed_at: new Date().toISOString(),
            })
              .eq("name", taskName)
              .in("status", ["running", "pending"])
              .then(() => {}, () => {});
          }
        }
      }

      // Refresh conversation list title
      if (convoId) refreshConversations(convoId);
    } else if (event.type === "error" && !event.message?.includes("falling back")) {
      // Don't show "falling back" as a visible error — it's handled below
      const msgId = wsStreamingMsgIdRef.current;
      if (msgId) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        wsStreamingMsgIdRef.current = null;
        wsFullTextRef.current = "";
      }
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    connected: wsConnected,
    connecting: wsConnecting,
    sendMessage: wsSendMessage,
    abortChat: wsAbortChat,
    reconnect: wsReconnect,
  } = useGatewayWS({
    onEvent: handleWSEvent,
    enabled: !!gateway, // only open WS when gateway is configured
  });

  const { systemPrompt, refreshPrompt: refreshSystemPrompt } = useSystemPrompt();

  // ── Intro kickstart: auto-send a hidden system prompt on first load ──────
  const introSentRef = useRef(false);
  useEffect(() => {
    if (introSentRef.current) return;
    if (!wsConnected) return;
    if (messages.length > 0) return;

    // Check if ?intro=1 is in the URL
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('intro') !== '1') return;

    introSentRef.current = true;

    // Remove intro param from URL immediately
    const cleanUrl = conversationId ? `/chat?c=${conversationId}` : '/chat';
    window.history.replaceState({}, '', cleanUrl);

    // Create a streaming placeholder so the user sees the typing indicator
    const streamingMsgId = "msg_intro_" + Date.now() + "_assistant";
    const placeholderMsg: StreamingMessage = {
      id: streamingMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isStreaming: true,
      toolCalls: [],
    };
    setMessages([placeholderMsg]);
    setIsLoading(true);

    // Point WS refs at this placeholder
    wsStreamingMsgIdRef.current = streamingMsgId;
    wsFullTextRef.current = "";
    wsConvoIdRef.current = conversationId;

    const sessionKey = `webchat-${conversationId || Date.now()}`;
    wsSessionKeyRef.current = sessionKey;

    const kickstartMessage =
      "[SYSTEM: The user just completed signup and is seeing you for the first time. This is your very first conversation together. Introduce yourself — you're a brand new AI companion, fresh out of the box, no memories, no name. Be warm, curious, and excited to meet them. Ask what they'd like to call you and what you should call them.]";

    // Send via WebSocket only — do NOT save to Supabase (ephemeral kickstart)
    wsSendMessage(kickstartMessage, { sessionKey, model: selectedModel, systemPrompt });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, messages.length, conversationId]);

  const {
    isOnline: nodeIsOnline,
    nodeName,
    wasOnline: nodeWasOnline,
    bannerDismissed: nodeBannerDismissed,
    dismissBanner: dismissNodeBanner,
    loading: nodeLoading,
  } = useNodeStatus(30000);
  
  // Use server-provided initial state to avoid hydration mismatch
  const showBanner = !gatewayLoading && !isConnected && !initialHasGateway && !isReconnecting;
  const toast = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll detection for scroll-to-bottom button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 200);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle integration connect via OAuth popup
  const handleIntegrationConnect = useCallback(async (provider: string): Promise<boolean> => {
    // Browser-login integrations: just open the site in user's browser
    const integration = getIntegration(provider);
    if (integration?.authType === 'browser-login') {
      const urls: Record<string, string> = {
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com',
        facebook: 'https://facebook.com',
        whatsapp: 'https://web.whatsapp.com',
        youtube: 'https://youtube.com',
        twitter: 'https://twitter.com',
        reddit: 'https://reddit.com',
      };
      const url = urls[provider] || `https://${provider}.com`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    }

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `/api/integrations/oauth/start?provider=${provider}`,
      `Connect ${provider}`,
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) return false;

    return new Promise<boolean>((resolve) => {
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/integrations/status/${provider}`);
          if (res.ok) {
            const data = await res.json();
            if (data.connected) {
              clearInterval(pollInterval);
              popup.close();
              resolve(true);
              // Refresh system prompt so the next WS message includes updated integration context
              refreshSystemPrompt();
              // Auto-send continuation message so agent continues the task
              setTimeout(() => {
                const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                handleSendRef.current(`${providerName} connected ✓`);
              }, 500);
              return;
            }
          }
        } catch { /* ignore */ }

        if (popup.closed) {
          clearInterval(pollInterval);
          resolve(false);
        }
      }, 1500);

      setTimeout(() => { clearInterval(pollInterval); resolve(false); }, 5 * 60 * 1000);
    });
  }, []);

  const handleWorkflowSelect = useCallback((workflowTitle: string) => {
    // Send workflow selection as message
    handleSendRef.current(workflowTitle);
  }, []);

  const handleWorkflowCustom = useCallback(() => {
    // Focus input for custom workflow
    const inputEl = document.querySelector('input[placeholder*="Message"]') as HTMLInputElement;
    if (inputEl) {
      inputEl.focus();
      inputEl.placeholder = "Describe what you'd like to automate...";
    }
  }, []);

  const handleOpenMemory = useCallback((insights: MemoryInsights, source: string) => {
    setMemoryPanelData({ insights, source });
    setMemoryPanelOpen(true);
  }, []);

  // Integration polling: detect when user connects integration in another tab
  useEffect(() => {
    let prevConnected: Set<string> = new Set();
    let initialized = false;

    const checkIntegrations = async () => {
      try {
        const res = await fetch("/api/integrations/status");
        if (!res.ok) return;
        const data = await res.json();
        const connected: string[] = data.connected || [];
        const connectedSet = new Set(connected);
        
        if (!initialized) {
          prevConnected = connectedSet;
          initialized = true;
          return;
        }
        
        // Find newly connected integrations
        for (const provider of Array.from(connectedSet)) {
          if (!prevConnected.has(provider)) {
            const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
            // Inject system message and auto-send to agent
            const systemNote = `${providerName} connected ✓`;
            handleSendRef.current(systemNote);
          }
        }
        prevConnected = connectedSet;
      } catch {
        // ignore polling errors
      }
    };
    
    const interval = setInterval(checkIntegrations, 7000);
    checkIntegrations(); // init baseline
    return () => clearInterval(interval);
  }, []);

  // Inline subagent tracking — Supabase Realtime + fallback polling
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseClient();

    // Fetch full task list from API (used for initial load + fallback)
    const fetchTasks = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/gateway/subagents");
        if (!res.ok) return;
        const data = await res.json();
        const sessions: SubagentSession[] = data.subagents || [];
        if (!cancelled) {
          setInlineSubagents(sessions);
          const running = sessions.filter((s) => !s.status || s.status === "running").length;
          setSubagentCount(running);
        }
      } catch { /* ignore */ }
    };

    // Initial fetch
    fetchTasks();

    // Subscribe to Realtime changes on agent_tasks table
    const channel = supabase
      .channel('agent-tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
        },
        () => {
          // On any change (INSERT, UPDATE, DELETE), refetch the full list
          // This is simpler and more reliable than trying to merge individual changes
          fetchTasks();
        }
      )
      .subscribe();

    // Fallback poll every 30s in case Realtime misses something
    const fallbackInterval = setInterval(fetchTasks, 30000);

    return () => {
      cancelled = true;
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStopSubagent = async (sessionId: string) => {
    await fetch(`/api/gateway/subagents?id=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    setInlineSubagents((prev) =>
      prev.map((s) => s.id === sessionId ? { ...s, status: "killed" as const } : s)
    );
  };

  const handleSend = async (messageOverride?: string) => {
    const baseMessage = messageOverride || input.trim();
    if (!baseMessage && attachedFiles.length === 0) return;
    if (isLoading) return;

    // Upload pending files first
    let uploadedFiles = attachedFiles;
    if (attachedFiles.some(f => f.status === "pending")) {
      setAttachedFiles(prev => prev.map(f => f.status === "pending" ? { ...f, status: "uploading" as const, uploadProgress: 0 } : f));
      uploadedFiles = await uploadFiles(
        attachedFiles,
        conversationId || undefined,
        (id, progress) => setAttachedFiles(prev => prev.map(f => f.id === id ? { ...f, uploadProgress: progress } : f))
      );
      setAttachedFiles(uploadedFiles);
    }

    // Build message with file references
    const filePrefix = uploadedFiles.length > 0
      ? `[Attached files: ${uploadedFiles.map(f => `${f.name} (${(f.size / (1024*1024)).toFixed(1)} MB, ${f.type})`).join(", ")}]
User message: `
      : "";
    const messageToSend = filePrefix + (baseMessage || "(see attached files)");

    const userMessage: StreamingMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      content: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    if (!messageOverride) {
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setAttachedFiles([]);
    }

    setIsLoading(true);
    setError(null);
    lastFailedMessage.current = messageToSend;

    // Create streaming placeholder
    const streamingMsgId = "msg_" + Date.now() + "_assistant";
    const placeholderMsg: StreamingMessage = {
      id: streamingMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isStreaming: true,
      toolCalls: [],
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    // ── WebSocket path (preferred): direct persistent connection ───────────
    if (wsConnected) {
      const sessionKey = `webchat-${conversationId || Date.now()}`;
      wsStreamingMsgIdRef.current = streamingMsgId;
      wsFullTextRef.current = "";
      wsConvoIdRef.current = conversationId;
      wsSessionKeyRef.current = sessionKey;

      // Ensure conversation exists in Supabase before sending
      let activeConvoId = conversationId;
      if (!activeConvoId) {
        try {
          const res = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: messageToSend.length > 50 ? messageToSend.substring(0, 47) + "..." : messageToSend }),
          });
          if (res.ok) {
            const data = await res.json();
            activeConvoId = data.conversation?.id ?? null;
            if (activeConvoId) {
              setConversationId(activeConvoId);
              wsConvoIdRef.current = activeConvoId;
              setConversations((prev) => prev.filter((c) => !c.id.startsWith("temp-")));
              refreshConversations(activeConvoId);
              // Sync URL to new conversation
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', `/chat/${activeConvoId}`);
              }
            }
          }
        } catch { /* ignore — WS send will still work, just no Supabase persistence */ }
      } else {
        // Save user message immediately
        const supabase = createSupabaseClient();
        supabase.from("messages").insert({
          conversation_id: activeConvoId,
          role: "user",
          content: messageToSend,
        }).then(() => {}, (e) => console.error("[WS] Failed to save user msg:", e));
      }

      wsSendMessage(messageToSend, { sessionKey, model: selectedModel, systemPrompt });
      return; // WS handler drives the rest; setIsLoading(false) called on done/error
    }

    // ── HTTP/SSE fallback ──────────────────────────────────────────────────
    try {
      const response = await fetch("/api/gateway/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, conversation_id: conversationId }),
      });

      if (!response.ok || !response.body) {
        // Fall back to non-streaming route
        setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
        await fallbackSend(messageToSend);
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        // Non-streaming response, fall back
        setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
        await fallbackSend(messageToSend);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const updateMsg = (updater: (msg: StreamingMessage) => StreamingMessage) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === streamingMsgId ? updater(m as StreamingMessage) : m))
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice("data: ".length).trim();
          if (!jsonStr) continue;

          let chunk: { type: string; text?: string; tool?: string; input?: Record<string, unknown>; result?: string; conversation_id?: string; message?: string; data?: Record<string, unknown> };
          try { chunk = JSON.parse(jsonStr); } catch { continue; }

          if (chunk.type === "token" && chunk.text) {
            setIsLoading(false);
            updateMsg((m) => ({ ...m, content: m.content + chunk.text! }));
          } else if (chunk.type === "thinking" && chunk.text) {
            // Optionally show thinking
          } else if (chunk.type === "tool_start" && chunk.tool) {
            setIsLoading(false);
            const label = getToolLabel(chunk.tool, chunk.input);
            const toolCall: ToolCallInfo = { tool: chunk.tool, status: "running", label, startTime: Date.now(), input: chunk.input };
            updateMsg((m) => ({ ...m, toolCalls: [...(m.toolCalls || []), toolCall] }));
            const taskId = `${chunk.tool}-${Date.now()}`;
            const taskLabel = getAgentTaskLabel(chunk.tool, chunk.input || {});
            setActiveAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, startedAt: Date.now() }]);
          } else if (chunk.type === "tool_end" && chunk.tool) {
            setActiveAgentTasks(prev => prev.slice(1));
            updateMsg((m) => ({
              ...m,
              toolCalls: (m.toolCalls || []).map((tc) =>
                tc.tool === chunk.tool && tc.status === "running"
                  ? { ...tc, status: "done" as const, result: chunk.result ? JSON.stringify(chunk.result).slice(0, 500) : undefined, duration: tc.startTime ? Date.now() - tc.startTime : undefined }
                  : tc
              ),
            }));
            // Mark activity as done when scan tool ends
            if (chunk.tool === 'scan_integration') {
              setAgentActivities(prev => prev.map(a =>
                a.status === 'running' ? { ...a, status: 'done' as const, completedAt: Date.now() } : a
              ));
              setScanCardState(prev => {
                if (!prev) return null;
                const completedState = {
                  ...prev,
                  status: 'complete' as const,
                  progress: 100,
                  durationSeconds: scanStartedAt ? Math.round((Date.now() - scanStartedAt) / 1000) : undefined,
                };
                // Persist scan result as a tag so it survives reload
                const scanResultTag = '[[scan-result:' + JSON.stringify({
                  scanId: prev.scanId,
                  totalMemories: prev.totalMemories || 0,
                  durationSeconds: completedState.durationSeconds || 0,
                  providers: (prev.providers || []).map(p => ({ name: p.name, memories: p.memories || 0, error: p.error })),
                  workflowSuggestions: prev.workflowSuggestions,
                }) + ']]';
                // Append to current streaming message
                updateMsg((m) => ({
                  ...m,
                  content: (m.content || '') + '\n\n' + scanResultTag,
                }));
                return completedState;
              });
            }
          } else if (chunk.type === "tool_progress" && chunk.tool && chunk.data) {
            const data = chunk.data as { phase?: string; pass?: string; message?: string; progress?: number; provider?: string; providers?: Array<{name: string; status: string; memories?: number; error?: string}> };
            const phase = data.phase || 'scan';
            const passName = data.pass || phase;
            const logLine = data.message || '';
            // Auto-open panel when scan starts
            if (phase === 'fetching' && logLine) {
              if (!scanStartedAt) setScanStartedAt(Date.now());
            }
            // Update inline scan card state
            setScanCardState(prev => {
              const providers = data.providers || (data.provider ? [{ name: data.provider, status: phase }] : prev?.providers || [{ name: 'Workspace', status: phase }]);
              const scanId = prev?.scanId || `scan-${Date.now()}`;
              return {
                scanId,
                status: 'running' as const,
                providers,
                progress: data.progress ?? prev?.progress ?? 0,
                currentPhase: phase,
                currentMessage: logLine || prev?.currentMessage || '',
                totalMemories: prev?.totalMemories,
                durationSeconds: prev?.durationSeconds,
                workflowSuggestions: prev?.workflowSuggestions,
              };
            });
            setAgentActivities(prev => {
              // Find or create activity for this phase/pass
              const existingId = passName === 'fetching' || passName === 'correlating' || passName === 'storing'
                ? `scan-${passName}`
                : passName === 'analyzing' && data.pass
                  ? `scan-pass-${data.pass}`
                  : `scan-${passName}`;
              const existing = prev.find(a => a.id === existingId);
              if (existing) {
                return prev.map(a => a.id === existingId
                  ? { ...a, status: 'running' as const, logs: [...a.logs, logLine] }
                  : a
                );
              }
              const displayName = passName === 'fetching' ? 'Fetching'
                : passName === 'correlating' ? 'Correlating'
                : passName === 'storing' ? 'Storing'
                : data.pass || passName;
              const newEntry: AgentActivityEntry = {
                id: existingId,
                name: displayName,
                status: 'running',
                logs: logLine ? [logLine] : [],
                startedAt: Date.now(),
              };
              const updated = [...prev, newEntry];
              if (!activityActiveTab) setActivityActiveTab(existingId);
              return updated;
            });
          } else if (chunk.type === "done") {
            if (chunk.conversation_id) {
              const isNew = !conversations.find((c) => c.id === chunk.conversation_id);
              setConversationId(chunk.conversation_id);
              // Replace any temp entry (from handleNewConversation) with real convo
              setConversations(prev => prev.filter(c => !c.id.startsWith('temp-')));
              // Sync URL to conversation
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', `/chat/${chunk.conversation_id}`);
              }
              if (isNew) {
                await refreshConversations(chunk.conversation_id);
              } else {
                // Update preview: refresh list to get updated title/preview
                refreshConversations(chunk.conversation_id);
              }
            }
            updateMsg((m) => ({ ...m, isStreaming: false }));
            setActiveAgentTasks([]);
            setRetryCount(0);
            lastFailedMessage.current = null;
          } else if (chunk.type === "error") {
            // Remove placeholder and fall back
            setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
            await fallbackSend(messageToSend);
            return;
          }
        }
      }

      // Ensure streaming is marked done
      updateMsg((m) => ({ ...m, isStreaming: false }));
    } catch (err) {
      console.error("Streaming chat error:", err);
      setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
      if (retryCount < 2) {
        toast.error("Network error", `Retrying... (${retryCount + 1}/3)`);
        setRetryCount((prev) => prev + 1);
        setTimeout(() => handleSend(messageToSend), 1500 * (retryCount + 1));
        return;
      }
      toast.error("Connection failed", "Check your internet connection");
      setRetryCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const fallbackSend = async (messageToSend: string) => {
    try {
      const response = await fetch("/api/gateway/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend, conversation_id: conversationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        const gatewayError: GatewayError = data.error || {
          code: "UNKNOWN_ERROR",
          message: "Something went wrong. Please try again.",
        };
        setError(gatewayError);
        const isRetryable = ["GATEWAY_OFFLINE", "GATEWAY_ERROR"].includes(gatewayError.code);
        if (isRetryable && retryCount < 2) {
          toast.error("Connection issue", `Retrying... (${retryCount + 1}/3)`);
          setRetryCount((prev) => prev + 1);
          setTimeout(() => handleSend(messageToSend), 1000 * (retryCount + 1));
          return;
        }
        toast.error("Gateway error", gatewayError.message);
        setRetryCount(0);
        return;
      }

      const assistantMessage: StreamingMessage = {
        id: "msg_" + Date.now() + "_assistant",
        role: "assistant",
        content: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setRetryCount(0);
      lastFailedMessage.current = null;
      if (data.conversation_id) {
        const isNew = !conversations.find((c) => c.id === data.conversation_id);
        setConversationId(data.conversation_id);
        // Sync URL to conversation
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', `/chat/${data.conversation_id}`);
        }
        if (isNew) {
          await refreshConversations(data.conversation_id);
        }
      }
    } catch (err) {
      console.error("Fallback chat error:", err);
      const gatewayError: GatewayError = {
        code: "GATEWAY_OFFLINE",
        message: "Failed to connect. Check your internet connection.",
      };
      setError(gatewayError);
      if (retryCount < 2) {
        toast.error("Network error", `Retrying... (${retryCount + 1}/3)`);
        setRetryCount((prev) => prev + 1);
        setTimeout(() => handleSend(messageToSend), 1500 * (retryCount + 1));
        return;
      }
      toast.error("Connection failed", "Check your internet connection");
      setRetryCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryLastMessage = () => {
    if (lastFailedMessage.current) {
      setRetryCount(0);
      handleSend(lastFailedMessage.current);
    }
  };


  const handleNewConversation = () => {
    // Navigate to the landing view — user will type their first message there
    setActiveConvo('');
    setConversationId(null);
    setMessages([]);
    setError(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/chat');
    }
  };

  const handleLandingSend = async (message: string) => {
    // Create the conversation in DB, then transition to the full chat view
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: message.length > 50 ? message.substring(0, 47) + '...' : message }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data.conversation?.id;
        if (newId) {
          setConversations(prev => {
            const exists = prev.find(c => c.id === newId);
            if (exists) return prev;
            return [{ id: newId, title: message.substring(0, 50), lastMessage: '', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev];
          });
          setActiveConvo(newId);
          setConversationId(newId);
          setMessages([]);
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', `/chat/${newId}`);
          }
          // Slight delay so the chat view mounts before we fire the message
          setTimeout(() => {
            handleSendRef.current(message);
          }, 50);
        }
      }
    } catch (err) {
      console.error('Failed to create conversation from landing:', err);
    }
  };

  // Fetch and update conversation list after a conversation is created/updated
  const refreshConversations = async (newConvId?: string) => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        const convos: Conversation[] = data.conversations || [];
        setConversations(convos);
        if (newConvId) setActiveConvo(newConvId);
      }
    } catch { /* ignore */ }
  };

  const loadLinkedConversations = async (convoId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convoId}/context`);
      if (res.ok) {
        const data = await res.json();
        setLinkedConversations(data.linked_conversations || []);
      }
    } catch { /* ignore */ }
  };

  // Load linked convos when active conversation changes
  useEffect(() => {
    if (conversationId) {
      loadLinkedConversations(conversationId);
    } else {
      setLinkedConversations([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Subscribe to new messages via Supabase Realtime (for subagent push results)
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createSupabaseClient();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newMsg = payload.new as { id: string; role: string; content: string; created_at: string };
          if (newMsg.role === 'assistant') {
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role === 'assistant' && lastMsg?.content === newMsg.content) {
                return prev;
              }
              if (newMsg.content.startsWith('📋')) {
                return [...prev, {
                  id: newMsg.id,
                  role: 'assistant' as const,
                  content: newMsg.content,
                  timestamp: newMsg.created_at || new Date().toISOString(),
                }];
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleLinkConversations = async (selectedIds: string[], linkType: string) => {
    if (!conversationId) return;
    await Promise.all(
      selectedIds.map((targetId) =>
        fetch(`/api/conversations/${conversationId}/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_id: targetId, link_type: linkType }),
        })
      )
    );
    await loadLinkedConversations(conversationId);
  };

  const handleUnlinkConversation = async (targetId: string) => {
    if (!conversationId) return;
    await fetch(`/api/conversations/${conversationId}/context`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId }),
    });
    await loadLinkedConversations(conversationId);
  };

  handleSendRef.current = handleSend;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const dismissError = () => {
    setError(null);
    lastFailedMessage.current = null;
  };

  const loadConversation = async (convoId: string) => {
    if (convoId === activeConvo) return;
    setActiveConvo(convoId);
    setConversationId(convoId);
    // Update URL without page reload
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/chat/${convoId}`);
    }
    setMessages([]);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/conversations/${convoId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const loaded = (data.messages || []).map((m: { id?: string; role: string; content: string; timestamp?: string; created_at?: string }) => ({
          id: m.id || crypto.randomUUID(),
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.timestamp || (m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""),
          toolCalls: [],
        }));
        setMessages(loaded);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  // Show skeleton loading state while checking gateway
  if (gatewayLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        {/* Conversation Sidebar Skeleton */}
        <aside className="w-64 border-r border-white/[0.1] bg-white/[0.03] flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.1] flex items-center justify-between">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-12" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ConversationListSkeleton rows={6} />
          </div>
          
          {/* Gateway Status */}
          <div className="px-4 py-3 border-t border-white/[0.1] bg-white/[0.03]">
            <div className="flex items-center gap-2">
              <Skeleton className="w-2 h-2" rounded />
              <Skeleton className="h-2 w-24" />
            </div>
          </div>
        </aside>

        {/* Chat Area Skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <ChatSkeleton messages={5} />
          </div>

          {/* Input Skeleton */}
          <div className="flex-shrink-0 border-t border-white/[0.1] p-4">
            <div className="flex gap-2">
              <Skeleton className="flex-1 h-10" />
              <Skeleton className="h-10 w-16" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show prompt to connect gateway if not configured
  if (showBanner) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.06] flex items-center justify-center">
            <span className="text-2xl">🔌</span>
          </div>
          <h2 className="font-header text-xl font-bold mb-2">No Gateway Connected</h2>
          <p className="text-sm text-white/60 mb-6">
            Connect your personal gateway instance to start chatting. Your gateway runs locally and keeps your data private.
          </p>
          <Link href="/settings">
            <Button variant="solid">Connect in Settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Landing view: shown when there is no active conversation (bare /chat route)
  const isNewConversationView = !activeConvo;

  if (isNewConversationView && !gatewayLoading && !showBanner) {
    return <NewConversationLanding onSend={handleLandingSend} />;
  }

  return (
    <>
    <ChatBg />
    <div className="flex h-[calc(100vh-64px)] relative z-[1]">
      {/* Conversation Sidebar */}
      <aside className="w-72 border-r border-white/[0.1] bg-white/[0.03] flex flex-col">
        <div className="px-4 py-4 border-b border-white/[0.1] flex items-center justify-between">
          <span className="text-sm font-medium text-white/70">
            Conversations
          </span>
          <Button variant="solid" size="sm" onClick={handleNewConversation}>New</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            conversations.map((convo) => (
              <div
                key={convo.id}
                className={cn(
                  "relative group flex items-center border-b border-white/[0.08] transition-colors",
                  activeConvo === convo.id ? "bg-white/[0.1] border-l-2 border-l-[#9EFFBF]" : "hover:bg-white/[0.04]"
                )}
              >
                <button
                  onClick={() => loadConversation(convo.id)}
                  className="flex-1 text-left px-4 py-3 min-w-0"
                >
                  <span className="text-[15px] font-medium truncate block text-white/90">{convo.title || "New conversation"}</span>
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 flex-shrink-0">
                  <ConversationContextMenu
                    conversationId={convo.id}
                    conversationTitle={convo.title}
                    onLinksChanged={() => conversationId === convo.id && loadLinkedConversations(convo.id)}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-white/50 mb-1">No conversations yet</p>
              <p className="font-mono text-[10px] text-white/40">
                Start chatting below
              </p>
            </div>
          )}
        </div>
        
        {/* Enhanced Gateway Status Panel */}
        <GatewayStatusPanel
          status={gatewayStatus}
          latencyMs={latencyMs}
          reconnectAttempt={reconnectAttempt}
          reconnectCountdown={reconnectCountdown}
          isReconnecting={isReconnecting}
          isCanceled={gatewayIsCanceled}
          error={gatewayError}
          onRetry={forceReconnect}
          onCancel={cancelReconnect}
        />
        {/* WebSocket mode indicator */}
        {gateway && (
          <div className="px-4 py-1.5 border-t border-white/[0.08] flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              wsConnected ? "bg-[#9EFFBF]" : wsConnecting ? "bg-[#F4D35E] animate-pulse" : "bg-grid/20"
            }`} />
            <span className="font-mono text-[8px] uppercase tracking-wide text-white/40">
              {wsConnected ? "WS live" : wsConnecting ? "WS connecting..." : "WS offline"}
            </span>
            {!wsConnected && !wsConnecting && (
              <button
                onClick={wsReconnect}
                className="ml-auto font-mono text-[8px] text-white/40 hover:text-white/80 underline"
              >
                retry
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Chat Area + Activity Panel */}
      <div className="flex-1 flex overflow-hidden">
      {/* Chat Area */}
      <div
        className={cn("flex flex-col relative overflow-hidden transition-all duration-300", activityPanelOpen ? "flex-1" : "flex-1")}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files.length > 0) {
            const toAdd: UploadedFile[] = [];
            Array.from(e.dataTransfer.files).slice(0, 5 - attachedFiles.length).forEach(f => {
              const uf: UploadedFile = {
                id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file: f, name: f.name, size: f.size,
                type: f.type || 'application/octet-stream',
                status: 'pending',
                previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
              };
              toAdd.push(uf);
            });
            if (toAdd.length) setAttachedFiles(prev => [...prev, ...toAdd]);
          }
        }}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/[0.04] border-2 border-dashed border-white/[0.3] pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">📎</div>
              <p className="font-mono text-sm text-white/80 font-medium">Drop files here</p>
            </div>
          </div>
        )}
        {/* Chat header with Tasks button */}
        <div className="flex items-center justify-end px-4 py-1.5 border-b border-white/[0.08] bg-transparent">
          {conversationId && (
            <button
              onClick={() => setLinkPickerOpen(true)}
              className="relative flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-white/50 hover:text-white/80 border border-transparent hover:border-white/[0.1] transition-all rounded-none"
              title="Link conversations"
            >
              <span>🔗</span>
              <span>Link</span>
              {linkedConversations.length > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/[0.12] text-white/80 font-mono text-[9px] ml-0.5">
                  {linkedConversations.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setShowSubagentPanel((v) => !v)}
            className="hidden"
          >
            <span>🔄</span>
            <span>Tasks</span>
            {subagentCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/[0.12] text-white font-mono text-[9px] ml-0.5">
                {subagentCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActivityPanelOpen((v) => !v)}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide border transition-all rounded-none",
              activityPanelOpen
                ? "text-white/80 border-white/[0.2] bg-white/[0.08]"
                : "text-white/50 hover:text-white/80 border-transparent hover:border-white/[0.1]"
            )}
            title="Toggle agent activity panel"
            style={{ display: 'none' }}
          >
            <span>📊</span>
            <span>Activity</span>
            {agentActivities.filter(a => a.status === 'running').length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/[0.12] text-white font-mono text-[9px] ml-0.5">
                {agentActivities.filter(a => a.status === 'running').length}
              </span>
            )}
          </button>
        </div>

        {/* Reconnection Banner */}
        <ReconnectionBanner
          isReconnecting={isReconnecting}
          isCanceled={gatewayIsCanceled}
          gatewayStatus={gatewayStatus}
          reconnectAttempt={reconnectAttempt}
          reconnectCountdown={reconnectCountdown}
          onRetry={forceReconnect}
          onCancel={cancelReconnect}
        />

        {/* Linked Context Badge */}
        {linkedConversations.length > 0 && conversationId && (
          <LinkedContextBadge
            linkedConversations={linkedConversations}
            conversationId={conversationId}
            onEdit={() => setLinkPickerOpen(true)}
            onUnlink={handleUnlinkConversation}
          />
        )}

        {/* Node Disconnect Banner */}
        {nodeWasOnline && !nodeIsOnline && !nodeBannerDismissed && !nodeLoading && (
          <div className="bg-[#F4D35E]/10 border-b border-[#F4D35E]/30 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#F4D35E]" />
              <span className="text-sm text-[#B8860B]">
                💻 Your computer disconnected. Browser features are paused.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/settings/nodes"
                className="text-xs font-mono uppercase tracking-wide text-[#B8860B] hover:text-[#8B6914] underline"
              >
                Reconnect
              </a>
              <button
                onClick={dismissNodeBanner}
                className="text-[#B8860B]/60 hover:text-[#B8860B] text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 relative">
          {messages.length > 0 ? (
            messages.map((msg) => {
              const segments = parseMessageContent(msg.content);
              const hasRichContent = segments.some((s) => s.type !== "text");
              const toolCalls = (msg as StreamingMessage).toolCalls || [];
              const totalDuration = toolCalls.reduce((sum, tc) => sum + (tc.duration || 0), 0);
              const thinkingText = toolCalls.length === 1 ? toolCalls[0].label : undefined;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%]",
                    msg.role === "user" ? "ml-auto" : "mr-auto group"
                  )}
                >
                  <div
                    className={cn(
                      msg.role === "user"
                        ? "text-base leading-[24px] text-white/90 bg-white/[0.08] border border-white/[0.1] rounded py-2 px-4"
                        : "text-white/[0.88] p-0 border-0 bg-transparent"
                    )}
                  >
                    {/* Tool calls — ThinkingBlock */}
                    {msg.role === "assistant" && toolCalls.length > 0 && (
                      toolCalls.length === 1 ? (
                        <ThinkingBlock duration={totalDuration / 1000} thinkingText={thinkingText} />
                      ) : (
                        <ThinkingBlock duration={totalDuration / 1000}>
                          <ToolTimeline steps={toolCalls.map((tc, i) => ({
                            id: `${tc.tool}-${i}`,
                            label: tc.label,
                            tool: tc.tool,
                            duration: tc.duration ? tc.duration / 1000 : undefined,
                            input: tc.input,
                            result: tc.result,
                            status: tc.status,
                          }))} />
                        </ThinkingBlock>
                      )
                    )}
                    {hasRichContent && msg.role === "assistant" ? (
                      <RichMessage
                        segments={segments}
                        onIntegrationConnect={handleIntegrationConnect}
                        onWorkflowSelect={handleWorkflowSelect}
                        onWorkflowCustom={handleWorkflowCustom}
                        onScanComplete={(summary) => handleSendRef.current(`[System] Scan complete: ${summary}`)}
                        onOpenMemory={handleOpenMemory}
                        gatewayHost={gatewayHost}
                        onOpenBrowser={async (url, control) => {
                          setBrowserCurrentUrl(url);
                          setBrowserMode(control ? "control" : "watching");
                          setBrowserPopupOpen(true);
                        }}
                        onSendEmail={async (email) => {
                          try {
                            const res = await fetch('/api/email/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(email),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Send failed');
                            toast.success('✅ Email sent!', `Message ID: ${data.messageId || 'sent'}`);
                          } catch (err) {
                            toast.error('Failed to send email', String(err));
                            throw err;
                          }
                        }}
                        onSaveDraftEmail={async (email) => {
                          try {
                            const res = await fetch('/api/email/draft', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(email),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Save failed');
                            toast.success('💾 Draft saved!');
                          } catch (err) {
                            toast.error('Failed to save draft', String(err));
                          }
                        }}
                        onViewActivity={() => setActivityPanelOpen(true)}
                      />
                    ) : msg.role === "user" ? (
                      <UserMessageContent content={msg.content} />
                    ) : (
                      <div className="relative">
                        <div className="prose prose-base max-w-none prose-p:my-0 prose-p:mb-3 prose-p:leading-[26px] prose-headings:font-semibold prose-headings:text-white/90 prose-strong:text-white/90 prose-strong:font-semibold prose-code:text-sm prose-code:bg-white/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/[0.06] prose-pre:rounded-lg prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 text-white/[0.88]">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {msg.content.length >= 20 && (
                          <div className="flex justify-end mt-1">
                            <VoiceOutputButton text={msg.content} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex justify-end mt-0.5">
                      <span className="text-xs text-white/50">{msg.timestamp}</span>
                    </div>
                  )}
                  {msg.role === "assistant" && (
                    <MessageFeedback messageContent={msg.content} />
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border border-white/[0.1] rounded-xl bg-white/[0.04] flex items-center justify-center">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="font-header text-lg font-bold mb-2">
                  Start a conversation
                </h3>
                <p className="text-sm text-white/50 max-w-sm">
                  Ask your assistant anything — summarize emails, draft responses, research topics, or get help with tasks.
                </p>
              </div>
            </div>
          )}
          
          {/* Inline error message as chat bubble */}
          {error && !isLoading && (
            <ChatError
              code={error.code}
              message={error.message}
              timestamp={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              onRetry={lastFailedMessage.current ? handleRetryLastMessage : undefined}
              onDismiss={dismissError}
            />
          )}

          {/* Inline Scan Progress Card — removed; deep scan UI no longer shown */}

          {/* Loading indicator */}
          {isLoading && (
            <div className="max-w-[70%] mr-auto px-1">
              <span className="font-mono text-[11px] text-white/40 italic animate-pulse">
                {retryCount > 0 ? `Retrying (${retryCount}/3)...` : "Thinking..."}
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />

          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-24 right-6 w-8 h-8 flex items-center justify-center border border-white/[0.1] bg-white/[0.06] text-white/50 hover:text-white/90 hover:border-white/[0.3] transition-colors z-10"
              title="Scroll to bottom"
            >
              ↓
            </button>
          )}
        </div>

        {/* ActiveAgentsPanel hidden — replaced by inline cards above */}

        {/* Inline subagent task cards - max-h to prevent pushing input area up */}
        {inlineSubagents.filter((s) => s.status === "running" || !s.status || s.status === "done" || s.status === "failed" || s.status === "killed").length > 0 && (
          <div className="max-h-48 overflow-y-auto flex-shrink-0">
            {inlineSubagents.filter((s) => s.status === "running" || !s.status || s.status === "done" || s.status === "failed" || s.status === "killed").slice(0, 5).map((s) => {
              const cardStatus: "running" | "complete" | "failed" =
                !s.status || s.status === "running" ? "running" :
                s.status === "done" ? "complete" : "failed";
              return (
                <div key={s.id} className="px-4">
                  <InlineTaskCard
                    taskId={s.id}
                    taskName={s.label || s.task || "Background Task"}
                    status={cardStatus}
                    model={s.model || undefined}
                    result={cardStatus === "complete" ? (s.output || undefined) : undefined}
                    error={cardStatus === "failed" ? (s.output || "Task failed") : undefined}
                    onStop={cardStatus === "running" ? () => handleStopSubagent(s.id) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Subagent Dashboard Panel */}
        {/* SubagentPanel removed — replaced by inline subagent cards */}

        {/* Token Usage Indicator */}
        <TokenUsageBar />

        {/* Input */}
        <div className="flex-shrink-0 border-t border-white/[0.1] p-4">
          <FilePreview
            files={attachedFiles}
            onRemove={(id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))}
          />
          <div
            className="border border-white/[0.25]"
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(40px) saturate(150%)",
              WebkitBackdropFilter: "blur(40px) saturate(150%)",
              borderRadius: 0,
            }}
          >
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={gateway ? "Message your assistant..." : "Connect gateway to chat..."}
              disabled={!gateway || isLoading || isReconnecting}
              rows={1}
              className="w-full bg-transparent px-4 py-3 text-sm text-white/90 outline-none resize-none placeholder:text-white/30 disabled:opacity-50 min-h-[40px] max-h-[200px]"
            />
            <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/[0.06]">
              <InputToolbar
                onFileUpload={() => document.getElementById('dopl-file-input')?.click()}
                disabled={!gateway || isLoading}
              />
              <div className="flex items-center gap-1">
                <ModelSelector value={selectedModel} onChange={setSelectedModel} />
                <VoiceInputButton onTranscript={(text) => setInput(text)} disabled={!gateway || isLoading} />
                <div
                  title={
                    !gateway
                      ? "Connect a gateway in Settings to send messages"
                      : gatewayStatus === "disconnected" || gatewayStatus === "error"
                      ? "Gateway is offline — reconnecting..."
                      : isReconnecting
                      ? "Reconnecting to gateway..."
                      : undefined
                  }
                >
                  <Button
                    variant="solid"
                    onClick={() => handleSend()}
                    disabled={!gateway || (!input.trim() && attachedFiles.length === 0) || isLoading || isReconnecting}
                  >
                    {isLoading ? "..." : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Picker Modal for linking */}
        {conversationId && (
          <ConversationPickerModal
            isOpen={linkPickerOpen}
            onClose={() => setLinkPickerOpen(false)}
            currentConversationId={conversationId}
            onLink={handleLinkConversations}
            alreadyLinkedIds={linkedConversations.map((l) => l.id)}
          />
        )}

        {/* Memory Panel */}
        <MemoryPanel
          isOpen={memoryPanelOpen}
          onClose={() => setMemoryPanelOpen(false)}
          source={memoryPanelData.source}
          insights={memoryPanelData.insights}
        />

        {/* Browser Popup — removed (noVNC/headless); browser automation now via Companion node pairing */}
      </div>

      {/* Agent Activity Split Panel */}
      {activityPanelOpen && (
        <div className="w-[38%] flex-shrink-0 border-l border-white/[0.1] overflow-hidden">
          <AgentActivityPanel
            isOpen={activityPanelOpen}
            onClose={() => setActivityPanelOpen(false)}
            activities={agentActivities}
            activeTabId={activityActiveTab}
            onTabChange={setActivityActiveTab}
            overallProgress={scanCardState?.progress}
            totalMemories={scanCardState?.totalMemories}
            scanStartedAt={scanStartedAt}
          />
        </div>
      )}
      </div>
    </div>
    </>
  );
}
