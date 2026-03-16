"use client";

import { useEffect, useState } from "react";
import ChatPageClient from "./client";
import { Conversation, Message } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationListSkeleton } from "@/components/skeletons/list-skeleton";
import { ChatSkeleton } from "@/components/skeletons/chat-skeleton";

export default function ChatPage({ initialConversationId: propConversationId }: { initialConversationId?: string } = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasGateway, setHasGateway] = useState(false);
  const [gatewayHost, setGatewayHost] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [initialConversationId, setInitialConversationId] = useState<string | undefined>(propConversationId);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        // Step 1: Conversations + org check in parallel
        const [convResult, provisionResult] = await Promise.allSettled([
          // 1. Conversations (also serves as auth check)
          fetch('/api/conversations').then(async res => {
            if (res.status === 401) {
              window.location.href = '/login';
              return null;
            }
            if (!res.ok) return { conversations: [] };
            return res.json();
          }),

          // 2. Instance check — provision if needed, WAIT for it to complete
          fetch('/api/organizations/provision').then(async res => {
            if (!res.ok) return null;
            const data = await res.json();
            // GET returns { organization: { openclaw_instance_id, ... } }
            const hasInstance = data.organization?.openclaw_instance_id || data.instance?.id;
            if (!hasInstance) {
              if (!cancelled) setProvisioning(true);
              try {
                const provRes = await fetch('/api/organizations/provision', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({}),
                });
                if (provRes.ok) {
                  return await provRes.json();
                }
              } catch (err) {
                console.error('Auto-provision error:', err);
              } finally {
                if (!cancelled) setProvisioning(false);
              }
            }
            return data;
          }),
        ]);

        if (cancelled) return;

        // Process conversations — show UI immediately
        if (convResult.status === 'fulfilled' && convResult.value) {
          const convos = convResult.value.conversations || [];
          setConversations(convos);

          // Use prop-provided ID if available, otherwise fall back to latest conversation
          const targetConvoId = propConversationId || (convos.length > 0 ? convos[0]?.id : undefined);

          // Load messages non-blocking — page renders while this completes
          if (targetConvoId) {
            setInitialConversationId(targetConvoId);
            fetch(`/api/conversations/${targetConvoId}/messages`)
              .then(res => res.ok ? res.json() : { messages: [] })
              .then(data => { if (!cancelled) setMessages(data.messages || []); })
              .catch(() => {});
          }
        }

        // Step 2: Now that provisioning is done, check gateway status
        try {
          const gwRes = await fetch('/api/gateway/connect');
          if (gwRes.ok && !cancelled) {
            const gwData = await gwRes.json();
            setHasGateway(!!gwData.gateway);
            if (gwData.gateway?.gateway_url) {
              try {
                const url = new URL(gwData.gateway.gateway_url);
                setGatewayHost(url.hostname);
              } catch {}
            }
          }
        } catch {}

      } catch (err) {
        console.error('Failed to load chat data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading || provisioning) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col p-[7px] gap-[7px]"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Top Navbar Panel */}
        <nav className="shrink-0 h-[56px] bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex items-center px-6">
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-12 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-white/[0.08] animate-pulse" />
              <div className="h-2.5 w-12 rounded bg-white/[0.06] animate-pulse" />
            </div>
            <div className="w-7 h-7 rounded-full bg-white/[0.06] animate-pulse" />
          </div>
        </nav>

        {/* Main content area */}
        <div className="flex-1 flex gap-[7px] min-h-0">
          {/* Left Sidebar Panel */}
          <aside className="shrink-0 w-72 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex flex-col overflow-hidden">
            <div className="px-3 py-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-white/[0.04]">
                <div className="w-4 h-4 rounded bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
              </div>
            </div>
            <div className="flex-1 overflow-hidden px-2">
              {[65, 80, 55, 72, 60, 85].map((w, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <div className="h-3 rounded bg-white/[0.06] animate-pulse" style={{ width: `${w}%` }} />
                    <div className="h-2 w-8 rounded bg-white/[0.04] animate-pulse" />
                  </div>
                  <div className="h-2.5 w-4/5 rounded bg-white/[0.04] animate-pulse" />
                </div>
              ))}
            </div>
          </aside>

          {/* Chat Panel */}
          <div className="flex-1 flex flex-col overflow-hidden bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10">
            {/* Chat header */}
            <div className="shrink-0 px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="h-4 w-36 rounded bg-white/[0.06] animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-sm bg-white/[0.06] animate-pulse" />
                  <div className="h-2 w-20 rounded bg-white/[0.04] animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-sm bg-white/[0.06] animate-pulse" />
                  <div className="h-2 w-12 rounded bg-white/[0.04] animate-pulse" />
                </div>
              </div>
            </div>

            {provisioning ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-mono text-[11px] text-white/40 uppercase tracking-wide">
                    Setting up your instance...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Message skeletons */}
                <div className="flex-1 overflow-hidden p-6 space-y-5">
                  {/* Assistant message */}
                  <div className="max-w-[60%] mr-auto">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2.5 w-10 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-2 w-8 rounded bg-white/[0.04] animate-pulse" />
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-[3px] p-4 space-y-2">
                      <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-[85%] rounded bg-white/[0.05] animate-pulse" />
                    </div>
                  </div>
                  {/* User message */}
                  <div className="max-w-[55%] ml-auto">
                    <div className="bg-white/[0.08] border border-white/[0.1] rounded-[3px] p-4">
                      <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                    </div>
                  </div>
                  {/* Assistant message */}
                  <div className="max-w-[65%] mr-auto">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2.5 w-10 rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-2 w-8 rounded bg-white/[0.04] animate-pulse" />
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-[3px] p-4 space-y-2">
                      <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-[90%] rounded bg-white/[0.05] animate-pulse" />
                      <div className="h-3 w-[60%] rounded bg-white/[0.05] animate-pulse" />
                    </div>
                  </div>
                  {/* User message */}
                  <div className="max-w-[50%] ml-auto">
                    <div className="bg-white/[0.08] border border-white/[0.1] rounded-[3px] p-4 space-y-2">
                      <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                      <div className="h-3 w-[70%] rounded bg-white/[0.06] animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Input area skeleton */}
                <div className="shrink-0 p-4 flex justify-center">
                  <div className="w-3/4 min-w-[300px]">
                    <div className="bg-white/[0.06] border border-white/[0.08] rounded-[10px] overflow-hidden">
                      <div className="px-4 pt-4 pb-2">
                        <div className="h-5 w-48 rounded bg-white/[0.04] animate-pulse" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="w-7 h-7 rounded-[4px] border border-white/[0.06] bg-white/[0.03] animate-pulse" />
                          ))}
                        </div>
                        <div className="w-7 h-7 rounded-[4px] border border-white/[0.06] bg-white/[0.03] animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatPageClient
      initialConversations={conversations}
      initialMessages={messages}
      hasGateway={hasGateway}
      initialConversationId={initialConversationId}
      gatewayHost={gatewayHost}
    />
  );
}
