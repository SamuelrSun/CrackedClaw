"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Integration, IntegrationAccount } from "@/types/integration";
import type { ResolvedIntegration } from "@/lib/integrations/resolver";
import { IntegrationIcon } from "@/components/integrations/integration-icon";
import { INTEGRATIONS, getAvailableConnectionMethods } from "@/lib/integrations/registry";
import type { ConnectionMethod } from "@/lib/integrations/registry";
import { Star, Trash2, Plus } from "lucide-react";
import { GlassNavbar } from "@/components/layout/glass-navbar";


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
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <div className="flex items-center gap-2">
        <button
          onClick={startScan}
          disabled={state.running}
          className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide border border-white/[0.1] text-white/80 hover:bg-white/[0.12] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.running ? 'Scanning…' : 'Deep Scan'}
        </button>
        <button
          onClick={toggleHistory}
          className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wide text-white/70 hover:text-white/80 transition-colors"
        >
          {state.showHistory ? 'Hide History' : 'History'}
        </button>
      </div>

      {/* Progress bar */}
      {prog && !isDone && !isError && (
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-white/60 truncate pr-2">{prog.message}</span>
            <span className="font-mono text-[10px] text-white/60 flex-shrink-0">{prog.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06]">
            <div
              className="h-full bg-white/[0.12] transition-all duration-300"
              style={{ width: `${prog.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Completion summary */}
      {isDone && prog.result && (
        <div className="mt-3 p-2 bg-white/[0.06] border border-white/[0.1]">
          <p className="font-mono text-[10px] text-white/80">
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
          <p className="font-mono text-[9px] uppercase tracking-wide text-white/60">Recent Scans</p>
          {!state.historyLoaded ? (
            <p className="font-mono text-[10px] text-white/70">Loading…</p>
          ) : state.history.length === 0 ? (
            <p className="font-mono text-[10px] text-white/70 italic">No scans yet</p>
          ) : (
            <div className="space-y-1.5">
              {state.history.map(scan => (
                <div key={scan.id} className="flex items-center justify-between py-1.5 px-2 border border-white/[0.06] bg-white/[0.03]">
                  <div>
                    <span className="font-mono text-[10px] text-white/70 capitalize">{scan.mode}</span>
                    <span className="font-mono text-[9px] text-white/60 ml-2">
                      {new Date(scan.createdAt).toLocaleDateString()} {new Date(scan.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-white/70">{scan.memoriesCreated} mem</span>
                    {scan.durationMs > 0 && (
                      <span className="font-mono text-[9px] text-white/60">{Math.round(scan.durationMs / 1000)}s</span>
                    )}
                    <span className={`font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 border ${
                      scan.status === 'complete'
                        ? 'text-white/80 border-white/[0.1] bg-white/[0.06]'
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

// Live status indicator types
interface LiveStatus {
  connected: boolean;
  tokenStatus: 'valid' | 'expired' | 'refreshed' | 'checking' | 'error' | 'browser';
  lastChecked: number;
}

export default function IntegrationsPageClient({ initialIntegrations, isLoading = false }: IntegrationsPageClientProps) {
  const [items, setItems] = useState(initialIntegrations);
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedCards, setResolvedCards] = useState<ResolvedCard[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LiveStatus>>({});
  const [statusCheckInProgress, setStatusCheckInProgress] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [hasMatonKey, setHasMatonKey] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState<string | null>(null);
  const [methodPickerMethods, setMethodPickerMethods] = useState<ConnectionMethod[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Fetch which OAuth providers have server-side credentials configured
  useEffect(() => {
    fetch('/api/integrations/configured-providers')
      .then(r => r.json())
      .then(data => {
        if (data.providers) setConfiguredProviders(data.providers);
        if (data.hasMatonKey) setHasMatonKey(true);
      })
      .catch(() => {});
  }, []);

  // Close method picker on outside click
  useEffect(() => {
    if (!showMethodPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-method-picker]')) {
        setShowMethodPicker(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMethodPicker]);

  // Check live status for all connected OAuth integrations
  const checkAllStatuses = useCallback(async () => {
    const connected = items.filter(i => i.status === 'connected');
    if (connected.length === 0) return;

    setStatusCheckInProgress(true);

    // Mark all as checking
    const checking: Record<string, LiveStatus> = {};
    connected.forEach(item => {
      checking[item.slug] = { connected: true, tokenStatus: 'checking', lastChecked: Date.now() };
    });
    setLiveStatuses(prev => ({ ...prev, ...checking }));

    // Check each provider in parallel
    await Promise.allSettled(
      connected.map(async (item) => {
        const slug = item.slug;
        // Browser-login integrations don't have token status
        const regEntry = INTEGRATIONS.find(r => r.id === slug);
        if (regEntry?.authType === 'browser-login') {
          setLiveStatuses(prev => ({
            ...prev,
            [slug]: { connected: true, tokenStatus: 'browser', lastChecked: Date.now() },
          }));
          return;
        }

        try {
          const res = await fetch(`/api/integrations/status/${slug}`);
          if (!res.ok) {
            setLiveStatuses(prev => ({
              ...prev,
              [slug]: { connected: false, tokenStatus: 'error', lastChecked: Date.now() },
            }));
            return;
          }
          const data = await res.json();
          setLiveStatuses(prev => ({
            ...prev,
            [slug]: {
              connected: data.connected ?? false,
              tokenStatus: data.tokenStatus || (data.connected ? 'valid' : 'expired'),
              lastChecked: Date.now(),
            },
          }));
        } catch {
          setLiveStatuses(prev => ({
            ...prev,
            [slug]: { connected: false, tokenStatus: 'error', lastChecked: Date.now() },
          }));
        }
      })
    );

    setStatusCheckInProgress(false);
  }, [items]);

  // Auto-check statuses when items load or change
  useEffect(() => {
    const connected = items.filter(i => i.status === 'connected');
    if (connected.length > 0) {
      checkAllStatuses();
    }
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Execute a specific connection method for a service
  const connectWithMethod = async (registryId: string, methodType: ConnectionMethod['type']) => {
    const regEntry = INTEGRATIONS.find(r => r.id === registryId);
    if (!regEntry) return;
    setShowMethodPicker(null);

    // Browser method: initiate browser connection flow
    if (methodType === 'browser') {
      try {
        toast.info(
          `Opening ${regEntry.name}...`,
          "A browser window will open — log in, and I'll detect it automatically."
        );
        const res = await fetch('/api/integrations/browser-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: registryId }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error('Connection failed', data.error || 'Could not start browser login');
          return;
        }
        const newInt = {
          id: data.integration_id,
          name: regEntry.name,
          slug: regEntry.id,
          icon: regEntry.icon,
          type: 'browser' as const,
          status: 'syncing' as const,
          config: { needs_node: true },
          accounts: [],
          last_sync: null,
        };
        setItems(prev => {
          const exists = prev.some(i => i.slug === registryId);
          if (exists) {
            return prev.map(i => i.slug === registryId ? { ...i, status: 'syncing' as const } : i);
          }
          return [...prev, newInt];
        });
        const pollBrowserStatus = async () => {
          for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 5000));
            try {
              const statusRes = await fetch(`/api/integrations/status-by-slugs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slugs: [registryId] }),
              });
              const statusData = await statusRes.json();
              if (statusData.connected?.includes(registryId)) {
                setItems(prev => prev.map(i =>
                  i.slug === registryId ? { ...i, status: 'connected' as const } : i
                ));
                toast.success(`${regEntry.name} connected!`, 'Browser login verified successfully.');
                return;
              }
            } catch { /* continue polling */ }
          }
          toast.info(`${regEntry.name} login`, 'Still waiting for login. The card will update when detected.');
        };
        pollBrowserStatus();
      } catch {
        toast.error('Error', `Failed to connect ${regEntry.name}`);
      }
      return;
    }

    // OAuth / Maton / API-key: create integration then connect
    const authTypeForApi = methodType === 'api-key' ? 'api_key' : (methodType === 'maton' ? 'oauth' : regEntry.authType);
    try {
      const res = await fetch('/api/integrations/create-dynamic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolved: {
            name: regEntry.name,
            slug: regEntry.id,
            icon: regEntry.icon,
            authType: authTypeForApi === 'api-key' ? 'api_key' : authTypeForApi,
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
          type: methodType === 'api-key' ? 'api_key' as const : 'oauth' as const,
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

    // Get available connection methods dynamically
    const hasCompanionApp = false; // TODO: wire up companion app detection
    const methods = getAvailableConnectionMethods(registryId, configuredProviders, hasMatonKey, hasCompanionApp);
    const availableMethods = methods.filter(m => m.available);

    if (availableMethods.length === 0) {
      // Fallback to legacy behavior based on authType
      if (regEntry.authType === 'browser-login') {
        connectWithMethod(registryId, 'browser');
      } else {
        connectWithMethod(registryId, 'oauth');
      }
      return;
    }

    if (availableMethods.length === 1) {
      // Single method — use it directly, no picker
      connectWithMethod(registryId, availableMethods[0].type);
      return;
    }

    // Multiple methods available — show picker
    setMethodPickerMethods(methods);
    setShowMethodPicker(registryId);
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

  // Quick Connect section
  const quickConnectSection = (() => {
    const connectedSlugs = new Set(items.map(i => i.slug));
    const visible = POPULAR_INTEGRATIONS.filter(p =>
      !dismissedIds.includes(p.id) && !connectedSlugs.has(p.id)
    );
    if (visible.length === 0) return null;
    return (
      <>
        <div className="mb-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-white/80 font-semibold">📌 Quick Connect</p>
          <p className="font-mono text-[9px] text-white/60 mt-0.5">Popular integrations — click to connect, ✕ to dismiss</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visible.map(p => {
            const reg = INTEGRATIONS.find(r => r.id === p.id);
            if (!reg) return null;
            const needsNode = reg.authType === 'browser-login';
            const isConnected = items.some(i => i.slug === p.id || i.id === p.id);
            return (
              <div key={p.id} className="relative flex items-center gap-1.5 border border-white/[0.1] bg-white/[0.05] px-2.5 py-1.5 pr-6 hover:border-white/[0.3] transition-colors group">
                <IntegrationIcon provider={p.id} size={16} />
                <span className="font-mono text-[10px] text-white/80">{reg.name}</span>
                {needsNode && (
                  <span className="font-mono text-[8px] uppercase tracking-wide bg-amber-500/20 text-amber-300 px-1 py-0.5 border border-amber-400/30 leading-none">Node</span>
                )}
                {isConnected ? (
                  <span className="text-emerald-600 text-xs">✓</span>
                ) : (
                  <button
                    onClick={() => connectPopular(p.id)}
                    className="font-mono text-[9px] uppercase tracking-wide text-emerald-600 border border-white/[0.15] px-1.5 py-0.5 hover:bg-white/[0.08] transition-colors leading-none"
                  >
                    Connect
                  </button>
                )}
                {showMethodPicker === p.id && (
                  <div data-method-picker className="absolute z-50 top-full left-0 mt-1 w-64 border border-white/[0.08] bg-[#0d0d12]/95 backdrop-blur-md shadow-xl rounded-[3px]">
                    <div className="px-3 py-2 border-b border-white/[0.06]">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                        Connect {reg.name}
                      </p>
                    </div>
                    {methodPickerMethods.map(method => (
                      <button
                        key={method.type}
                        onClick={() => connectWithMethod(p.id, method.type)}
                        disabled={!method.available}
                        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors disabled:opacity-30"
                      >
                        <div>
                          <p className="font-mono text-[11px] text-white/70 text-left">{method.label}</p>
                          <p className="font-mono text-[9px] text-white/30 text-left">{method.description}</p>
                        </div>
                        {method.multiAccount && (
                          <span className="font-mono text-[8px] text-emerald-400/60 uppercase">Multi-account</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => dismissPopular(p.id)}
                  className="absolute top-0.5 right-0.5 text-white/50 hover:text-white/80 transition-colors text-[10px] leading-none w-4 h-4 flex items-center justify-center"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </>
    );
  })();

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px]"
      style={{
        backgroundImage: "url('/img/landing_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <GlassNavbar />

      <div className="flex-1 overflow-y-auto flex flex-col gap-1 md:gap-[7px] min-h-0">

        {/* Quick Connect + Maton panel */}
        <div className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              {quickConnectSection}
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {items.filter(i => i.status === 'connected').length > 0 && (
                <button
                  onClick={checkAllStatuses}
                  disabled={statusCheckInProgress}
                  className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 border border-white/[0.1] text-white/60 hover:text-white/80 hover:border-white/[0.3] transition-colors disabled:opacity-50"
                  title="Verify all integration connections"
                >
                  {statusCheckInProgress ? '⟳ Checking...' : '⟳ Verify All'}
                </button>
              )}
              <Link href="/integrations/add">
                <button className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 border border-white/[0.1] text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors flex items-center gap-1.5">
                  <Plus size={12} />
                  Add Integration
                </button>
              </Link>
            </div>
          </div>

          {/* Maton API section */}
          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-white/80">Maton API Gateway</span>
                <p className="text-xs text-white/60 mt-0.5">
                  Access 100+ cloud APIs through a single key —{' '}
                  <a href="https://maton.ai" target="_blank" rel="noreferrer" className="text-white/60 hover:text-white/80 underline">
                    maton.ai
                  </a>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="Enter Maton API key..."
                  className="bg-white/[0.06] border border-white/[0.1] rounded-[4px] px-3 py-1.5 text-xs text-white/80 placeholder:text-white/40 outline-none focus:border-white/[0.25] flex-1 sm:w-64"
                />
                <button className="px-3 py-1.5 text-xs font-medium text-white/70 border border-white/[0.1] rounded-[4px] hover:bg-white/[0.08] transition-colors flex-shrink-0">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search bar panel */}
        <div className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-4">
          <form onSubmit={handleResolve}>
            <div className="flex gap-2 items-center">
              <span className="text-lg">🔌</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder='Connect any app... e.g. "Notion, Linear, LinkedIn" or "I use Attio for CRM and check Twitter daily"'
                className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-white/40 text-white/80"
              />
              <button
                type="submit"
                disabled={resolving || !query.trim()}
                className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 bg-white/[0.12] text-white/90 hover:bg-white/[0.18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resolving ? "Resolving..." : "Connect →"}
              </button>
            </div>
          </form>
          <p className="font-mono text-[9px] text-white/70 mt-2">
            Any app, any service — we'll figure out how to connect it
          </p>
        </div>

        {/* Resolved integration cards */}
        {resolvedCards.length > 0 && (
          <div className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-white/60 mb-3">
              Found {resolvedCards.length} service{resolvedCards.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[7px]">
              {resolvedCards.map((card, i) => (
                <div key={card.resolved.slug} className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <IntegrationIcon provider={card.resolved.slug} size={36} />
                      <div>
                        <p className="font-header font-bold text-sm text-white/90">{card.resolved.name}</p>
                        <p className="font-mono text-[9px] text-white/60 uppercase">{card.resolved.category}</p>
                      </div>
                    </div>
                    {card.resolved.needsNode ? (
                      <span className="font-mono text-[9px] uppercase tracking-wide bg-amber-500/20 text-amber-300 px-2 py-0.5 border border-amber-400/30">
                        Requires Node
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] uppercase tracking-wide bg-white/[0.06] text-emerald-600 px-2 py-0.5 border border-white/[0.1]">
                        {card.resolved.authType === 'api_key' ? 'API Key' : 'OAuth'}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-white/70 mb-3">{card.resolved.description}</p>
                  {card.resolved.needsNode && (
                    <p className="font-mono text-[9px] text-amber-600 mb-3">
                      This service has no public API — your local node will use browser automation to access it.
                    </p>
                  )}
                  {card.created ? (
                    <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-600">
                      <span>✓</span> Added to integrations
                    </div>
                  ) : (
                    <button
                      onClick={() => connectResolved(i)}
                      disabled={card.creating}
                      className="w-full py-1.5 font-mono text-[10px] uppercase tracking-wide border border-white/[0.1] text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-colors disabled:opacity-50"
                    >
                      {card.creating ? "Adding..." : card.resolved.needsNode ? "Add (Browser via Node)" : "Add Integration"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integration cards grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[7px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-5 h-48 animate-pulse" />
            ))}
          </div>
        ) : hasIntegrations ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[7px]">
            {items.map((integration) => {
              const accountCount = integration.accounts.length;
              const badgeText = integration.status === "connected"
                ? (accountCount === 1 ? '1 Account' : accountCount + ' Accounts') + ' Connected'
                : integration.status === 'syncing' ? 'Waiting for login...'
                : 'Disconnected';
              const needsNode = getNeedsNode(integration);
              const liveStatus = liveStatuses[integration.slug];

              return (
                <div
                  key={integration.id}
                  className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-5"
                  style={integration.status === "connected" ? { borderColor: 'rgba(5, 150, 105, 0.3)' } : undefined}
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3 mb-3">
                    <IntegrationIcon provider={integration.slug || ""} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-header text-sm font-medium tracking-tight text-white/80">{integration.name}</h3>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {needsNode && (
                            <span className="font-mono text-[8px] uppercase tracking-wide bg-amber-500/20 text-amber-300 px-1.5 py-0.5 border border-amber-400/30">
                              Node
                            </span>
                          )}
                          {/* Live status dot */}
                          {liveStatus && integration.status === "connected" && (
                            <span
                              className="relative flex-shrink-0"
                              title={
                                liveStatus.tokenStatus === 'checking' ? 'Checking connection...' :
                                liveStatus.tokenStatus === 'valid' ? 'Connection verified' :
                                liveStatus.tokenStatus === 'refreshed' ? 'Token refreshed' :
                                liveStatus.tokenStatus === 'expired' ? 'Token expired — re-authenticate' :
                                liveStatus.tokenStatus === 'browser' ? 'Browser-based connection' :
                                'Connection error'
                              }
                            >
                              {liveStatus.tokenStatus === 'checking' ? (
                                <span className="flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                                </span>
                              ) : liveStatus.tokenStatus === 'valid' || liveStatus.tokenStatus === 'refreshed' ? (
                                <span className="flex h-2.5 w-2.5">
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-700" />
                                </span>
                              ) : liveStatus.tokenStatus === 'expired' || liveStatus.tokenStatus === 'error' ? (
                                <span className="flex h-2.5 w-2.5">
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                </span>
                              ) : liveStatus.tokenStatus === 'browser' ? (
                                <span className="flex h-2.5 w-2.5">
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400" />
                                </span>
                              ) : null}
                            </span>
                          )}
                          {/* Status badge */}
                          <span className={`font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 border ${
                            integration.status === 'connected'
                              ? 'text-emerald-600 border-emerald-700/30 bg-emerald-900/20'
                              : integration.status === 'syncing'
                              ? 'text-amber-400 border-amber-500/30 bg-amber-900/20'
                              : 'text-white/60 border-white/[0.08] bg-white/[0.03]'
                          }`}>
                            {badgeText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {needsNode && integration.status === "disconnected" && (
                    <div className="mb-3 p-2 bg-amber-500/10 border border-amber-400/30">
                      <p className="font-mono text-[9px] text-amber-300">
                        Uses browser automation.{' '}
                        <a href="/settings/nodes" className="underline">Connect your desktop via Settings</a>.
                      </p>
                    </div>
                  )}

                  {/* Token expired warning */}
                  {liveStatus?.tokenStatus === 'expired' && (
                    <div className="mb-3 p-2 bg-red-500/10 border border-red-400/30 flex items-center justify-between">
                      <p className="font-mono text-[9px] text-red-300">
                        ⚠ Token expired — re-authenticate to restore access
                      </p>
                      <button
                        onClick={() => addAccount(integration.id)}
                        className="font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Re-auth
                      </button>
                    </div>
                  )}

                  {/* Connected Accounts */}
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-white/60">Connected Accounts</span>
                    {integration.accounts.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {integration.accounts.map((account) => (
                          <div key={account.id} className="flex items-center gap-2 py-1.5 px-2 border border-white/[0.08] bg-white/[0.03]">
                            {account.picture ? (
                              <img src={account.picture} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                                <span className="font-mono text-[9px] text-emerald-600 uppercase">{(account.email || account.name || '?')[0]}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-white/80 truncate">{account.email || account.name || 'Account'}</span>
                                {account.is_default && (
                                  <span className="flex-shrink-0 font-mono text-[8px] uppercase tracking-wide bg-white/[0.06] text-emerald-600 px-1.5 py-0.5 border border-white/[0.1]">Default</span>
                                )}
                              </div>
                              <span className="font-mono text-[9px] text-white/60">Connected {account.connectedAt}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!account.is_default && (
                                <button
                                  onClick={() => setAsDefault(integration.id, account.id)}
                                  title="Set as default"
                                  className="p-1 text-white/70 hover:text-emerald-600 transition-colors"
                                >
                                  <Star size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => disconnectAccount(integration.id, account.id)}
                                title="Disconnect"
                                className="p-1 text-white/70 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-[11px] text-white/60 italic">No accounts connected</p>
                    )}
                    <button
                      onClick={() => addAccount(integration.id)}
                      className="mt-3 w-full py-2 px-3 font-mono text-[11px] uppercase tracking-wide text-emerald-600 border border-white/[0.15] hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>{integration.accounts.length > 0 ? 'Add Account' : 'Connect'}</span>
                    </button>
                  </div>

                  {integration.status === "connected" && getScopes(integration).length > 0 && (
                    <div className="mt-4">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-white/60">Scopes</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {getScopes(integration).map((scope) => (
                          <span key={scope} className="font-mono text-[10px] bg-white/[0.04] px-2 py-0.5 border border-white/[0.08] text-white/60">{scope}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="font-mono text-[10px] text-white/60 mt-4">Last sync: {integration.last_sync || "Never"}</p>

                  {/* Deep Scan */}
                  {integration.status === "connected" && (
                    <DeepScanPanel provider={integration.slug || integration.name?.toLowerCase() || ""} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 border border-white/[0.1] flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <h2 className="font-header text-xl font-bold mb-2 text-white/90">No integrations yet</h2>
            <p className="text-sm text-white/70 mb-6 max-w-md mx-auto">
              Use the search bar above to connect any app — just type what you use and we'll figure out the rest.
            </p>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-2 shrink-0" />
      </div>
    </div>
  );
}
