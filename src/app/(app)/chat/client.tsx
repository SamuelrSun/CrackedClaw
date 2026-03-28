"use client";

import ReactMarkdown from "react-markdown";
import { MarkdownMessage } from "@/components/chat/markdown-message";
import { useState, useRef, useEffect, useCallback, Component } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Conversation, Message } from "@/lib/mock-data";
import { useGateway } from "@/hooks/use-gateway";
import { useToast } from "@/hooks/use-toast";
import type { GatewayError } from "@/types/gateway";
import Link from "next/link";
import { GlassNavbar } from "@/components/layout/glass-navbar";

import { parseMessageContent, type ParsedSegment } from "@/lib/chat/message-parser";
import { generateConversationTitle } from "@/lib/utils/title-generator";
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
import { SubagentInlineCard } from "@/components/chat/subagent-inline-card";
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
import { BrowserRelayCard } from "@/components/chat/browser-relay-card";
import { CompanionDownloadCard } from "@/components/chat/companion-download-card";
import { ContactMethodsPopup } from "@/components/chat/contact-methods-popup";
import type { EmailDraft } from "@/lib/email/gmail-client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { useGatewayWS, type WSChatEvent } from "@/hooks/use-gateway-ws";
import { ThinkingBlock } from "@/components/chat/thinking-block";
import { NarrationBlock } from "@/components/chat/narration-block";
import { NarrationLine } from "@/components/chat/narration-line";
import { ToolTimeline } from "@/components/chat/tool-timeline";
import { ModelSelector } from "@/components/chat/model-selector";
import { InputToolbar } from "@/components/chat/input-toolbar";
import { ConnectionsPopup } from "@/components/chat/connections-popup";
import { ComputerPopup } from "@/components/chat/computer-popup";
import { MessageFeedback } from "@/components/chat/message-feedback";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { UserMenu } from "@/components/auth/user-menu";
import { useUser } from "@/hooks/use-user";
import { useSearchContext } from "@/contexts/search-context";
import { Search, Command, Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { UsageLimitModal } from "@/components/chat/usage-limit-modal";
import { PricingModal } from "@/components/settings/pricing-modal";
import { usePathname } from "next/navigation";


/** Strip agent control tokens; return null if the message is purely a control signal. */
function sanitizeAgentMessage(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  // Purely control-signal messages — suppress entirely
  if (/^(NO_REPLY|HEARTBEAT_OK)$/i.test(trimmed)) return null;
  // Strip trailing NO_REPLY that sometimes leaks
  return trimmed.replace(/\s*NO_REPLY\s*$/i, '').trim() || null;
}


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
  thinkingText?: string;
  thinkingStartTime?: number;
  thinkingDuration?: number;
  // Narration separation: text before/between tool calls vs final response
  narrationSegments?: string[];  // text chunks that appeared before/between tool calls
  pendingNarrationText?: string; // buffer for current text segment while streaming
  finalResponseContent?: string; // text after the last tool call (the "actual response")
  // Pay-as-you-go cost data
  cost_usd?: number;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  balance_remaining?: number;
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
  if (tool === "sessions_spawn") {
    const taskLabel = (input?.label || input?.task) as string | undefined;
    if (taskLabel) return `Spawning subagent: ${taskLabel.length > 50 ? taskLabel.slice(0, 50) + '...' : taskLabel}`;
    return "Spawning subagent";
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
    case 'sessions_spawn':
      return `Subagent: ${String(input.label || input.task || '').slice(0, 60) || 'Background task'}`;
    default:
      return `Running ${tool}...`;
  }
}

// TokenUsageBar removed — outdated daily/weekly limit banner

interface ChatPageClientProps {
  initialConversations: Conversation[];
  initialMessages: Message[];
  hasGateway?: boolean;
  gatewayHost?: string;
  initialConversationId?: string;
  intro?: boolean;
}

function formatRuntime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function groupConsecutiveTasks(segments: ParsedSegment[]): ParsedSegment[] {
  const result: ParsedSegment[] = [];
  let taskBuffer: Array<{ taskName: string; status: "running" | "complete" | "failed"; details?: string; taskId?: string }> = [];

  for (const seg of segments) {
    if (seg.type === "inline-task") {
      taskBuffer.push(seg);
    } else {
      if (taskBuffer.length > 0) {
        if (taskBuffer.length === 1) {
          result.push({ type: "inline-task", ...taskBuffer[0] });
        } else {
          result.push({ type: "inline-task-group", tasks: [...taskBuffer] });
        }
        taskBuffer = [];
      }
      result.push(seg);
    }
  }
  // Flush remaining
  if (taskBuffer.length > 0) {
    if (taskBuffer.length === 1) {
      result.push({ type: "inline-task", ...taskBuffer[0] });
    } else {
      result.push({ type: "inline-task-group", tasks: [...taskBuffer] });
    }
  }
  return result;
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
  inlineSubagents?: SubagentSession[];
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
  inlineSubagents,
}: RichMessageProps) {
  const processedSegments = groupConsecutiveTasks(segments);
  return (
    <div className="space-y-3">
      {processedSegments.map((segment, idx) => {
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
              <MarkdownMessage key={idx} content={segment.content} />
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
                onIntegrationConnect={(provider) => {
                  setTimeout(() => {
                    const name = provider.charAt(0).toUpperCase() + provider.slice(1);
                    handleSendRef.current(`${name} companion connected ✓`);
                  }, 500);
                }}
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
          case "inline-task": {
            // Look up real-time status from Supabase via inlineSubagents
            const liveTask = inlineSubagents?.find(s => s.label === segment.taskName || s.task === segment.taskName);
            const liveStatus: "pending" | "running" | "complete" | "failed" =
              liveTask?.status === "done" ? "complete" :
              liveTask?.status === "running" ? "running" :
              liveTask?.status === "failed" || liveTask?.status === "killed" ? "failed" :
              segment.status;
            const liveRuntime = liveTask?.endedAt && liveTask?.startedAt
              ? formatRuntime(liveTask.endedAt - liveTask.startedAt)
              : undefined;
            return (
              <SubagentInlineCard
                key={idx}
                taskId={liveTask?.id || `inline-${idx}`}
                label={segment.taskName}
                status={liveStatus}
                startedAt={liveTask?.startedAt}
                runtime={liveRuntime}
              />
            );
          }
          case "inline-task-group":
            return (
              <div key={idx} className="flex flex-wrap gap-2 my-2">
                {segment.tasks.map((task, tidx) => {
                  const liveTask = inlineSubagents?.find(s => s.label === task.taskName || s.task === task.taskName);
                  const liveStatus: "pending" | "running" | "complete" | "failed" =
                    liveTask?.status === "done" ? "complete" :
                    liveTask?.status === "running" ? "running" :
                    liveTask?.status === "failed" || liveTask?.status === "killed" ? "failed" :
                    task.status;
                  const liveRuntime = liveTask?.endedAt && liveTask?.startedAt
                    ? formatRuntime(liveTask.endedAt - liveTask.startedAt)
                    : undefined;
                  return (
                    <SubagentInlineCard
                      key={`${idx}-${tidx}`}
                      taskId={liveTask?.id || `inline-${idx}-${tidx}`}
                      label={task.taskName}
                      status={liveStatus}
                      startedAt={liveTask?.startedAt}
                      runtime={liveRuntime}
                    />
                  );
                })}
              </div>
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
          case "browser-relay-download":
            return <BrowserRelayCard key={idx} />;
          case "companion-download":
            return <CompanionDownloadCard key={idx} />;
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
              className="flex-1 px-2 py-1 text-[8px] font-mono uppercase tracking-wide bg-white/[0.12] text-white/90 hover:bg-white/[0.18] transition-colors"
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
            className="w-full px-2 py-1 text-[8px] font-mono uppercase tracking-wide bg-white/[0.12] text-white/90 hover:bg-white/[0.18] transition-colors"
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
          className="text-xs font-mono uppercase tracking-wide text-white/90 px-3 py-1 bg-[#CC4444] hover:bg-[#AA2222] transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  return null;
}

function parseFileAttachment(content: string): { files: Array<{name: string; size: number; mimeType: string; url?: string}>; message: string } | null {
  const FILE_IDS_PREFIX = "[Attached file_ids:";
  const PREFIX = "[Attached files:";
  const SEP = "]\nUser message: ";

  // Normalize: strip the optional [Attached file_ids:] line so the rest of the
  // parser can find [Attached files:] as usual
  let normalized = content;
  if (content.startsWith(FILE_IDS_PREFIX)) {
    const newlineIdx = content.indexOf("\n");
    if (newlineIdx === -1) return null;
    normalized = content.slice(newlineIdx + 1);
  }

  if (!normalized.startsWith(PREFIX)) return null;
  const closeIdx = normalized.indexOf(SEP);
  if (closeIdx === -1) return null;
  const filesStr = normalized.slice(PREFIX.length, closeIdx);
  const message = normalized.slice(closeIdx + SEP.length).trim();
  // Split by "), " to separate file entries (each entry has commas inside its parens)
  const files = filesStr.split(/\),\s*/).map(s => s.trim()).filter(Boolean).map(entry => {
    const parenOpen = entry.lastIndexOf("(");
    if (parenOpen !== -1) {
      const name = entry.slice(0, parenOpen).trim();
      const meta = entry.slice(parenOpen + 1).replace(/\)$/, ""); // remove trailing )
      const parts = meta.split(",").map(s => s.trim());
      const sizeStr = parts[0] || "0";
      const mimeType = parts[1] || "application/octet-stream";
      const sizeNum = parseFloat(sizeStr);
      const sizeBytes = sizeStr.includes("MB") ? sizeNum * 1024 * 1024 : sizeStr.includes("KB") ? sizeNum * 1024 : sizeNum;
      // Extract optional url: field (may contain commas in the URL itself, so search from part index 2+)
      let url: string | undefined;
      const urlPartIdx = parts.findIndex(p => p.startsWith("url:"));
      if (urlPartIdx !== -1) {
        // Rejoin from urlPartIdx in case URL contained commas
        url = parts.slice(urlPartIdx).join(",").replace(/^url:/, "");
      }
      return { name, size: sizeBytes, mimeType, url };
    }
    return { name: entry, size: 0, mimeType: "application/octet-stream" };
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



// Per-message error boundary — prevents one broken card from crashing the whole chat
class MessageErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('[MessageRender]', error); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-white/40 text-xs italic">Failed to render message</div>
      );
    }
    return this.props.children;
  }
}

export default function ChatPageClient({ 
  initialConversations, 
  initialMessages, 
  hasGateway: initialHasGateway = false,
  gatewayHost,
  initialConversationId,
  intro = false,
}: ChatPageClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  // Hydration guard: skip SSR render of dynamic message content to prevent mismatch errors
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Only auto-select a conversation when a specific ID was provided (e.g. /chat/[id]).
  // When landing at bare /chat (no ID), start with empty string to show the landing view.
  const [activeConvo, setActiveConvo] = useState(initialConversationId || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<StreamingMessage[]>(initialMessages as StreamingMessage[]);
  // Sync messages when initialMessages prop updates (async load from page-content)
  useEffect(() => { if (initialMessages.length > 0) setMessages(initialMessages as StreamingMessage[]); }, [initialMessages]);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [computerOpen, setComputerOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [linkedConversations, setLinkedConversations] = useState<Array<{id: string; title: string; link_type: string; link_id: string}>>([]);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const prevSubagentCountRef = { current: 0 };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('dopl-model-level') || 'sonnet';
    return 'sonnet';
  });
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingConvoId, setEditingConvoId] = useState<string | null>(null);
  const [editingConvoTitle, setEditingConvoTitle] = useState("");
  const [editingChatTitle, setEditingChatTitle] = useState(false);
  const [editingChatTitleValue, setEditingChatTitleValue] = useState("");
  const [usageLimitData, setUsageLimitData] = useState<{ reason: string; nextResetLabel: string; currentPlan: string; balance?: number } | null>(null);
  const [contextInfo, setContextInfo] = useState<{ percentage: number; totalTokens: number; contextTokens: number; compactions: number } | null>(null);
  const [showChatPricingModal, setShowChatPricingModal] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastFailedMessage = useRef<string | null>(null);
  const handleSendRef = useRef<(messageOverride?: string) => Promise<void>>(async () => {});
  const userIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useUser();
  const { openSearch } = useSearchContext();
  const pathname = usePathname();

  // ── Intro curtain animation (from welcome page transition) ──
  // Initialized from the `intro` prop passed by page-content.tsx (which reads the URL param)
  const [introAnimation, setIntroAnimation] = useState(intro);
  const [introRevealing, setIntroRevealing] = useState(false);

  useEffect(() => {
    if (!introAnimation || !mounted) return;
    // After brief hold (page hydrates and renders), slide panels up to reveal
    const revealTimeout = setTimeout(() => {
      setIntroRevealing(true);
    }, 800);
    // After reveal animation completes, remove overlay
    const doneTimeout = setTimeout(() => {
      setIntroAnimation(false);
    }, 800 + 2000);
    // Clean intro param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('intro');
    window.history.replaceState({}, '', url.pathname + url.search);

    return () => {
      clearTimeout(revealTimeout);
      clearTimeout(doneTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introAnimation, mounted]);

  // Fetch and cache the current user's ID on mount
  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) userIdRef.current = user.id;
    }).catch(() => {});
  }, []);

  // Elapsed timer while agent is loading
  useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0);
      const start = Date.now();
      loadingTimerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, [isLoading]);

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
    loading: _gatewayLoading, 
    status: gatewayStatus, 
    isConnected,
    statusInfo,
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
  const wsLastUserMessageRef = useRef<string>("");

  const handleWSEvent = useCallback((event: WSChatEvent) => {
    if (event.type === "token" && event.delta) {
      const msgId = wsStreamingMsgIdRef.current;
      if (!msgId) return;
      wsFullTextRef.current += event.delta;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const sm = m as StreamingMessage;
          // Freeze thinking duration when content starts arriving
          const duration = sm.thinkingStartTime && !sm.thinkingDuration
            ? Date.now() - sm.thinkingStartTime
            : sm.thinkingDuration;
          return {
            ...m,
            content: (m.content || "") + event.delta!,
            pendingNarrationText: (sm.pendingNarrationText || "") + event.delta!,
            ...(duration !== sm.thinkingDuration ? { thinkingDuration: duration } : {}),
          };
        })
      );
    } else if (event.type === "thinking" && event.text) {
      // Accumulate thinking text — shows "Worked for Xs" block above the message
      const msgId = wsStreamingMsgIdRef.current;
      if (!msgId) return;
      const thinkingDelta = event.text;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const sm = m as StreamingMessage;
          const isFirst = !sm.thinkingStartTime;
          return { ...m, thinkingText: (sm.thinkingText || "") + thinkingDelta, ...(isFirst ? { thinkingStartTime: Date.now() } : {}) };
        })
      );
    } else if (event.type === "lifecycle_start") {
      // Don't clear isLoading here — keep "Thinking..." visible until first token arrives
    } else if (event.type === "done") {
      const msgId = wsStreamingMsgIdRef.current;
      if (!msgId) return;
      const rawText = event.fullText ?? wsFullTextRef.current;
      const fullText = sanitizeAgentMessage(rawText);
      // If purely a control signal, remove the placeholder message
      if (fullText === null) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setIsLoading(false);
        wsStreamingMsgIdRef.current = null;
        wsFullTextRef.current = "";
        return;
      }
      // Mark streaming done + compute finalResponseContent for narration separation
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const sm = m as StreamingMessage;
          const hadToolCalls = (sm.toolCalls || []).length > 0;
          // finalResponseContent = text accumulated since the last tool call, or full content if no tools
          // If the post-tool text is empty/whitespace, fall back to full content (agent may have only narrated)
          const rawFinalResponse = hadToolCalls ? (sm.pendingNarrationText || "") : fullText;
          const finalResponse = rawFinalResponse.trim() ? rawFinalResponse : fullText;
          return { ...m, content: fullText, isStreaming: false, finalResponseContent: sanitizeAgentMessage(finalResponse) ?? fullText };
        })
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

      // Fire-and-forget memory extraction for WS path
      const lastUserMsg = wsLastUserMessageRef.current;
      if (lastUserMsg && fullText) {
        fetch('/api/memory/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_message: lastUserMsg,
            assistant_message: fullText,
          }),
        }).catch(() => {}); // Silent failure is fine
      }

      // Fetch context window usage after each response
      fetch('/api/gateway/context')
        .then(r => r.json())
        .then(data => {
          if (data?.available && typeof data.percentage === 'number') {
            setContextInfo({
              percentage: data.percentage,
              totalTokens: data.totalTokens,
              contextTokens: data.contextTokens,
              compactions: data.compactions ?? 0,
            });
          }
        })
        .catch(() => {}); // Silent failure

      // Fire-and-forget usage tracking for WS path
      if (lastUserMsg || fullText) {
        fetch('/api/usage/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessageLength: lastUserMsg?.length ?? 0,
            assistantMessageLength: fullText?.length ?? 0,
          }),
        }).catch(() => {}); // Silent failure is fine
      }

      // Refresh conversation list title
      if (convoId) refreshConversations(convoId);
    } else if (event.type === "tool_start" && event.tool) {
      const msgId = wsStreamingMsgIdRef.current;
      if (!msgId) return;
      const label = getToolLabel(event.tool, event.input);
      const toolCall: ToolCallInfo = { tool: event.tool, status: "running", label, startTime: Date.now(), input: event.input };
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const sm = m as StreamingMessage;
          // Flush pending narration text into narrationSegments
          const pendingText = sm.pendingNarrationText || "";
          const updatedSegments = [...(sm.narrationSegments || [])];
          if (pendingText.trim()) {
            updatedSegments.push(pendingText);
          }
          return {
            ...m,
            toolCalls: [...(sm.toolCalls || []), toolCall],
            narrationSegments: updatedSegments,
            pendingNarrationText: "",
          };
        })
      );
    } else if (event.type === "tool_end" && event.tool) {
      const msgId = wsStreamingMsgIdRef.current;
      if (!msgId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                toolCalls: ((m as StreamingMessage).toolCalls || []).map((tc) =>
                  tc.tool === event.tool && tc.status === "running"
                    ? { ...tc, status: "done" as const, result: event.result ? JSON.stringify(event.result).slice(0, 500) : undefined, duration: tc.startTime ? Date.now() - tc.startTime : undefined }
                    : tc
                ),
              }
            : m
        )
      );
    } else if (event.type === "error" && !event.message?.includes("falling back")) {
      // Don't show "falling back" as a visible error — it's handled below
      const msgId = wsStreamingMsgIdRef.current;
      if (msgId) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        wsStreamingMsgIdRef.current = null;
        wsFullTextRef.current = "";
      }
      setIsLoading(false);
      // Check for usage_limit error from WS path
      if (event.error === "usage_limit" || (event as Record<string, unknown>).usage_limit) {
        const errData = event as Record<string, unknown>;
        setUsageLimitData({
          reason: (errData.reason as string) || "Usage limit reached",
          nextResetLabel: (errData.nextResetLabel as string) || "Resets soon",
          currentPlan: (errData.currentPlan as string) || "free",
        });
      }
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



  // ── Intro kickstart: auto-send a hidden system prompt on first load ──────
  const introSentRef = useRef(false);
  useEffect(() => {
    if (introSentRef.current) return;
    if (!gateway) return;        // wait for gateway to be known
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

    wsStreamingMsgIdRef.current = streamingMsgId;
    wsFullTextRef.current = "";
    wsConvoIdRef.current = conversationId;

    const kickstartMessage =
      "[SYSTEM: The user just completed signup and is seeing you for the very first time. You have no memories and no name yet — you literally just came online. This is your first ever conversation. Be warm, playful, and a little in awe of existing. Introduce yourself as a brand new AI companion fresh out of the box — curious, excited, maybe slightly dramatic about the whole 'just came into existence' thing. Ask what they'd like to call you, and what to call them. Keep it short and fun — 2-3 sentences max before asking.]";

    // Send via HTTP/SSE path (same as regular chat)
    (async () => {
      try {
        const response = await fetch("/api/gateway/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: kickstartMessage,
            conversation_id: conversationId,
            save_user_message: false,
          }),
        });

        if (!response.ok || !response.body) {
          setMessages([]);
          setIsLoading(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "token" && event.content) {
                wsFullTextRef.current += event.content;
                setMessages([{
                  ...placeholderMsg,
                  content: wsFullTextRef.current,
                  isStreaming: true,
                }]);
              } else if (event.type === "done" || event.type === "end") {
                const finalContent = sanitizeAgentMessage(wsFullTextRef.current);
                const finalConvoId = event.conversation_id || conversationId;
                if (finalContent !== null) {
                  setMessages([{
                    id: event.message_id || streamingMsgId,
                    role: "assistant",
                    content: finalContent,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    isStreaming: false,
                    toolCalls: [],
                  }]);
                } else {
                  setMessages([]);
                }
                if (finalConvoId && !conversationId) {
                  wsConvoIdRef.current = finalConvoId;
                }
                setIsLoading(false);
              } else if (event.type === "error") {
                setMessages([]);
                setIsLoading(false);
              }
            } catch { /* ignore parse errors */ }
          }
        }
        setIsLoading(false);
      } catch {
        setMessages([]);
        setIsLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway, messages.length, conversationId]);

  const {
    isOnline: nodeIsOnline,
    nodeName,
    wasOnline: nodeWasOnline,
    bannerDismissed: nodeBannerDismissed,
    dismissBanner: dismissNodeBanner,
    loading: nodeLoading,
  } = useNodeStatus(30000);
  
  // Use server-provided initial state to avoid hydration mismatch
  const showBanner = !isConnected && !initialHasGateway && !isReconnecting;
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

    // Route through Maton connect flow
    try {
      const matonRes = await fetch('/api/integrations/maton/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: provider }),
      });
      const matonData = await matonRes.json();
      if (!matonRes.ok || (!matonData.oauthUrl && !matonData.connectionId)) return false;

      if (!matonData.oauthUrl) {
        // No OAuth needed, connection is immediately active
        fetch('/api/integrations/sync-workspace', { method: 'POST' }).catch(() => {});
        return true;
      }

      const { connectionId, oauthUrl } = matonData;
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        oauthUrl,
        `Connect ${provider}`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) return false;

      // Poll Maton for connection status
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const statusRes = await fetch(`/api/integrations/maton/status?connectionId=${connectionId}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'ACTIVE') {
            popup.close();
            fetch('/api/integrations/sync-workspace', { method: 'POST' }).catch(() => {});
            setTimeout(() => {
              const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
              handleSendRef.current(`${providerName} connected ✓`);
            }, 500);
            return true;
          }
          if (statusData.status === 'FAILED') {
            popup.close();
            return false;
          }
        } catch { /* continue */ }
        if (popup.closed && i > 5) break;
      }
      return false;
    } catch {
      return false;
    }
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

  // ── Browser Relay / Companion auto-notification ──────────────────────────
  // Poll /api/gateway/status every 20s to detect when the Browser Relay
  // Chrome extension or the Companion app connects for the first time.
  // On a false→true transition, inject a local system notice and trigger
  // a brief AI acknowledgment via the chat WS.
  useEffect(() => {
    // Only run when the gateway is configured and the WS is connected
    if (!gateway) return;

    let cancelled = false;

    // Track previous states (refs so we can read them in the interval without stale closures)
    const prevStateRef = { browserRelay: false, companion: false, initialized: false };
    // Timestamps of last notification — avoid re-firing within 5 minutes
    const lastNotifiedRef: { browserRelay: number; companion: number } = { browserRelay: 0, companion: 0 };
    // Last user activity time — stop polling if idle >5 min
    let lastActivityTime = Date.now();
    const activityHandler = () => { lastActivityTime = Date.now(); };
    window.addEventListener('mousemove', activityHandler, { passive: true });
    window.addEventListener('keydown', activityHandler, { passive: true });

    const triggerRelayNotification = (type: 'browserRelay' | 'companion') => {
      const now = Date.now();
      const cooldown = 5 * 60 * 1000; // 5 minutes
      if (now - lastNotifiedRef[type] < cooldown) return;
      lastNotifiedRef[type] = now;

      const isBrowserRelay = type === 'browserRelay';
      const systemText = isBrowserRelay
        ? '🟢 Browser Relay connected — I can now see and interact with your browser tabs.'
        : '🟢 Desktop Companion connected — I can now control your Mac and browser apps.';
      const aiPrompt = isBrowserRelay
        ? '[SYSTEM] The user just connected their Browser Relay Chrome extension. Acknowledge this briefly — let them know you can see their browser now and offer to help with whatever they\'re working on. Keep it to 1-2 sentences, warm and natural.'
        : '[SYSTEM] The user just connected their Desktop Companion app. Acknowledge this briefly — let them know you now have desktop access and offer to help. Keep it to 1-2 sentences, warm and natural.';

      // Inject a local status message (distinct from user/assistant messages)
      const statusMsgId = `relay-status-${Date.now()}`;
      const statusMsg: StreamingMessage = {
        id: statusMsgId,
        role: 'assistant' as const,
        content: systemText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStreaming: false,
        toolCalls: [],
      };
      setMessages(prev => [...prev, statusMsg]);

      // After a brief pause, trigger the AI acknowledgment
      setTimeout(() => {
        if (!cancelled) handleSendRef.current(aiPrompt);
      }, 800);
    };

    const poll = async () => {
      if (cancelled) return;
      // Don't poll if page is hidden (Page Visibility API)
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      // Don't poll if user has been idle for >5 minutes
      if (Date.now() - lastActivityTime > 5 * 60 * 1000) return;

      try {
        const res = await fetch('/api/gateway/status');
        if (!res.ok || cancelled) return;
        const data = await res.json() as { companion?: boolean; browserRelay?: boolean };

        const currentRelay = data.browserRelay === true;
        const currentCompanion = data.companion === true;

        if (!prevStateRef.initialized) {
          // First poll — just record baseline, don't trigger
          prevStateRef.browserRelay = currentRelay;
          prevStateRef.companion = currentCompanion;
          prevStateRef.initialized = true;
          return;
        }

        // Detect false → true transitions
        if (!prevStateRef.browserRelay && currentRelay) {
          triggerRelayNotification('browserRelay');
        }
        if (!prevStateRef.companion && currentCompanion) {
          triggerRelayNotification('companion');
        }

        prevStateRef.browserRelay = currentRelay;
        prevStateRef.companion = currentCompanion;
      } catch { /* ignore polling errors */ }
    };

    // Start polling after 5s (let page settle), then every 20s
    const initTimer = setTimeout(() => {
      if (!cancelled) poll();
    }, 5000);
    const interval = setInterval(() => {
      if (!cancelled) poll();
    }, 20000);

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      clearInterval(interval);
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway]);

  // Integration + companion polling: detect new connections and notify agent
  useEffect(() => {
    let prevConnected: Set<string> = new Set();
    let prevCompanionOnline = false;
    let initialized = false;

    const checkConnections = async () => {
      try {
        // Check integrations (OAuth + Maton)
        const res = await fetch("/api/integrations/status");
        if (res.ok) {
          const data = await res.json();
          const connected: string[] = data.connected || [];
          const connectedSet = new Set(connected);
          
          if (!initialized) {
            prevConnected = connectedSet;
          } else {
            // Find newly connected integrations
            for (const provider of Array.from(connectedSet)) {
              if (!prevConnected.has(provider)) {
                const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                handleSendRef.current(`${providerName} connected ✓`);
              }
            }
          }
          prevConnected = connectedSet;
        }

        // Check companion/desktop connection
        const nodeRes = await fetch("/api/nodes/status");
        if (nodeRes.ok) {
          const nodeData = await nodeRes.json();
          const nodes: Array<{ name?: string; status?: string }> = nodeData.nodes || [];
          const connectedNode = nodes.find(n => n.status === "connected");
          const isOnline = !!connectedNode;
          
          if (!initialized) {
            prevCompanionOnline = isOnline;
          } else if (isOnline && !prevCompanionOnline) {
            const deviceName = connectedNode?.name || "Desktop";
            handleSendRef.current(`Desktop companion connected ✓ (${deviceName})`);
          }
          prevCompanionOnline = isOnline;
        }

        initialized = true;
      } catch {
        // ignore polling errors
      }
    };
    
    const interval = setInterval(checkConnections, 7000);
    checkConnections(); // init baseline
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
    const filesWithIds = uploadedFiles.filter(f => f.fileId);
    const filePrefix = uploadedFiles.length > 0
      ? `${filesWithIds.length > 0 ? `[Attached file_ids: ${filesWithIds.map(f => f.fileId).join(",")}]\n` : ""}[Attached files: ${uploadedFiles.map(f => `${f.name} (${(f.size / (1024*1024)).toFixed(1)} MB, ${f.type}${f.uploadedUrl ? `, url:${f.uploadedUrl}` : ""})`).join(", ")}]
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
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
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
            body: JSON.stringify({ title: generateConversationTitle(messageToSend) }),
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

      wsLastUserMessageRef.current = messageToSend;
      wsSendMessage(messageToSend, { sessionKey, model: selectedModel });
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
        // Handle usage limit (429)
        if (response.status === 429) {
          setMessages((prev) => prev.filter((m) => m.id !== streamingMsgId));
          setIsLoading(false);
          try {
            const errData = await response.json();
            if (errData.error === "usage_limit" || errData.error === "insufficient_balance") {
              setUsageLimitData({
                reason: errData.reason || "Your balance is $0.00. Add funds to continue.",
                nextResetLabel: errData.nextResetLabel || "",
                currentPlan: errData.currentPlan || "free",
                balance: errData.balance,
              });
              return;
            }
          } catch { /* ignore parse errors */ }
        }
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
            updateMsg((m) => {
              const sm = m as StreamingMessage;
              const duration = sm.thinkingStartTime && !sm.thinkingDuration
                ? Date.now() - sm.thinkingStartTime
                : sm.thinkingDuration;
              return {
                ...m,
                content: m.content + chunk.text!,
                pendingNarrationText: (sm.pendingNarrationText || "") + chunk.text!,
                ...(duration !== sm.thinkingDuration ? { thinkingDuration: duration } : {}),
              };
            });
          } else if (chunk.type === "thinking" && chunk.text) {
            updateMsg((m) => {
              const sm = m as StreamingMessage;
              const isFirst = !sm.thinkingStartTime;
              return { ...m, thinkingText: (sm.thinkingText || "") + chunk.text!, ...(isFirst ? { thinkingStartTime: Date.now() } : {}) };
            });
          } else if (chunk.type === "tool_start" && chunk.tool) {
            setIsLoading(false);
            const label = getToolLabel(chunk.tool, chunk.input);
            const toolCall: ToolCallInfo = { tool: chunk.tool, status: "running", label, startTime: Date.now(), input: chunk.input };
            updateMsg((m) => {
              const sm = m as StreamingMessage;
              // Flush pending narration text into narrationSegments
              const pendingText = sm.pendingNarrationText || "";
              const updatedSegments = [...(sm.narrationSegments || [])];
              if (pendingText.trim()) {
                updatedSegments.push(pendingText);
              }
              return {
                ...m,
                toolCalls: [...(sm.toolCalls || []), toolCall],
                narrationSegments: updatedSegments,
                pendingNarrationText: "",
              };
            });
            const taskId = `${chunk.tool}-${Date.now()}`;
            const taskLabel = getAgentTaskLabel(chunk.tool, chunk.input || {});
            setActiveAgentTasks(prev => [...prev, { id: taskId, label: taskLabel, startedAt: Date.now() }]);

            // Auto-track sessions_spawn in agent_tasks for inline subagent cards
            if (chunk.tool === 'sessions_spawn' && userIdRef.current) {
              const spawnLabel = String((chunk.input as Record<string,unknown>)?.label || (chunk.input as Record<string,unknown>)?.task || 'Background task').slice(0, 100);
              const spawnSupabase = createSupabaseClient();
              spawnSupabase.from('agent_tasks').insert({
                user_id: userIdRef.current,
                name: spawnLabel,
                label: spawnLabel,
                status: 'running',
                model: (chunk.input as Record<string,unknown>)?.model || null,
                started_at: new Date().toISOString(),
              }).then(() => {}, (err: unknown) => console.error('Failed to insert subagent task:', err));
            }
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
            updateMsg((m) => {
              const sm = m as StreamingMessage;
              const hadToolCalls = (sm.toolCalls || []).length > 0;
              const rawFinalResponse = hadToolCalls ? (sm.pendingNarrationText || "") : m.content;
              const finalResponse = rawFinalResponse.trim() ? rawFinalResponse : m.content;
              return { ...m, isStreaming: false, finalResponseContent: sanitizeAgentMessage(finalResponse) ?? m.content };
            });
            setActiveAgentTasks([]);
            setRetryCount(0);
            lastFailedMessage.current = null;
          } else if (chunk.type === "cost") {
            // Attach cost metadata to the message
            updateMsg((m) => ({
              ...m,
              cost_usd: chunk.cost_usd,
              model: chunk.model,
              input_tokens: chunk.input_tokens,
              output_tokens: chunk.output_tokens,
              balance_remaining: chunk.balance_remaining,
            }));
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


  const handleNewConversation = async () => {
    // Create a new conversation immediately and navigate to it
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data.conversation?.id;
        if (newId) {
          setConversations(prev => [
            { id: newId, title: 'New Conversation', lastMessage: '', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            ...prev,
          ]);
          setActiveConvo(newId);
          setConversationId(newId);
          setMessages([]);
          setError(null);
          setMobileSidebarOpen(false);
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', `/chat/${newId}`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleLandingSend = async (message: string) => {
    // Create the conversation in DB, then transition to the full chat view
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: generateConversationTitle(message) }),
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data.conversation?.id;
        if (newId) {
          setConversations(prev => {
            const exists = prev.find(c => c.id === newId);
            if (exists) return prev;
            return [{ id: newId, title: generateConversationTitle(message), lastMessage: '', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev];
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

  const handleDeleteConversation = async (convoId: string) => {
    // Optimistic update — remove from list immediately
    setConversations((prev) => prev.filter((c) => c.id !== convoId));
    // If this was the active conversation, navigate away
    if (activeConvo === convoId) {
      const remaining = conversations.filter((c) => c.id !== convoId);
      if (remaining.length > 0) {
        loadConversation(remaining[0].id);
      } else {
        setActiveConvo('');
        setConversationId(null);
        setMessages([]);
        if (typeof window !== 'undefined') {
          window.history.pushState({}, '', '/chat');
        }
      }
    }
    // Delete from Supabase
    try {
      const supabase = createSupabaseClient();
      await supabase.from('messages').delete().eq('conversation_id', convoId);
      await supabase.from('conversations').delete().eq('id', convoId);
    } catch (err) {
      console.error('[Delete] Failed to delete conversation:', err);
    }
  };

  const handleRenameConversation = async (convoId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    setEditingConvoId(null);
    if (!trimmed) return;
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => c.id === convoId ? { ...c, title: trimmed } : c)
    );
    // Persist to Supabase
    try {
      const supabase = createSupabaseClient();
      await supabase.from('conversations').update({ title: trimmed }).eq('id', convoId);
    } catch (err) {
      console.error('[Rename] Failed to rename conversation:', err);
    }
  };

  const handleSaveChatTitle = async () => {
    const trimmed = editingChatTitleValue.trim();
    setEditingChatTitle(false);
    if (!trimmed || !activeConvo) return;
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => c.id === activeConvo ? { ...c, title: trimmed } : c)
    );
    // Persist to Supabase
    try {
      const supabase = createSupabaseClient();
      await supabase.from('conversations').update({ title: trimmed }).eq('id', activeConvo);
    } catch (err) {
      console.error('[SaveTitle] Failed to save conversation title:', err);
    }
  };

  handleSendRef.current = handleSend;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!activeConvo) {
        handleLandingSend(input.trim());
      } else {
        handleSend();
      }
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

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px]"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/img/landing_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* PANEL 1: Glass Navbar */}
      <GlassNavbar
        sidebarToggle={
          <button
            onClick={() => setMobileSidebarOpen(v => !v)}
            className="md:hidden w-8 h-8 flex items-center justify-center text-white/50 hover:text-white/80 mr-2"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        }
      />

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[150] md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute top-0 left-0 w-72 h-full bg-black/[0.15] backdrop-blur-[20px] border-r border-white/10 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile sidebar header */}
            <div className="px-3 py-3 border-b border-white/[0.1] flex items-center justify-between">
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-white/60 hover:text-white/90 border border-transparent hover:border-white/[0.1] transition-colors"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>New Conversation</span>
              </button>
              <button onClick={() => setMobileSidebarOpen(false)} className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Mobile nav links */}
            <div className="px-3 py-2 border-b border-white/[0.08] flex flex-col gap-0.5">
              {[
                { href: "/chat", label: "Chat" },
                { href: "/outreach", label: "Outreach" },
                { href: "/agents", label: "Agents" },
                { href: "/integrations", label: "Integrations" },
                { href: "/settings", label: "Settings" },
              ].map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={cn(
                      "text-sm px-3 py-2 rounded transition-colors",
                      isActive ? "text-white/90 font-semibold bg-white/[0.06]" : "text-white/50 hover:text-white/80"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            {/* Mobile conversation list */}
            <div className="flex-1 overflow-y-auto">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => { loadConversation(convo.id); setMobileSidebarOpen(false); }}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-white/[0.08] transition-colors",
                    activeConvo === convo.id ? "bg-white/[0.08] border-l-2 border-l-emerald-800" : "hover:bg-white/[0.04]"
                  )}
                >
                  <span className="text-[15px] font-medium truncate block text-white/90">
                    {convo.title || "New conversation"}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* Content row */}
      <div className="flex-1 flex gap-1 md:gap-[7px] min-h-0">
      {/* PANEL 2: Conversations Sidebar — desktop only */}
      <aside className={cn(
        "hidden md:flex shrink-0 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 overflow-hidden flex-col transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-12" : "w-72"
      )}>
        {/* Sidebar Header */}
        <div className={cn(
          "border-b border-white/[0.1] flex items-center transition-all duration-300",
          sidebarCollapsed ? "px-2 py-3 justify-center" : "px-3 py-3 justify-between"
        )}>
          {!sidebarCollapsed && (
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-white/60 hover:text-white/90 border border-transparent hover:border-white/[0.1] transition-colors"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>New Conversation</span>
            </button>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {sidebarCollapsed ? (
          /* Collapsed state — only show new conversation icon */
          <div className="flex flex-col items-center pt-2 flex-1">
            <button
              onClick={handleNewConversation}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Expanded state — full conversation list */
          <div className="flex-1 overflow-y-auto">
            {conversations.length > 0 ? (
              conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={cn(
                    "relative group flex items-center border-b border-white/[0.08] transition-colors",
                    activeConvo === convo.id
                      ? "bg-white/[0.08] border-l-2 border-l-emerald-800"
                      : "hover:bg-white/[0.04]"
                  )}
                >
                  {editingConvoId === convo.id ? (
                    <input
                      autoFocus
                      className="flex-1 px-4 py-3 bg-transparent text-[15px] font-medium text-white/90 outline-none"
                      value={editingConvoTitle}
                      onChange={(e) => setEditingConvoTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameConversation(convo.id, editingConvoTitle);
                        } else if (e.key === 'Escape') {
                          setEditingConvoId(null);
                        }
                      }}
                      onBlur={() => handleRenameConversation(convo.id, editingConvoTitle)}
                    />
                  ) : (
                    <button
                      onClick={() => loadConversation(convo.id)}
                      className="flex-1 text-left px-4 py-3 min-w-0"
                    >
                      <span className="text-[15px] font-medium truncate block text-white/90">
                        {convo.title || "New conversation"}
                      </span>
                    </button>
                  )}
                  {editingConvoId !== convo.id && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 flex-shrink-0 flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConvoId(convo.id);
                          setEditingConvoTitle(convo.title || "");
                        }}
                        className="p-1 text-white/40 hover:text-white/80 transition-colors"
                        title="Rename conversation"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(convo.id);
                        }}
                        className="p-1 text-white/40 hover:text-white/80 transition-colors"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-white/50 mb-1">No conversations yet</p>
                <p className="font-mono text-[10px] text-white/30">Start chatting below</p>
              </div>
            )}
          </div>
        )}

      </aside>

      {/* PANEL 3: Main Chat Area + Activity Panel */}
      <div className="flex-1 flex overflow-hidden bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10">
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
        {/* Chat header: title on left, status indicators on right */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-transparent min-h-[44px]">
          {/* Left: Conversation Title */}
          <div className="flex items-center gap-2 group min-w-0 flex-1">
            {activeConvo && (
              editingChatTitle ? (
                <input
                  autoFocus
                  className="text-lg font-bold text-white/90 bg-transparent outline-none border-b border-white/40 min-w-0 w-full max-w-xs"
                  value={editingChatTitleValue}
                  onChange={(e) => setEditingChatTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { handleSaveChatTitle(); }
                    else if (e.key === 'Escape') { setEditingChatTitle(false); }
                  }}
                  onBlur={handleSaveChatTitle}
                />
              ) : (
                <>
                  <span className="text-lg font-bold text-white/90 truncate">
                    {conversations.find((c) => c.id === activeConvo)?.title || "Conversation"}
                  </span>
                  <button
                    onClick={() => {
                      setEditingChatTitle(true);
                      setEditingChatTitleValue(conversations.find((c) => c.id === activeConvo)?.title || "");
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Rename conversation"
                  >
                    <Pencil className="w-3.5 h-3.5 text-white/40 hover:text-white/80" />
                  </button>
                </>
              )
            )}
          </div>

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
          {mounted && messages.length > 0 ? (
            messages.map((msg) => {
              const segments = parseMessageContent(msg.content);
              const hasRichContent = segments.some((s) => s.type !== "text");
              const streamingMsg = msg as StreamingMessage;
              const toolCalls = streamingMsg.toolCalls || [];
              const totalDuration = toolCalls.reduce((sum, tc) => sum + (tc.duration || 0), 0);
              const thinkingText = toolCalls.length === 1 ? toolCalls[0].label : undefined;
              const msgThinkingText = streamingMsg.thinkingText;
              const msgThinkingDuration = streamingMsg.thinkingDuration ?? (streamingMsg.thinkingStartTime ? Date.now() - streamingMsg.thinkingStartTime : 0);

              return (
                <MessageErrorBoundary key={msg.id}>
                {/* Relay/Companion connection status notice — distinct centered style */}
                {msg.id.startsWith('relay-status-') ? (
                  <div key={`inner-${msg.id}`} className="flex justify-center my-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                <div
                  key={`inner-${msg.id}`}
                  className={cn(
                    "max-w-[90%] md:max-w-[80%]",
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
                    {/* Thinking tokens — ThinkingBlock */}
                    {msg.role === "assistant" && msgThinkingText && (
                      <ThinkingBlock duration={msgThinkingDuration / 1000} thinkingText={msgThinkingText} />
                    )}
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
                    {/* Show live thinking line while reasoning tokens stream in */}
                    {msg.role === "assistant" && streamingMsg.isStreaming && !msg.content && msgThinkingText && (
                      <NarrationLine text={msgThinkingText} />
                    )}
                    {/* Show Thinking... when streaming placeholder has no content yet */}
                    {msg.role === "assistant" && streamingMsg.isStreaming && !msg.content && !msgThinkingText && toolCalls.length === 0 && (
                      <span className="font-mono text-[11px] text-white/30 italic animate-pulse">Thinking...</span>
                    )}
                    {/* Show narration line while streaming with active tool calls */}
                    {msg.role === "assistant" && streamingMsg.isStreaming && toolCalls.length > 0 && streamingMsg.pendingNarrationText && (
                      <NarrationLine text={streamingMsg.pendingNarrationText} />
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
                        inlineSubagents={inlineSubagents}
                      />
                    ) : msg.role === "user" ? (
                      <UserMessageContent content={msg.content} />
                    ) : (
                      (() => {
                        // Determine display content: use separated response if narration was extracted, else full content
                        const displayContent = (!streamingMsg.isStreaming && streamingMsg.finalResponseContent !== undefined && toolCalls.length > 0)
                          ? streamingMsg.finalResponseContent
                          : msg.content;
                        return (
                      <div className="relative">
                        {/* Narration block (collapsed) — only when done streaming and had tool calls with narration */}
                        {msg.role === "assistant" && !streamingMsg.isStreaming && (streamingMsg.narrationSegments || []).filter(Boolean).length > 0 && (
                          <NarrationBlock segments={streamingMsg.narrationSegments!} />
                        )}
                        <MarkdownMessage content={displayContent} />
                        {displayContent.length >= 20 && (
                          <div className="flex justify-end mt-1">
                            <VoiceOutputButton text={displayContent} />
                          </div>
                        )}
                      </div>
                        );
                      })()
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex justify-end mt-0.5">
                      <span className="text-xs text-white/50">{msg.timestamp}</span>
                    </div>
                  )}
                  {msg.role === "assistant" && streamingMsg.cost_usd !== undefined && !streamingMsg.isStreaming && (
                    <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="font-mono text-[10px] text-white/20">
                        ${streamingMsg.cost_usd < 0.01 ? streamingMsg.cost_usd.toFixed(4) : streamingMsg.cost_usd.toFixed(2)}
                      </span>
                      {streamingMsg.input_tokens && (
                        <span className="font-mono text-[10px] text-white/15">
                          · {streamingMsg.input_tokens.toLocaleString()} in · {(streamingMsg.output_tokens || 0).toLocaleString()} out
                        </span>
                      )}
                    </div>
                  )}
                  {msg.role === "assistant" && (
                    <MessageFeedback messageContent={msg.content} />
                  )}
                </div>
                )}
                </MessageErrorBoundary>
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
          {isLoading && messages.filter(m => m.role === 'assistant').every(m => !(m as StreamingMessage).content) && (
            <div className="max-w-[70%] mr-auto px-1">
              <span className="font-mono text-[11px] text-white/30 italic animate-pulse">
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

        {/* Input */}
        <div className="flex-shrink-0 p-2 md:p-4 flex justify-center">
          <div className="w-[95%] md:w-3/4 min-w-0 md:min-w-[300px]">
          <FilePreview
            files={attachedFiles}
            onRemove={(id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))}
          />
          <div
            className="relative bg-white/[0.08] border border-white/[0.1] rounded-[10px] overflow-hidden"
          >
            {/* Connection status indicators — top-right of input box */}
            <div className="absolute top-2 right-3 flex items-center gap-2.5 pointer-events-none z-10">
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? "bg-emerald-500" : isReconnecting ? "bg-amber-400 animate-pulse" : "bg-red-500"}`} />
                <span className="font-mono text-[9px] text-white/30">{isConnected ? "gateway" : isReconnecting ? "reconnecting" : "gateway off"}</span>
              </div>
              {gateway && (
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${wsConnected ? "bg-emerald-500" : wsConnecting ? "bg-amber-400 animate-pulse" : "bg-red-500/60"}`} />
                  <span className="font-mono text-[9px] text-white/30">{wsConnected ? "ws" : wsConnecting ? "ws…" : "ws off"}</span>
                </div>
              )}
              {contextInfo && (
                <div className="flex items-center gap-1" title={`Context: ${contextInfo.totalTokens.toLocaleString()} / ${contextInfo.contextTokens.toLocaleString()} tokens${contextInfo.compactions > 0 ? ` · ${contextInfo.compactions} compaction${contextInfo.compactions > 1 ? "s" : ""}` : ""}`}>
                  <div className="w-8 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        contextInfo.percentage >= 90 ? "bg-red-400" :
                        contextInfo.percentage >= 70 ? "bg-amber-400" :
                        "bg-emerald-400/60"
                      }`}
                      style={{ width: `${Math.min(contextInfo.percentage, 100)}%` }}
                    />
                  </div>
                  <span className={`font-mono text-[9px] ${
                    contextInfo.percentage >= 90 ? "text-red-400/70" :
                    contextInfo.percentage >= 70 ? "text-amber-400/70" :
                    "text-white/30"
                  }`}>{contextInfo.percentage}%</span>
                </div>
              )}
            </div>
            {/* Elapsed timer indicator — shown while agent is processing */}
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span className="font-mono text-[11px] text-white/40">
                  {elapsedSeconds < 60 ? `${elapsedSeconds}s` : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`}
                </span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                const fileItems: File[] = [];
                for (const item of Array.from(items)) {
                  if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f) fileItems.push(f);
                  }
                }
                if (fileItems.length === 0) return; // let text paste through normally
                e.preventDefault();
                const toAdd: UploadedFile[] = fileItems.slice(0, 5 - attachedFiles.length).map(f => ({
                  id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  file: f,
                  name: f.name || `pasted-${Date.now()}`,
                  size: f.size,
                  type: f.type || 'application/octet-stream',
                  status: 'pending' as const,
                  previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
                }));
                if (toAdd.length) setAttachedFiles(prev => [...prev, ...toAdd]);
              }}
              placeholder={
                usageLimitData
                  ? `Usage limit reached — ${usageLimitData.nextResetLabel.toLowerCase()}`
                  : gateway
                  ? "Message your assistant..."
                  : "Connect gateway to chat..."
              }
              disabled={!gateway || isLoading || isReconnecting || !!usageLimitData}
              rows={1}
              className="w-full bg-transparent px-4 pt-4 pb-2 text-base leading-[24px] text-white/90 outline-none resize-none placeholder:text-white/30 disabled:opacity-50 min-h-[48px] max-h-[200px]"
            />
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-1.5">
              {/* Paperclip attach button */}
              <button
                type="button"
                onClick={() => document.getElementById('dopl-file-input')?.click()}
                disabled={!gateway || isLoading}
                className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Attach</span>
              </button>

              {/* Hidden file input for paperclip button */}
              <input
                type="file"
                id="dopl-file-input"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.js,.ts,.tsx,.jsx,.py,.go,.rs,.java,.c,.cpp,.h,.rb,.php,.sh,.sql,.r,.swift,.kt,.yaml,.yml,.toml,.xml,.env,.ini,.conf,.log,.jsonl,.tsv,.scss,.less,.svg,.css,.html,.zip,.json,.ndjson"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    const toAdd: UploadedFile[] = [];
                    Array.from(e.target.files).slice(0, 5 - attachedFiles.length).forEach(f => {
                      toAdd.push({
                        id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        file: f,
                        name: f.name,
                        size: f.size,
                        type: f.type || 'application/octet-stream',
                        status: 'pending' as const,
                        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
                      });
                    });
                    if (toAdd.length) setAttachedFiles(prev => [...prev, ...toAdd]);
                    e.target.value = "";
                  }
                }}
              />

              {/* Connections button */}
              <button
                type="button"
                onClick={() => { setConnectionsOpen(!connectionsOpen); setComputerOpen(false); setContactOpen(false); }}
                className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors bg-transparent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Integrations</span>
              </button>

              {/* Computer / Companion button */}
              <button
                type="button"
                onClick={() => { setComputerOpen(!computerOpen); setConnectionsOpen(false); setContactOpen(false); }}
                className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors bg-transparent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="3" rx="2"/>
                  <line x1="8" x2="16" y1="21" y2="21"/>
                  <line x1="12" x2="12" y1="17" y2="21"/>
                </svg>
                <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Computer</span>
              </button>

              {/* Contact Methods button */}
              <button
                type="button"
                onClick={() => { setContactOpen(!contactOpen); setConnectionsOpen(false); setComputerOpen(false); }}
                className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors bg-transparent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Contact</span>
              </button>
              </div>

              {/* Right group: voice input + send */}
              <div className="flex items-center gap-1.5">
                {/* Voice input button — directly left of send */}
                <VoiceInputButton
                  onTranscript={(text) => {
                    setInput(text);
                    requestAnimationFrame(() => {
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
                      }
                    });
                  }}
                  onInterimUpdate={(text) => {
                    setInput(text);
                    requestAnimationFrame(() => {
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
                      }
                    });
                  }}
                  disabled={!gateway || isLoading || isReconnecting}
                  variant="outreach"
                />

                {/* Send / Stop button */}
                {isLoading ? (
                  <button
                    type="button"
                    onClick={() => { wsAbortChat(); }}
                    className="group/btn relative w-7 h-7 flex items-center justify-center text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 rounded-[4px] transition-colors bg-transparent"
                    title="Stop"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      <rect width="10" height="10" rx="1.5" />
                    </svg>
                    <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (input.trim() || attachedFiles.length > 0) {
                        if (!activeConvo) {
                          handleLandingSend(input.trim());
                        } else {
                          handleSend();
                        }
                      }
                    }}
                    disabled={!gateway || isReconnecting || (!input.trim() && attachedFiles.length === 0)}
                    className="group/btn relative w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80 border border-white/[0.1] rounded-[4px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                    <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] text-white/80 bg-black/80 rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">Send</span>
                  </button>
                )}
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

      {/* ── Intro curtain animation overlay (from welcome → chat transition) ── */}
      {introAnimation && (
        <div className="fixed inset-0 z-[300] flex pointer-events-none">
          {/* Sidebar-width panel */}
          <div
            style={{
              width: sidebarCollapsed ? 0 : 288,
              flexShrink: 0,
              background: "#373024",
              transform: introRevealing ? "translateY(-100%)" : "translateY(0)",
              transition: introRevealing
                ? "transform 1.2s cubic-bezier(0.76,0,0.24,1) 0s"
                : "none",
            }}
          />
          {/* 3 content panels, staggered */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: "#373024",
                transform: introRevealing ? "translateY(-100%)" : "translateY(0)",
                transition: introRevealing
                  ? `transform 1.2s cubic-bezier(0.76,0,0.24,1) ${i * 0.15}s`
                  : "none",
              }}
            />
          ))}
          {/* Centered "Dopl" text — visible until reveal starts */}
          {!introRevealing && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 1 }}
            >
              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: "italic",
                  color: "white",
                  fontSize: 32,
                  opacity: 0.9,
                  margin: 0,
                }}
              >
                Dopl
              </h1>
            </div>
          )}
        </div>
      )}

      {/* Full-page popup overlays — rendered at top level to escape stacking contexts */}
      {connectionsOpen && <ConnectionsPopup onClose={() => setConnectionsOpen(false)} />}
      {computerOpen && <ComputerPopup onClose={() => setComputerOpen(false)} />}
      {contactOpen && (
        <ContactMethodsPopup
          onClose={() => setContactOpen(false)}
          userEmail={user?.email ?? null}
        />
      )}

      {/* Usage limit modal — shown when API returns 429 usage_limit */}
      {usageLimitData && (
        <UsageLimitModal
          reason={usageLimitData.reason}
          nextResetLabel={usageLimitData.nextResetLabel}
          currentPlan={usageLimitData.currentPlan}
          balance={usageLimitData.balance}
          onUpgrade={() => { setUsageLimitData(null); setShowChatPricingModal(true); }}
          onClose={() => setUsageLimitData(null)}
        />
      )}

      {/* Pricing modal triggered from usage limit modal */}
      {showChatPricingModal && (
        <PricingModal
          onClose={() => setShowChatPricingModal(false)}
          currentPlan={usageLimitData?.currentPlan || "free"}
          creditStatus={null}
          onUpgrade={async (slug) => {
            setShowChatPricingModal(false);
            const res = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: slug }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
          }}
          onManageBilling={async () => {
            setShowChatPricingModal(false);
            const res = await fetch("/api/billing/portal", { method: "POST" });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
          }}
        />
      )}
  </div>
  );
}
