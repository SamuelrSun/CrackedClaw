"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Integration, IntegrationAccount } from "@/types/integration";
import { IntegrationGridSkeleton } from "@/components/skeletons/integration-skeleton";
import type { ResolvedIntegration } from "@/lib/integrations/resolver";
import { IntegrationIcon } from "@/components/integrations/integration-icon";

interface IntegrationsPageClientProps {
  initialIntegrations: Integration[];
  isLoading?: boolean;
}

interface ResolvedCard {
  resolved: ResolvedIntegration;
  creating: boolean;
  created: boolean;
}

export default function IntegrationsPageClient({ initialIntegrations, isLoading = false }: IntegrationsPageClientProps) {
  const [items, setItems] = useState(initialIntegrations);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedCards, setResolvedCards] = useState<ResolvedCard[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || resolving) return;
    setResolving(true);
    setResolvedCards([]);
    try {
      const res = await fetch("/api/integrations/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (res.status === 401) {
        toast.error("Authentication required", "Please sign in to connect integrations");
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (data.resolved?.length) {
        setResolvedCards(data.resolved.map((r: ResolvedIntegration) => ({ resolved: r, creating: false, created: false })));
      } else {
        toast.info("No services found", "Try being more specific, e.g. 'Notion, Linear, LinkedIn'");
      }
    } catch {
      toast.error("Error", "Failed to resolve integrations");
    } finally {
      setResolving(false);
    }
  };

  const connectResolved = async (index: number) => {
    const card = resolvedCards[index];
    if (!card || card.creating || card.created) return;

    setResolvedCards(prev => prev.map((c, i) => i === index ? { ...c, creating: true } : c));
    try {
      const res = await fetch("/api/integrations/create-dynamic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: card.resolved }),
      });
      const data = await res.json();
      setResolvedCards(prev => prev.map((c, i) => i === index ? { ...c, creating: false, created: true } : c));
      
      if (data.integration && !data.existed) {
        // Add to main list
        const newInt: Integration = {
          id: data.integration.id,
          name: card.resolved.name,
          slug: card.resolved.slug,
          icon: card.resolved.icon,
          type: card.resolved.authType === 'browser' ? 'browser' : card.resolved.authType === 'api_key' ? 'api_key' : 'oauth',
          status: "disconnected",
          config: { needs_node: card.resolved.needsNode },
          accounts: [],
          last_sync: null,
        };
        setItems(prev => [...prev, newInt]);
      }
      toast.success("Added!", `${card.resolved.name} added to your integrations`);
    } catch {
      setResolvedCards(prev => prev.map((c, i) => i === index ? { ...c, creating: false } : c));
      toast.error("Error", "Failed to add integration");
    }
  };

  const addAccount = (integrationId: string) => {
    const integration = items.find(i => i.id === integrationId);
    if (!integration) return;

    // Map integration slug/name to OAuth provider
    const SLUG_TO_PROVIDER: Record<string, string> = {
      "google-workspace": "google",
      "google-sheets": "google",
      "google-drive": "google",
      "google-calendar": "google",
      "google-docs": "google",
      "gmail": "google",
      "google": "google",
      "slack": "slack",
      "notion": "notion",
    };
    
    const provider = SLUG_TO_PROVIDER[integration.slug?.toLowerCase() || ""] 
      || SLUG_TO_PROVIDER[integration.name?.toLowerCase() || ""]
      || integration.slug?.toLowerCase()
      || integration.name?.toLowerCase();

    if (!provider) {
      toast.error("Error", "Could not determine provider for this integration");
      return;
    }

    // Open OAuth popup with prompt=consent to force account selection
    const width = 500, height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const popup = window.open(
      `/api/integrations/oauth/start?provider=${provider}&prompt=consent`,
      "oauth_popup",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      toast.error("Popup blocked", "Please allow popups for this site");
      return;
    }

    // Listen for OAuth completion
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth_complete" && event.data?.provider === provider) {
        window.removeEventListener("message", onMessage);
        // Refresh integrations list
        window.location.reload();
      }
    };
    window.addEventListener("message", onMessage);

    // Poll for popup close
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        window.removeEventListener("message", onMessage);
        // Refresh anyway in case OAuth completed
        window.location.reload();
      }
    }, 1000);
  };

  const disconnectAccount = (integrationId: string, accountId: string) => {
    const integration = items.find(i => i.id === integrationId);
    const account = integration?.accounts.find(a => a.id === accountId);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== integrationId) return item;
        const newAccounts = item.accounts.filter((acc) => acc.id !== accountId);
        return { ...item, accounts: newAccounts, status: newAccounts.length > 0 ? "connected" as const : "disconnected" as const };
      })
    );
    toast.info("Account disconnected", `${account?.email || "Account"} removed from ${integration?.name || "integration"}`);
  };

  const getScopes = (item: Integration): string[] => {
    const config = item.config as { scopes?: string[] };
    return config?.scopes || [];
  };

  const getNeedsNode = (item: Integration): boolean => {
    const config = item.config as { needs_node?: boolean };
    return config?.needs_node || false;
  };

  const hasIntegrations = items.length > 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
            Integrations
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
            Connect any app or service
          </p>
        </div>
        <Link href="/integrations/add">
          <Button variant="solid">
            <span className="mr-1">+</span> Add Integration
          </Button>
        </Link>
      </div>

      {/* Dynamic integration search bar */}
      <form onSubmit={handleResolve} className="mb-6">
        <div className="flex gap-2 items-center border border-[rgba(58,58,56,0.25)] bg-paper p-3">
          <span className="text-lg">🔌</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Connect any app... e.g. "Notion, Linear, LinkedIn" or "I use Attio for CRM and check Twitter daily"'
            className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-grid/30 text-grid"
          />
          <button
            type="submit"
            disabled={resolving || !query.trim()}
            className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-grid text-paper hover:bg-grid/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resolving ? "Resolving..." : "Connect →"}
          </button>
        </div>
        <p className="font-mono text-[9px] text-grid/30 mt-1 ml-1">
          Any app, any service — we'll figure out how to connect it
        </p>
      </form>

      {/* Resolved integration cards */}
      {resolvedCards.length > 0 && (
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-3">Found {resolvedCards.length} service{resolvedCards.length > 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {resolvedCards.map((card, i) => (
              <div key={card.resolved.slug} className="border border-[rgba(58,58,56,0.2)] bg-paper p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <IntegrationIcon provider={card.resolved.slug} size={36} />
                    <div>
                      <p className="font-header font-bold text-sm">{card.resolved.name}</p>
                      <p className="font-mono text-[9px] text-grid/40 uppercase">{card.resolved.category}</p>
                    </div>
                  </div>
                  {card.resolved.needsNode && (
                    <span className="font-mono text-[9px] uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 border border-amber-200">
                      Requires Node
                    </span>
                  )}
                  {!card.resolved.needsNode && (
                    <span className="font-mono text-[9px] uppercase tracking-wide bg-forest/10 text-forest px-2 py-0.5 border border-forest/20">
                      {card.resolved.authType === 'api_key' ? 'API Key' : 'OAuth'}
                    </span>
                  )}
                </div>
                <p className="font-mono text-[10px] text-grid/50 mb-3">{card.resolved.description}</p>
                {card.resolved.needsNode && (
                  <p className="font-mono text-[9px] text-amber-600 mb-3">
                    This service has no public API — your local node will use browser automation to access it.
                  </p>
                )}
                {card.created ? (
                  <div className="flex items-center gap-1 font-mono text-[10px] text-forest">
                    <span>✓</span> Added to integrations
                  </div>
                ) : (
                  <button
                    onClick={() => connectResolved(i)}
                    disabled={card.creating}
                    className="w-full py-1.5 font-mono text-[10px] uppercase tracking-wide border border-grid/40 hover:bg-grid hover:text-paper transition-colors disabled:opacity-50"
                  >
                    {card.creating ? "Adding..." : card.resolved.needsNode ? "Add (Browser via Node)" : "Add Integration"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <IntegrationGridSkeleton count={6} />
      ) : hasIntegrations ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(58,58,56,0.2)]">
          {items.map((integration) => {
            const accountCount = integration.accounts.length;
            const badgeText = integration.status === "connected" ? accountCount + " Connected" : "Disconnected";
            const needsNode = getNeedsNode(integration);

            return (
              <Card key={integration.id} label={<IntegrationIcon provider={integration.slug || ""} size={36} />} accentColor={integration.status === "connected" ? "#9EFFBF" : undefined} bordered={false}>
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-header text-sm font-medium tracking-tight text-grid/70">{integration.name}</h3>
                    <div className="flex items-center gap-1">
                      {needsNode && (
                        <span className="font-mono text-[8px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 border border-amber-200">
                          Node
                        </span>
                      )}
                      <Badge status={integration.status === "connected" ? "active" : "inactive"}>{badgeText}</Badge>
                    </div>
                  </div>

                  {needsNode && integration.status === "disconnected" && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200">
                      <p className="font-mono text-[9px] text-amber-700">
                        Requires your local node. Run <code className="bg-amber-100 px-1">openclaw node run --tls --host crackedclaw.com</code> to enable.
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">Connected Accounts</span>
                    {integration.accounts.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {integration.accounts.map((account) => (
                          <div key={account.id} className="flex items-center justify-between py-1.5 px-2 border border-[rgba(58,58,56,0.1)] bg-cream/30">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs text-grid">{account.email || account.name || "Account"}</span>
                              <span className="font-mono text-[9px] text-grid/40">Connected {account.connectedAt}</span>
                            </div>
                            <button onClick={() => disconnectAccount(integration.id, account.id)} className="font-mono text-[10px] uppercase tracking-wide text-coral hover:text-coral/70 transition-colors px-2 py-1 border border-coral/20 hover:border-coral/40">
                              Disconnect
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-[11px] text-grid/40 italic">No accounts connected</p>
                    )}
                    <button onClick={() => addAccount(integration.id)} className="mt-3 w-full py-2 px-3 font-mono text-[11px] uppercase tracking-wide text-forest border border-forest/30 hover:bg-forest/5 transition-colors flex items-center justify-center gap-1">
                      <span className="text-base leading-none">+</span>
                      <span>Add Account</span>
                    </button>
                  </div>

                  {integration.status === "connected" && getScopes(integration).length > 0 && (
                    <div className="mt-4">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">Scopes</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {getScopes(integration).map((scope) => (
                          <span key={scope} className="font-mono text-[10px] bg-forest/5 px-2 py-0.5 border border-[rgba(58,58,56,0.1)]">{scope}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="font-mono text-[10px] text-grid/40 mt-4">Last sync: {integration.last_sync || "Never"}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="border border-[rgba(58,58,56,0.2)] bg-paper p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 border border-[rgba(58,58,56,0.2)] flex items-center justify-center">
            <span className="text-2xl">🔗</span>
          </div>
          <h2 className="font-header text-xl font-bold mb-2">No integrations yet</h2>
          <p className="text-sm text-grid/50 mb-6 max-w-md mx-auto">
            Use the search bar above to connect any app — just type what you use and we'll figure out the rest.
          </p>
        </div>
      )}
    </div>
  );
}
