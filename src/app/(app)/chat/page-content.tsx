"use client";

import { useEffect, useState } from "react";
import ChatPageClient from "./client";
import { Conversation, Message } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationListSkeleton } from "@/components/skeletons/list-skeleton";
import { ChatSkeleton } from "@/components/skeletons/chat-skeleton";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasGateway, setHasGateway] = useState(false);
  const [gatewayHost, setGatewayHost] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [initialConversationId, setInitialConversationId] = useState<string | undefined>();

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

          // Load messages non-blocking — page renders while this completes
          if (convos.length > 0) {
            const latestConvo = convos[0];
            setInitialConversationId(latestConvo.id);
            fetch(`/api/conversations/${latestConvo.id}/messages`)
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

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {provisioning ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-mono text-[11px] text-grid/60 uppercase tracking-wide">
                  Setting up your instance...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <ChatSkeleton messages={5} />
              </div>
              <div className="border-t border-[rgba(58,58,56,0.2)] p-4">
                <div className="flex gap-2">
                  <Skeleton className="flex-1 h-10" />
                  <Skeleton className="h-10 w-16" />
                </div>
              </div>
            </>
          )}
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
