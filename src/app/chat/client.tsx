"use client";

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
import {
  IntegrationConnectCard,
  IntegrationStatusCard,
  SubagentProgressCard,
  WorkflowSuggestionCard,
  ContextSummaryCard,
  OnboardingWelcomeAnimation,
} from "@/components/chat";

interface ChatPageClientProps {
  initialConversations: Conversation[];
  initialMessages: Message[];
  hasGateway?: boolean;
  initialConversationId?: string;
}

interface RichMessageProps {
  segments: ParsedSegment[];
  onIntegrationConnect: (provider: string) => Promise<boolean>;
  onWorkflowSelect: (id: string) => void;
  onWorkflowCustom: () => void;
  onWelcomeComplete: () => void;
}

function RichMessage({
  segments,
  onIntegrationConnect,
  onWorkflowSelect,
  onWorkflowCustom,
  onWelcomeComplete,
}: RichMessageProps) {
  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => {
        switch (segment.type) {
          case "text":
            return (
              <p key={idx} className="whitespace-pre-wrap">
                {segment.content}
              </p>
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
            return (
              <OnboardingWelcomeAnimation
                key={idx}
                userName={segment.userName}
                agentName={segment.agentName}
                onComplete={onWelcomeComplete}
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
  error,
  onRetry,
  onCancel,
}: {
  status: string;
  latencyMs: number | null;
  reconnectAttempt: number;
  reconnectCountdown: number | null;
  isReconnecting: boolean;
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

      {/* Error state with retry */}
      {status === "error" && !isReconnecting && (
        <div className="mt-2">
          {error && (
            <p className="text-[9px] text-[#FF6B6B] mb-1.5 truncate" title={error}>
              {error.length > 40 ? error.slice(0, 40) + '...' : error}
            </p>
          )}
          <button
            onClick={onRetry}
            className="w-full px-2 py-1 text-[8px] font-mono uppercase tracking-wide bg-forest text-white hover:bg-forest/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// Reconnection banner for chat area
function ReconnectionBanner({
  isReconnecting,
  reconnectAttempt,
  reconnectCountdown,
  onRetry,
  onCancel,
}: {
  isReconnecting: boolean;
  reconnectAttempt: number;
  reconnectCountdown: number | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  if (!isReconnecting) return null;

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

export default function ChatPageClient({ 
  initialConversations, 
  initialMessages, 
  hasGateway: initialHasGateway = false,
  initialConversationId,
}: ChatPageClientProps) {
  const [activeConvo, setActiveConvo] = useState(initialConversationId || initialConversations[0]?.id || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GatewayError | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastFailedMessage = useRef<string | null>(null);
  
  const { 
    gateway, 
    loading: gatewayLoading, 
    status: gatewayStatus, 
    isConnected,
    latencyMs,
    reconnectAttempt,
    reconnectCountdown,
    isReconnecting,
    error: gatewayError,
    forceReconnect,
    cancelReconnect,
  } = useGateway();
  
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

  const handleWorkflowSelect = useCallback((workflowId: string) => {
    // Send workflow selection as message
    setInput(`I'd like to use the "${workflowId}" workflow`);
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

  const handleSend = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: Message = {
      id: "msg_" + Date.now(),
      role: "user",
      content: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Only add user message if it's not a retry
    if (!messageOverride) {
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
    }
    
    setIsLoading(true);
    setError(null);
    lastFailedMessage.current = messageToSend;

    try {
      const response = await fetch("/api/gateway/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageToSend,
          conversation_id: conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle gateway errors with retry logic
        const gatewayError: GatewayError = data.error || {
          code: "UNKNOWN_ERROR",
          message: "Something went wrong. Please try again.",
        };
        setError(gatewayError);
        
        // Check if it's a retryable error
        const isRetryable = ["GATEWAY_OFFLINE", "GATEWAY_ERROR"].includes(gatewayError.code);
        if (isRetryable && retryCount < 2) {
          toast.error("Connection issue", `Retrying... (${retryCount + 1}/3)`);
          setRetryCount(prev => prev + 1);
          // Retry after a short delay
          setTimeout(() => handleSend(messageToSend), 1000 * (retryCount + 1));
          return;
        }
        
        toast.error("Gateway error", gatewayError.message);
        setRetryCount(0);
        return;
      }

      // Success - add assistant message
      const assistantMessage: Message = {
        id: "msg_" + Date.now() + "_assistant",
        role: "assistant",
        content: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setRetryCount(0);
      lastFailedMessage.current = null;
      
      // Store conversation ID for future messages
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      // Refresh onboarding state if we're in onboarding
      if (data.is_onboarding) {
        refreshOnboardingState();
      }
    } catch (err) {
      console.error("Chat error:", err);
      const gatewayError: GatewayError = {
        code: "GATEWAY_OFFLINE",
        message: "Failed to connect. Check your internet connection.",
      };
      setError(gatewayError);
      
      // Auto-retry for network errors
      if (retryCount < 2) {
        toast.error("Network error", `Retrying... (${retryCount + 1}/3)`);
        setRetryCount(prev => prev + 1);
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
            Connect your personal OpenClaw instance to start chatting. Your gateway runs locally and keeps your data private.
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
          <Button variant="solid" size="sm">New</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {initialConversations.length > 0 ? (
            initialConversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setActiveConvo(convo.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[rgba(58,58,56,0.1)] transition-colors",
                  activeConvo === convo.id ? "bg-forest/5" : "hover:bg-forest/[0.02]"
                )}
              >
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium truncate">{convo.title}</span>
                  <span className="font-mono text-[9px] text-grid/40 ml-2 whitespace-nowrap">
                    {convo.timestamp}
                  </span>
                </div>
                <p className="text-xs text-grid/50 mt-0.5 truncate">{convo.lastMessage}</p>
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
          error={gatewayError}
          onRetry={forceReconnect}
          onCancel={cancelReconnect}
        />
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Onboarding Progress Bar */}
        {isInOnboarding && currentPhase && (
          <OnboardingProgress phase={currentPhase} />
        )}

        {/* Reconnection Banner */}
        <ReconnectionBanner
          isReconnecting={isReconnecting}
          reconnectAttempt={reconnectAttempt}
          reconnectCountdown={reconnectCountdown}
          onRetry={forceReconnect}
          onCancel={cancelReconnect}
        />

        {/* Error Banner */}
        {error && (
          <div className="bg-[#FF6B6B]/10 border-b border-[#FF6B6B]/30 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[#FF6B6B]">⚠️</span>
              <span className="text-sm text-[#FF6B6B]">{error.message}</span>
            </div>
            <div className="flex gap-2">
              {lastFailedMessage.current && (
                <button
                  onClick={handleRetryLastMessage}
                  className="text-xs font-mono uppercase tracking-wide text-[#FF6B6B] hover:text-[#FF4444] px-2 py-1 bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/20 transition-colors"
                >
                  Retry
                </button>
              )}
              <button
                onClick={dismissError}
                className="text-[#FF6B6B]/60 hover:text-[#FF6B6B] text-sm"
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
                      {msg.role === "user" ? "You" : (onboardingState?.agent_name || "OpenClaw")}
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
                    {hasRichContent && msg.role === "assistant" ? (
                      <RichMessage
                        segments={segments}
                        onIntegrationConnect={handleIntegrationConnect}
                        onWorkflowSelect={handleWorkflowSelect}
                        onWorkflowCustom={handleWorkflowCustom}
                        onWelcomeComplete={handleWelcomeComplete}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
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
                    : "Ask OpenClaw anything — summarize emails, draft responses, research topics, or get help with tasks."}
                </p>
              </div>
            </div>
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="max-w-[70%] mr-auto">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">
                  {onboardingState?.agent_name || "OpenClaw"}
                </span>
              </div>
              <div className="border border-[rgba(58,58,56,0.2)] rounded-none p-4 bg-white text-forest">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-forest/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-forest/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-forest/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="font-mono text-[10px] text-grid/40">
                    {retryCount > 0 ? `Retrying (${retryCount}/3)...` : "Thinking..."}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

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
                    ? (isInOnboarding ? "Say hello to get started..." : "Message OpenClaw...") 
                    : "Connect gateway to chat..."
              }
              disabled={!gateway || isLoading || isReconnecting}
              className="flex-1 bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-4 py-2.5 text-sm outline-none focus:border-forest transition-colors placeholder:text-grid/30 disabled:opacity-50 disabled:cursor-not-allowed"
            />
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
  );
}
