"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Integration, IntegrationAccount } from "@/types/integration";
import { IntegrationGridSkeleton } from "@/components/skeletons/integration-skeleton";
import type { ResolvedIntegration } from "@/lib/integrations/resolver";
import { IntegrationIcon } from "@/components/integrations/integration-icon";
import { INTEGRATIONS } from "@/lib/integrations/registry";
import { Star, Trash2, Plus } from "lucide-react";


// ── Deep Scan types ──────────────────────────────────────────────────────────
interface ScanProgress {
  phase: string;
  progress: number;
  message: string;
  result?: {
    scanId: string;
    totalMemories: number;
    durationMs: number;
  };
}

interface ScanLog {
  id: string;
  mode: string;
  status: string;
  provider: string | null;
  memoriesCreated: number;
  durationMs: number;
  createdAt: string;
}

interface ScanState {
  running: boolean;
  progress: ScanProgress | null;
  history: ScanLog[];
  historyLoaded: boolean;
  showHistory: boolean;
}

// ── Deep Scan Panel ──────────────────────────────────────────────────────────
function DeepScanPanel({ provider }: { provider: string }) {
  const [state, setState] = useState<ScanState>({
    running: false,
    progress: null,
    history: [],
    historyLoaded: false,
    showHistory: false,
  });
  const toast = useToast();

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/engine/scan/history?provider=${provider}`);
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({ ...prev, history: data.scans || [], historyLoaded: true }));
      }
    } catch {
      setState(prev => ({ ...prev, historyLoaded: true }));
    }
  }, [provider]);

  const startScan = async () => {
    if (state.running) return;
    setState(prev => ({ ...prev, running: true, progress: { phase: 'starting', progress: 0, message: 'Starting deep scan…' } }));

    try {
      const res = await fetch('/api/engine/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, mode: 'deep' }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to start scan');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: ScanProgress = JSON.parse(line.slice(6));
              setState(prev => ({ ...prev, progress: event }));
              if (event.phase === 'complete' || event.phase === 'error') {
                setState(prev => ({ ...prev, running: false }));
                if (event.phase === 'complete') {
                  toast.success('Deep scan complete', `${event.result?.totalMemories ?? 0} memories created`);
                  loadHistory();
                } else {
                  toast.error('Scan failed', event.message);
                }
              }
            } catch { /* malformed SSE */ }
          }
        }
      }
    } catch (err) {
      setState(prev => ({ ...prev, running: false, progress: { phase: 'error', progress: 0, message: String(err) } }));
      toast.error('Scan error', String(err));
    }
  };

  const toggleHistory = () => {
    const next = !state.showHistory;
    setState(prev => ({ ...prev, showHistory: next }));
    if (next && !state.historyLoaded) loadHistory();
  };

  const prog = state.progress;
  const isDone = prog?.phase === 'complete';
  const isError = prog?.phase === 'error';

  return (
    <div className="mt-4 pt-4 border-t border-[rgba(58,58,56,0.1)]">
      <div className="flex items-center gap-2">
        <button
          onClick={startScan}
          disabled={state.running}
          className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide border border-[rgba(26,60,43,0.2)] text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.running ? 'Scanning…' : 'Deep Scan'}
        </button>
        <button
          onClick={toggleHistory}
          className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wide text-grid/50 hover:text-grid transition-colors"
        >
          {state.showHistory ? 'Hide History' : 'History'}
        </button>
      </div>

      {/* Progress bar */}
      {prog && !isDone && !isError && (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-grid/60 truncate pr-2">{prog.message}</span>
            <span className="font-mono text-[10px] text-grid/40 flex-shrink-0">{prog.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[rgba(58,58,56,0.1)]">
            <div
              className="h-full bg-[#1A3C2B] transition-all duration-300"
              style={{ width: `${prog.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Completion summary */}
      {isDone && prog.result && (
        <div className="mt-3 p-2 bg-[#1A3C2B]/5 border border-[#1A3C2B]/20">
          <p className="font-mono text-[10px] text-[#1A3C2B]">
            ✓ {prog.result.totalMemories} memories created · {Math.round(prog.result.durationMs / 1000)}s
          </p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="mt-3 p-2 bg-coral/5 border border-coral/20">
          <p className="font-mono text-[10px] text-coral">✕ {prog.message}</p>
        </div>
      )}

      {/* Scan history */}
      {state.showHistory && (
        <div className="mt-3 space-y-1">
          <p className="font-mono text-[9px] uppercase tracking-wide text-grid/40">Recent Scans</p>
          {!state.historyLoaded ? (
            <p className="font-mono text-[10px] text-grid/30">Loading…</p>
          ) : state.history.length === 0 ? (
            <p className="font-mono text-[10px] text-grid/30 italic">No scans yet</p>
          ) : (
            <div className="space-y-1.5">
              {state.history.map(scan => (
                <div key={scan.id} className="flex items-center justify-between py-1.5 px-2 border border-[rgba(58,58,56,0.08)] bg-cream/30">
                  <div>
                    <span className="font-mono text-[10px] text-grid/70 capitalize">{scan.mode}</span>
                    <span className="font-mono text-[9px] text-grid/40 ml-2">
                      {new Date(scan.createdAt).toLocaleDateString()} {new Date(scan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-grid/50">{scan.memoriesCreated} mem</span>
                    {scan.durationMs > 0 && (
                      <span className="font-mono text-[9px] text-grid/40">{Math.round(scan.durationMs / 1000)}s</span>
                    )}
                    <span className={`font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 border ${
                      scan.status === 'complete'
                        ? 'text-[#1A3C2B] border-[#1A3C2B]/20 bg-[#1A3C2B]/5'
                        : 'text-coral border-coral/20 bg-coral/5'
                    }`}>
                      {scan.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface IntegrationsPageClientProps {
  initialIntegrations: Integration[];
  isLoading?: boolean;
}

interface ResolvedCard {
  resolved: ResolvedIntegration;
  creating: boolean;
  created: boolean;
}


const POPULAR_INTEGRATIONS = [
  { id: 'google', slug: 'google-workspace' },
  { id: 'slack', slug: 'slack' },
  { id: 'notion', slug: 'notion' },
  { id: 'github', slug: 'github' },
  { id: 'microsoft', slug: 'microsoft' },
  { id: 'linear', slug: 'linear' },
  { id: 'telegram', slug: 'telegram' },
  { id: 'discord', slug: 'discord' },
  { id: 'whatsapp', slug: 'whatsapp' },
  { id: 'imessage', slug: 'imessage' },
  { id: 'zoom', slug: 'zoom' },
  { id: 'twitter', slug: 'twitter' },
  { id: 'hubspot', slug: 'hubspot' },
  { id: 'jira', slug: 'jira' },
  { id: 'figma', slug: 'figma' },
];

export default function IntegrationsPageClient({ initialIntegrations, isLoading = false }: IntegrationsPageClientProps) {
  const [items, setItems] = useState(initialIntegrations);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedCards, setResolvedCards] = useState<ResolvedCard[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed_integrations');
      if (stored) setDismissedIds(JSON.parse(stored));
    } catch {}
  }, []);

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
      "github": "github",
      "microsoft": "microsoft",
      "microsoft-365": "microsoft",
      "outlook": "microsoft",
      "linear": "linear",
      "discord": "discord",
      "zoom": "zoom",
      "twitter": "twitter",
      "x": "twitter",
      "hubspot": "hubspot",
      "jira": "jira",
      "figma": "figma",
      "reddit": "reddit",
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
        // Refresh integrations to show new account
        fetch('/api/integrations/accounts')
          .then(r => r.json())
          .then(data => {
            if (data.accounts) {
              // Rebuild accounts for this integration from the refreshed data
              const providerAccounts = data.accounts[provider] || [];
              setItems(prev => prev.map(item => {
                if (item.id !== integrationId) return item;
                return {
                  ...item,
                  status: providerAccounts.length > 0 ? 'connected' as const : item.status,
                  accounts: providerAccounts.map((a: Record<string, unknown>) => ({
                    id: a.id as string,
                    email: a.email as string,
                    name: a.name as string,
                    picture: a.picture as string,
                    is_default: a.is_default as boolean,
                    connectedAt: a.connected_at ? new Date(a.connected_at as string).toLocaleDateString() : 'Recently',
                  })),
                };
              }));
            }
          })
          .catch(() => window.location.reload());
      }
    };
    window.addEventListener("message", onMessage);

    // Poll for popup close
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        window.removeEventListener("message", onMessage);
      }
    }, 1000);
  };


  const dismissPopular = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try { localStorage.setItem('dismissed_integrations', JSON.stringify(next)); } catch {}
  };

  const connectPopular = async (registryId: string) => {
    const regEntry = INTEGRATIONS.find(r => r.id === registryId);
    if (!regEntry) return;

    // Check if already in items list
    const existing = items.find(i =>
      i.slug === registryId || i.slug === regEntry.id || i.id === registryId
    );
    if (existing) {
      addAccount(existing.id);
      return;
    }

    // Node-based: show instruction
    if (regEntry.authType === 'browser-login') {
      toast.info(
        regEntry.name + ' uses browser automation',
        "I'll open it in a browser — you log in, then I take over. No CLI needed."
      );
      return;
    }

    // Create integration then connect
    try {
      const res = await fetch('/api/integrations/create-dynamic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolved: {
            name: regEntry.name,
            slug: regEntry.id,
            icon: regEntry.icon,
            authType: regEntry.authType === 'api-key' ? 'api_key' : regEntry.authType,
            category: regEntry.category,
            description: regEntry.description || '',
            needsNode: false,
          }
        }),
      });
      const data = await res.json();
      const integrationId = data.integration?.id;
      if (!integrationId) {
        toast.error('Error', 'Could not create integration');
        return;
      }
      if (!data.existed) {
        const newInt = {
          id: integrationId,
          name: regEntry.name,
          slug: regEntry.id,
          icon: regEntry.icon,
          type: regEntry.authType === 'api-key' ? 'api_key' as const : 'oauth' as const,
          status: 'disconnected' as const,
          config: { needs_node: false },
          accounts: [],
          last_sync: null,
        };
        setItems(prev => [...prev, newInt]);
      }
      addAccount(integrationId);
    } catch {
      toast.error('Error', 'Failed to connect integration');
    }
  };

  const disconnectAccount = async (integrationId: string, accountId: string) => {
    const integration = items.find(i => i.id === integrationId);
    const account = integration?.accounts.find(a => a.id === accountId);
    try {
      const res = await fetch(`/api/integrations/accounts/${accountId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== integrationId) return item;
          const newAccounts = item.accounts.filter((acc) => acc.id !== accountId);
          return { ...item, accounts: newAccounts, status: newAccounts.length > 0 ? "connected" as const : "disconnected" as const };
        })
      );
      toast.info("Account disconnected", `${account?.email || "Account"} removed from ${integration?.name || "integration"}`);
    } catch {
      toast.error("Error", "Failed to disconnect account");
    }
  };

  const setAsDefault = async (integrationId: string, accountId: string) => {
    try {
      const res = await fetch(`/api/integrations/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) throw new Error('Failed to set default');
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== integrationId) return item;
          return {
            ...item,
            accounts: item.accounts.map((acc) => ({
              ...acc,
              is_default: acc.id === accountId,
            })),
          };
        })
      );
      toast.success('Default account updated', '');
    } catch {
      toast.error('Error', 'Failed to set default account');
    }
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

      {/* Popular Integrations Quick Connect */}
      {(() => {
        const connectedSlugs = new Set(items.map(i => i.slug));
        const visible = POPULAR_INTEGRATIONS.filter(p =>
          !dismissedIds.includes(p.id) && !connectedSlugs.has(p.id)
        );
        if (visible.length === 0) return null;
        return (
          <div className="mb-6 border border-[rgba(58,58,56,0.2)] bg-paper p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wide text-grid font-semibold">📌 Quick Connect</p>
                <p className="font-mono text-[9px] text-grid/40 mt-0.5">Popular integrations — click to connect, ✕ to dismiss</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {visible.map(p => {
                const reg = INTEGRATIONS.find(r => r.id === p.id);
                if (!reg) return null;
                const needsNode = reg.authType === 'browser-login';
                const isConnected = items.some(i => i.slug === p.id || i.id === p.id);
                return (
                  <div key={p.id} className="relative flex items-center gap-1.5 border border-[rgba(58,58,56,0.2)] bg-cream/50 px-2.5 py-1.5 pr-6 hover:border-forest/40 transition-colors group">
                    <IntegrationIcon provider={p.id} size={16} />
                    <span className="font-mono text-[10px] text-grid">{reg.name}</span>
                    {needsNode && (
                      <span className="font-mono text-[8px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1 py-0.5 border border-amber-200 leading-none">Node</span>
                    )}
                    {isConnected ? (
                      <span className="text-forest text-xs">✓</span>
                    ) : (
                      <button
                        onClick={() => connectPopular(p.id)}
                        className="font-mono text-[9px] uppercase tracking-wide text-forest border border-forest/30 px-1.5 py-0.5 hover:bg-forest/10 transition-colors leading-none"
                      >
                        Connect
                      </button>
                    )}
                    <button
                      onClick={() => dismissPopular(p.id)}
                      className="absolute top-0.5 right-0.5 text-grid/30 hover:text-grid/70 transition-colors text-[10px] leading-none w-4 h-4 flex items-center justify-center"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((integration) => {
            const accountCount = integration.accounts.length;
            const badgeText = integration.status === "connected" 
              ? (accountCount === 1 ? '1 Account' : accountCount + ' Accounts') + ' Connected' 
              : 'Disconnected';
            const needsNode = getNeedsNode(integration);

            return (
              <Card key={integration.id} label={<IntegrationIcon provider={integration.slug || ""} size={36} />} accentColor={integration.status === "connected" ? "#9EFFBF" : undefined} bordered={true}>
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
                        Uses browser automation. Connect via{' '}
                        <a href="/settings/connect" className="underline">Settings → Connect</a>{' '}
                        or run: <code className="bg-amber-100 px-1">crackedclaw-connect --token YOUR_TOKEN --server wss://companion.crackedclaw.com/api/companion/ws</code>
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">Connected Accounts</span>
                    {integration.accounts.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {integration.accounts.map((account) => (
                          <div key={account.id} className="flex items-center gap-2 py-1.5 px-2 border border-[rgba(58,58,56,0.1)] bg-cream/30">
                            {/* Avatar */}
                            {account.picture ? (
                              <img src={account.picture} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-forest/10 flex items-center justify-center flex-shrink-0">
                                <span className="font-mono text-[9px] text-forest uppercase">{(account.email || account.name || '?')[0]}</span>
                              </div>
                            )}
                            {/* Account info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-grid truncate">{account.email || account.name || 'Account'}</span>
                                {account.is_default && (
                                  <span className="flex-shrink-0 font-mono text-[8px] uppercase tracking-wide bg-forest/10 text-forest px-1.5 py-0.5 border border-forest/20">Default</span>
                                )}
                              </div>
                              <span className="font-mono text-[9px] text-grid/40">Connected {account.connectedAt}</span>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!account.is_default && (
                                <button
                                  onClick={() => setAsDefault(integration.id, account.id)}
                                  title="Set as default"
                                  className="p-1 text-grid/30 hover:text-forest transition-colors"
                                >
                                  <Star size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => disconnectAccount(integration.id, account.id)}
                                title="Disconnect"
                                className="p-1 text-grid/30 hover:text-coral transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-[11px] text-grid/40 italic">No accounts connected</p>
                    )}
                    <button onClick={() => addAccount(integration.id)} className="mt-3 w-full py-2 px-3 font-mono text-[11px] uppercase tracking-wide text-forest border border-forest/30 hover:bg-forest/5 transition-colors flex items-center justify-center gap-1.5">
                      <Plus size={14} />
                      <span>{integration.accounts.length > 0 ? 'Add Account' : 'Connect'}</span>
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

                  {/* Deep Scan — only for connected integrations with a known provider */}
                  {integration.status === "connected" && (
                    <DeepScanPanel provider={integration.slug || integration.name?.toLowerCase() || ""} />
                  )}
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
