"use client";

import ReactMarkdown from "react-markdown";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Conversation, Message } from "@/lib/mock-data";
import { useGateway } from "@/hooks/use-gateway";
import { useOnboardingChat } from "@/hooks/use-onboarding-chat";
import { useToast } from "@/hooks/use-toast";
import type { GatewayError } from "@/types/gateway";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationListSkeleton } from "@/components/skeletons/list-skeleton";
import { ChatSkeleton } from "@/components/skeletons/chat-skeleton";
import { parseMessageContent, type ParsedSegment } from "@/lib/chat/message-parser";
import { DynamicIntegrationsCard } from "@/components/chat/dynamic-integrations-card";
import { SkillSuggestCard } from "@/components/chat/skill-suggest-card";
import {
  IntegrationConnectCard,
  IntegrationStatusCard,
  SubagentProgressCard,
  WorkflowSuggestionCard,
  ContextSummaryCard,
  OnboardingWelcomeAnimation,
} from "@/components/chat";
import { ActiveAgentsPanel } from "@/components/chat/active-agents-panel";
import { ChatError } from "@/components/chat/chat-error";
import { useNodeStatus } from "@/hooks/use-node-status";

interface ToolCallInfo {
  tool: string;
  status: "running" | "done";
  label: string;
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
  onWelcomeComplete: () => void;
  gatewayHost?: string;
}

function RichMessage({
  segments,
  onIntegrationConnect,
  onWorkflowSelect,
  onWorkflowCustom,
  onWelcomeComplete,
  gatewayHost,
}: RichMessageProps) {
  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => {
        switch (segment.type) {
          case "text":
            return (
              <div key={idx} className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-headings:font-header prose-headings:text-forest prose-strong:text-forest prose-code:text-xs prose-code:bg-grid/10 prose-code:px-1 prose-code:rounded prose-pre:bg-grid/10 prose-pre:rounded prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
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
          default:
            return null;
        }
      })}
    </div>
  );
}

// Onboarding progress indicator
function OnboardingProgress({ phase }: { phase: string }) {
  const phases = ["welcome", "integrations", "context_gathering", "workflow_setup"];
  const currentIndex = phases.indexOf(phase);
  
  const phaseLabels: Record<string, string> = {
    welcome: "Getting Started",
    integrations: "Connect Tools",
    context_gathering: "Learning About You",
    workflow_setup: "Set Up Workflows",
  };
  
  return (
    <div className="bg-forest/5 border-b border-forest/10 px-4 py-2">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-forest/60">
            Onboarding
          </span>
          <span className="font-mono text-[11px] text-forest font-medium">
            {phaseLabels[phase] || phase}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {phases.map((p, i) => (
            <div
              key={p}
              className={cn(
                "h-1.5 transition-all duration-300",
                i <= currentIndex ? "bg-forest w-6" : "bg-forest/20 w-3"
              )}
            />
          ))}
        </div>
      </div>
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
    <div className="px-4 py-3 border-t border-[rgba(58,58,56,0.2)] bg-paper">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", statusColors[status] || statusColors.disconnected)} />
          <span className="font-mono text-[9px] uppercase tracking-wide text-grid/50">
            Gateway {statusLabels[status] || status}
          </span>
        </div>
        {status === "connected" && latencyMs && (
          <span className="font-mono text-[8px] text-grid/30">{latencyMs}ms</span>
        )}
      </div>
      
      {/* Reconnection UI */}
      {isReconnecting && (
        <div className="mt-2 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] text-grid/50">
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
              className="flex-1 px-2 py-1 text-[8px] font-mono uppercase tracking-wide bg-forest text-white hover:bg-forest/90 transition-colors"
            >
              Retry Now
            </button>
            <button
              onClick={onCancel}
              className="px-2 py-1 text-[8px] font-mono uppercase tracking-wide border border-[rgba(58,58,56,0.2)] hover:bg-grid/5 transition-colors"
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
            <p className="text-[9px] text-grid/50 mb-1.5">Reconnection canceled</p>
          )}
          <button
            onClick={onRetry}
            className="w-full px-2 py-1 text-[8px] font-mono uppercase tracking-wide bg-forest text-white hover:bg-forest/90 transition-colors"
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

export default function ChatPageClient({ 
  initialConversations, 
  initialMessages, 
  hasGateway: initialHasGateway = false,
  gatewayHost,
  initialConversationId,
}: ChatPageClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConvo, setActiveConvo] = useState(initialConversationId || initialConversations[0]?.id || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<StreamingMessage[]>(initialMessages as StreamingMessage[]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GatewayError | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeAgentTasks, setActiveAgentTasks] = useState<Array<{id: string, label: string, startedAt: number}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastFailedMessage = useRef<string | null>(null);
  const handleSendRef = useRef<(messageOverride?: string) => Promise<void>>(async () => {});
  
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

  const {
    isOnline: nodeIsOnline,
    nodeName,
    wasOnline: nodeWasOnline,
    bannerDismissed: nodeBannerDismissed,
    dismissBanner: dismissNodeBanner,
    loading: nodeLoading,
  } = useNodeStatus(30000);
  
  const { 
    onboardingState, 
    isInOnboarding, 
    currentPhase,
    completeOnboarding,
    updatePhase,
    completeStep,
    refreshState: refreshOnboardingState,
  } = useOnboardingChat();
  
  // Use server-provided initial state to avoid hydration mismatch
  const showBanner = !gatewayLoading && !isConnected && !initialHasGateway && !isReconnecting;
  const toast = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle integration connect via OAuth popup
  const handleIntegrationConnect = useCallback(async (provider: string): Promise<boolean> => {
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
              const stepName = `integration_${provider}` as 'integration_google' | 'integration_slack' | 'integration_notion';
              try { await completeStep(stepName); } catch { /* continue */ }
              resolve(true);
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
  }, [completeStep]);

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

  const handleWelcomeComplete = useCallback(async () => {
    // Welcome animation completed, advance to next phase
    console.log("Welcome animation complete");
    try {
      await updatePhase("integrations");
    } catch {
      // Continue anyway
    }
  }, [updatePhase]);

  // Handle skip onboarding
  const handleSkipOnboarding = useCallback(async () => {
    try {
      await completeOnboarding();
      toast.success("Onboarding skipped", "You can always set up integrations in Settings.");
    } catch (err) {
      console.error("Failed to skip onboarding:", err);
    }
  }, [completeOnboarding, toast]);


  // Integration polling: detect when user connects integration in another tab during onboarding
  useEffect(() => {
    if (!isInOnboarding) return;
    
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
  }, [isInOnboarding]);

  const handleSend = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: StreamingMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      content: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    if (!messageOverride) {
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
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

          let chunk: { type: string; text?: string; tool?: string; input?: Record<string, unknown>; result?: string; conversation_id?: string; message?: string };
          try { chunk = JSON.parse(jsonStr); } catch { continue; }

          if (chunk.type === "token" && chunk.text) {
            setIsLoading(false);
            updateMsg((m) => ({ ...m, content: m.content + chunk.text! }));
          } else if (chunk.type === "thinking" && chunk.text) {
            // Optionally show thinking
          } else if (chunk.type === "tool_start" && chunk.tool) {
            setIsLoading(false);
            const label = getToolLabel(chunk.tool, chunk.input);
            const toolCall: ToolCallInfo = { tool: chunk.tool, status: "running", label };
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
                  ? { ...tc, status: "done" as const }
                  : tc
              ),
            }));
          } else if (chunk.type === "done") {
            if (chunk.conversation_id) {
              const isNew = !conversations.find((c) => c.id === chunk.conversation_id);
              setConversationId(chunk.conversation_id);
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
            refreshOnboardingState();
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
        if (isNew || data.is_onboarding) {
          await refreshConversations(data.conversation_id);
        }
      }
      if (data.is_onboarding) refreshOnboardingState();
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
    setActiveConvo("");
    setConversationId(null);
    setMessages([]);
    setError(null);
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
      <div className="flex h-[calc(100vh-56px)]">
        {/* Conversation Sidebar Skeleton */}
        <aside className="w-64 border-r border-[rgba(58,58,56,0.2)] bg-paper flex flex-col">
          <div className="px-4 py-3 border-b border-[rgba(58,58,56,0.2)] flex items-center justify-between">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-12" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ConversationListSkeleton rows={6} />
          </div>
          
          {/* Gateway Status */}
          <div className="px-4 py-3 border-t border-[rgba(58,58,56,0.2)] bg-paper">
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
          <div className="border-t border-[rgba(58,58,56,0.2)] p-4">
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
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-forest/10 flex items-center justify-center">
            <span className="text-2xl">🔌</span>
          </div>
          <h2 className="font-header text-xl font-bold mb-2">No Gateway Connected</h2>
          <p className="text-sm text-grid/60 mb-6">
            Connect your personal gateway instance to start chatting. Your gateway runs locally and keeps your data private.
          </p>
          <Link href="/settings">
            <Button variant="solid">Connect in Settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Conversation Sidebar */}
      <aside className="w-64 border-r border-[rgba(58,58,56,0.2)] bg-paper flex flex-col">
        <div className="px-4 py-3 border-b border-[rgba(58,58,56,0.2)] flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
            Conversations
          </span>
          <Button variant="solid" size="sm" onClick={handleNewConversation}>New</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => loadConversation(convo.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[rgba(58,58,56,0.1)] transition-colors",
                  activeConvo === convo.id ? "bg-forest/5 border-l-2 border-l-forest" : "hover:bg-forest/[0.02]"
                )}
              >
                <span className="text-sm font-medium truncate block">{convo.title || "New conversation"}</span>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-grid/50 mb-1">No conversations yet</p>
              <p className="font-mono text-[10px] text-grid/40">
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
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Onboarding Progress Bar */}
        {isInOnboarding && currentPhase && (
          <OnboardingProgress phase={currentPhase} />
        )}

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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length > 0 ? (
            messages.map((msg) => {
              const segments = parseMessageContent(msg.content);
              const hasRichContent = segments.some((s) => s.type !== "text");

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[70%]",
                    msg.role === "user" ? "ml-auto" : "mr-auto"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">
                      {msg.role === "user" ? "You" : (onboardingState?.agent_name || "Assistant")}
                    </span>
                    <span className="font-mono text-[9px] text-grid/30">{msg.timestamp}</span>
                  </div>
                  <div
                    className={cn(
                      "text-sm leading-relaxed",
                      msg.role === "user"
                        ? "border border-[rgba(58,58,56,0.2)] rounded-none p-4 bg-forest text-white"
                        : "text-forest p-0 border-0 bg-transparent"
                    )}
                  >
                    {/* Tool calls */}
                    {msg.role === "assistant" && (msg as StreamingMessage).toolCalls && (msg as StreamingMessage).toolCalls!.length > 0 && (
                      <div className="mb-2 space-y-1">
                        {(msg as StreamingMessage).toolCalls!.map((tc, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-grid/50 font-mono">
                            <span>{getToolEmoji(tc.tool)}</span>
                            <span className={tc.status === "done" ? "line-through opacity-50" : ""}>
                              {tc.label}{tc.status === "running" ? "..." : " ✓"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {hasRichContent && msg.role === "assistant" ? (
                      <RichMessage
                        segments={segments}
                        onIntegrationConnect={handleIntegrationConnect}
                        onWorkflowSelect={handleWorkflowSelect}
                        onWorkflowCustom={handleWorkflowCustom}
                        onWelcomeComplete={handleWelcomeComplete}
                        gatewayHost={gatewayHost}
                      />
                    ) : msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-headings:font-header prose-headings:text-forest prose-strong:text-forest prose-code:text-xs prose-code:bg-grid/10 prose-code:px-1 prose-code:rounded prose-pre:bg-grid/10 prose-pre:rounded prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>

                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 border border-[rgba(58,58,56,0.2)] flex items-center justify-center">
                  <span className="text-2xl">{isInOnboarding ? "👋" : "💬"}</span>
                </div>
                <h3 className="font-header text-lg font-bold mb-2">
                  {isInOnboarding ? "Welcome!" : "Start a conversation"}
                </h3>
                <p className="text-sm text-grid/50 max-w-sm">
                  {isInOnboarding 
                    ? "Let's get you set up. Type 'hello' to begin!"
                    : "Ask your assistant anything — summarize emails, draft responses, research topics, or get help with tasks."}
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

          {/* Loading indicator */}
          {isLoading && (
            <div className="max-w-[70%] mr-auto px-1">
              <span className="font-mono text-[11px] text-grid/40 italic animate-pulse">
                {retryCount > 0 ? `Retrying (${retryCount}/3)...` : "Thinking..."}
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <ActiveAgentsPanel tasks={activeAgentTasks} />

        {/* Input */}
        <div className="border-t border-[rgba(58,58,56,0.2)] p-4">
          {/* Skip onboarding option */}
          {isInOnboarding && (
            <div className="mb-2 flex justify-end">
              <button
                onClick={handleSkipOnboarding}
                className="font-mono text-[10px] text-grid/40 hover:text-grid/60 uppercase tracking-wide"
              >
                Skip onboarding →
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isReconnecting 
                  ? "Reconnecting to gateway..." 
                  : gateway 
                    ? (isInOnboarding ? "Say hello to get started..." : "Message your assistant...") 
                    : "Connect gateway to chat..."
              }
              disabled={!gateway || isLoading || isReconnecting}
              className="flex-1 bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-4 py-2.5 text-sm outline-none focus:border-forest transition-colors placeholder:text-grid/30 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div
              className="relative group"
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
                disabled={!gateway || !input.trim() || isLoading || isReconnecting}
              >
                {isLoading ? "..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
