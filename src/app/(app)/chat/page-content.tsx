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
    async function loadData() {
      try {
        // Redirect to login if not authenticated
        const authCheck = await fetch('/api/conversations');
        if (authCheck.status === 401) {
          window.location.href = '/login';
          return;
        }

        // Check organization / OpenClaw instance
        const orgRes = await fetch('/api/organizations/provision');
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          if (!orgData.organization || !orgData.organization.openclaw_instance_id) {
            // Auto-provision
            setProvisioning(true);
            try {
              const provRes = await fetch('/api/organizations/provision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              });
              if (!provRes.ok) {
                console.error('Auto-provision failed:', await provRes.text());
              }
            } catch (err) {
              console.error('Auto-provision error:', err);
            } finally {
              setProvisioning(false);
            }
          }
        }

        // Fetch conversations
        const convRes = authCheck;
        if (convRes.ok) {
          const convData = await convRes.json();
          const convos = convData.conversations || [];
          setConversations(convos);

          // Load the most recent conversation
          if (convos.length > 0) {
            const latestConvo = convos[0]; // already sorted by updated_at desc
            setInitialConversationId(latestConvo.id);
            try {
              const msgRes = await fetch(`/api/conversations/${latestConvo.id}/messages`);
              if (msgRes.ok) {
                const msgData = await msgRes.json();
                setMessages(msgData.messages || []);
              }
            } catch {
              // Continue without messages
            }
          }
        }

        // Fetch gateway status
        const gwRes = await fetch('/api/gateway/connect');
        if (gwRes.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (gwRes.ok) {
          const gwData = await gwRes.json();
          setHasGateway(!!gwData.gateway);
          if (gwData.gateway?.gateway_url) {
            try {
              const url = new URL(gwData.gateway.gateway_url);
              setGatewayHost(url.hostname);
            } catch {}
          }
        }
      } catch (err) {
        console.error('Failed to load chat data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
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
                  Setting up your workspace...
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
