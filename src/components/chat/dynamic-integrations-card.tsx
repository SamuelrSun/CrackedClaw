"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, ChevronDown, Copy, Loader2, Monitor, Plus, RefreshCw, X } from "lucide-react";
import type { ResolvedIntegration } from "@/lib/integrations/resolver";
import { IntegrationIcon } from "@/components/integrations/integration-icon";

interface DynamicIntegrationsCardProps {
  services: string[];
  gatewayHost?: string;
  onOpenBrowser?: (url: string) => void;
}

interface ConnectedAccount {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  is_default: boolean;
}

interface CardState {
  resolved: ResolvedIntegration;
  status: "idle" | "adding" | "added" | "error" | "needs_key";
  apiKeyValue?: string;
  accounts?: ConnectedAccount[];
  showAccounts?: boolean;
}

interface NodeStatus {
  isOnline: boolean;
  nodeName?: string;
}

function openOAuthPopup(provider: string): Promise<boolean> {
  const width = 600, height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(
    `/api/integrations/oauth/start?provider=${provider}`,
    `Connect ${provider}`,
    `width=${width},height=${height},left=${left},top=${top}`
  );
  if (!popup) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "oauth_complete" && e.data?.provider === provider) {
        window.removeEventListener("message", onMessage);
        clearInterval(poll);
        popup.close();
        resolve(e.data.success === true);
      }
    };
    window.addEventListener("message", onMessage);
    const poll = setInterval(() => {
      if (popup.closed) {
        window.removeEventListener("message", onMessage);
        clearInterval(poll);
        resolve(false);
      }
    }, 800);
  });
}

async function fetchAccountsForProvider(oauthSlug: string): Promise<ConnectedAccount[]> {
  try {
    const res = await fetch(`/api/integrations/accounts?provider=${oauthSlug}`);
    if (!res.ok) return [];
    const data = await res.json();
    const accountsMap: Record<string, ConnectedAccount[]> = data.accounts || {};
    return accountsMap[oauthSlug] || [];
  } catch {
    return [];
  }
}

/** Colored initial circle fallback for avatars */
function InitialAvatar({ name, email }: { name: string | null; email: string | null }) {
  const label = name?.[0] || email?.[0] || "?";
  // Deterministic hue based on the first character
  const hue = ((label.toUpperCase().charCodeAt(0) - 65) * 23) % 360;
  return (
    <div
      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white"
      style={{ backgroundColor: `hsl(${hue},55%,45%)`, fontSize: 8 }}
    >
      {label.toUpperCase()}
    </div>
  );
}

function AccountRow({ account }: { account: ConnectedAccount }) {
  const displayName = account.email || account.name || account.id;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-forest/5 rounded-sm">
      {account.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.picture}
          alt={displayName}
          className="w-4 h-4 rounded-full flex-shrink-0 object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <InitialAvatar name={account.name} email={account.email} />
      )}
      <span className="font-mono text-[11px] text-grid/80 truncate flex-1">{displayName}</span>
      {account.is_default && (
        <span className="text-[8px] uppercase tracking-wide text-forest/60 flex-shrink-0">(default)</span>
      )}
    </div>
  );
}

function NodeRequiredModal({ name, onClose, gatewayHost, loginUrl, onConnected }: { name: string; onClose: () => void; gatewayHost?: string; loginUrl?: string; onConnected?: () => void }) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkNodeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/nodes/status');
      if (res.ok) {
        const data = await res.json();
        const nodes: Array<{ status?: string; name?: string }> = data.nodes || [];
        const connected = nodes.find(n => n.status === 'connected');
        const next = { isOnline: !!connected, nodeName: connected?.name };
        // Only update if status actually changed to avoid flickering
        setNodeStatus(prev => {
          if (!prev) return next;
          if (prev.isOnline !== next.isOnline || prev.nodeName !== next.nodeName) return next;
          return prev;
        });
      }
    } catch {
      setNodeStatus(prev => prev?.isOnline ? prev : { isOnline: false });
    }
  }, []);

  useEffect(() => {
    checkNodeStatus();
    // Poll every 3 seconds
    const interval = setInterval(checkNodeStatus, 3000);
    return () => clearInterval(interval);
  }, [checkNodeStatus]);

  const handleRefresh = async () => {
    setChecking(true);
    await checkNodeStatus();
    setTimeout(() => setChecking(false), 500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("https://dopl.com/connect");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // gatewayHost is available for future use
  void gatewayHost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-paper border border-white/[0.1] p-6 max-w-md w-full mx-4 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-header font-bold text-forest text-base">Let me use your browser for this</h3>
          <button onClick={onClose} className="text-grid/40 hover:text-grid mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <p className="font-mono text-[11px] text-grid/70 leading-relaxed">
          <strong className="text-forest">{name}</strong> doesn&apos;t have a way for me to connect directly, so I&apos;ll open it in a browser on your computer — just like you&apos;d use it yourself.
        </p>

        {/* Live Connection Status Indicator */}
        <div className="p-3 border border-white/[0.1] bg-forest/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {nodeStatus === null ? (
                <>
                  <Loader2 className="w-4 h-4 text-grid/50 animate-spin" />
                  <span className="font-mono text-[10px] text-grid/60">Checking connection...</span>
                </>
              ) : nodeStatus.isOnline ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" />
                  </div>
                  <span className="font-mono text-[10px] text-green-700">
                    ✅ Connected — ready to go!
                  </span>
                </>
              ) : (
                <>
                  <div className="relative w-3 h-3">
                    <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
                    <div className="relative w-3 h-3 rounded-full bg-amber-900/200" />
                  </div>
                  <span className="font-mono text-[10px] text-amber-400">
                    ⏳ Waiting for connection...
                  </span>
                </>
              )}
            </div>
            <button 
              onClick={handleRefresh}
              disabled={checking}
              className="p-1 hover:bg-forest/10 rounded transition-colors"
              title="Check connection"
            >
              <RefreshCw className={`w-3 h-3 text-grid/50 ${checking ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {nodeStatus?.isOnline && nodeStatus.nodeName && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Monitor className="w-3 h-3 text-green-600" />
              <span className="font-mono text-[9px] text-green-700">{nodeStatus.nodeName}</span>
            </div>
          )}
        </div>

        {nodeStatus?.isOnline ? (
          <button
            onClick={() => {
              if (loginUrl) window.open(loginUrl, '_blank', 'noopener,noreferrer');
              onConnected?.();
              onClose();
            }}
            className="w-full py-2 font-mono text-[10px] uppercase tracking-wide bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-3 h-3" />
            Open in Browser
          </button>
        ) : (
          <>
            <div className="space-y-2">
              <p className="font-mono text-[11px] text-grid/70 font-bold">Here&apos;s how to set that up:</p>
              <p className="font-mono text-[10px] text-grid/60">1. Download Dopl Connect from dopl.com/connect</p>
              <p className="font-mono text-[10px] text-grid/60">2. Open the app and sign in with your Dopl account</p>
              <p className="font-mono text-[10px] text-grid/60">3. Leave the app running in the background — that&apos;s it!</p>
            </div>

            {/* Download link with Copy button */}
            <div className="relative bg-forest/5 border border-white/[0.1] p-3">
              <code className="font-mono text-[11px] text-forest break-all pr-16">
                dopl.com/connect
              </code>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 px-2 py-1 bg-forest/10 hover:bg-forest/20 text-forest font-mono text-[9px] uppercase tracking-wide transition-colors flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            
            <p className="font-mono text-[10px] text-grid/60">3. Leave that window open in the background — that&apos;s it!</p>
            
            <p className="font-mono text-[10px] text-grid/50 leading-relaxed">
              The Copy button includes your auth token. I can only do things you ask me to. Your data stays on your device and the connection is encrypted.
            </p>
            
            <button
              onClick={onClose}
              className="w-full py-2 font-mono text-[10px] uppercase tracking-wide bg-forest text-white hover:bg-forest/90 transition-colors"
            >
              Got it
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Inline companion onboarding with download + copy-token button */
function CompanionOnboardingInline({ name }: { name: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingToken, setLoadingToken] = useState(true);

  useEffect(() => {
    fetch("/api/node/connection-token")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.token) setToken(data.token); })
      .catch(() => {})
      .finally(() => setLoadingToken(false));
  }, []);

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const maskedToken = token ? `${token.slice(0, 8)}…${token.slice(-4)}` : "Loading…";

  return (
    <div className="mt-3 border-t border-white/[0.1] pt-3 space-y-3">
      <div className="space-y-2">
        <p className="font-mono text-[11px] text-grid/70 leading-relaxed">
          <strong className="text-forest">{name}</strong> doesn&apos;t have an API, so I need to browse it on your computer — just like you would.
        </p>
        <p className="font-mono text-[11px] text-grid/70 leading-relaxed">
          <strong>Dopl Connect</strong> is a lightweight desktop app that lets me do that.
        </p>
      </div>

      {/* Download button */}
      <a
        href="/downloads/Dopl-Connect.dmg"
        download
        className="block w-full py-2.5 font-mono text-[10px] uppercase tracking-wide bg-grid text-paper hover:bg-grid/80 transition-colors text-center"
      >
        ⬇ Download for macOS
      </a>

      {/* Copy token button */}
      <div className="bg-forest/5 border border-white/[0.1] p-2.5 space-y-2">
        <p className="font-mono text-[9px] uppercase tracking-wide text-grid/50">Connection Token</p>
        <div className="flex items-center gap-2">
          <code className="font-mono text-[10px] text-forest/70 truncate flex-1 select-none">
            {loadingToken ? "Loading…" : maskedToken}
          </code>
          <button
            onClick={handleCopy}
            disabled={!token}
            className="flex-shrink-0 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wide bg-forest text-white hover:bg-forest/90 disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            {copied ? (
              <><Check className="w-3 h-3" /> Copied!</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy Token</>
            )}
          </button>
        </div>
      </div>

      {/* Live connection status */}
      <div className="flex items-center gap-2 py-1.5">
        <div className="relative w-2.5 h-2.5">
          <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
          <div className="relative w-2.5 h-2.5 rounded-full bg-amber-900/200" />
        </div>
        <span className="font-mono text-[10px] text-amber-400">
          Waiting for connection...
        </span>
      </div>

      <p className="font-mono text-[9px] text-grid/40 leading-relaxed">
        Open the app, paste the token, and you&apos;re connected. Runs quietly in your menu bar.
      </p>
    </div>
  );
}

export function DynamicIntegrationsCard({ services, gatewayHost, onOpenBrowser }: DynamicIntegrationsCardProps) {
  const [cards, setCards] = useState<CardState[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodeModal, setNodeModal] = useState<string | null>(null);
  const [nodeModalCardIndex, setNodeModalCardIndex] = useState<number | null>(null);
  const [nodeModalUrl, setNodeModalUrl] = useState<string | undefined>(undefined);
  const apiKeyRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    async function resolve() {
      try {
        const res = await fetch("/api/integrations/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: services.join(", ") }),
        });
        const data = await res.json();
        const resolved: ResolvedIntegration[] = data.resolved || [];

        const slugs = resolved.map(r => r.slug);
        let connectedSlugs = new Set<string>();
        try {
          const statusRes = await fetch("/api/integrations/status-by-slugs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slugs }),
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            connectedSlugs = new Set(statusData.connected || []);
          }
        } catch { /* ignore */ }

        // Fetch all accounts for connected integrations in one call
        let allAccounts: Record<string, ConnectedAccount[]> = {};
        if (connectedSlugs.size > 0) {
          try {
            const accountsRes = await fetch('/api/integrations/accounts');
            if (accountsRes.ok) {
              const accountsData = await accountsRes.json();
              allAccounts = accountsData.accounts || {};
            }
          } catch { /* ignore */ }
        }

        setCards(resolved.map(r => {
          const isConnected = connectedSlugs.has(r.slug);
          const oauthSlug = r.oauthProvider || r.slug;
          const accounts = isConnected ? (allAccounts[oauthSlug] || []) : [];
          return {
            resolved: r,
            status: isConnected ? "added" : "idle",
            accounts: accounts.length > 0 ? accounts : undefined,
            showAccounts: accounts.length > 0,
          };
        }));
      } catch {
        setCards(services.map(name => ({
          resolved: {
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            icon: "🔌",
            authType: "oauth" as const,
            needsNode: false,
            category: "other",
            description: `Connect to ${name}`,
            capabilities: [],
            knownService: false,
          },
          status: "idle" as const,
        })));
      } finally {
        setLoading(false);
      }
    }
    resolve();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track node online status for node-gated integrations
  const [nodeOnline, setNodeOnline] = useState(false);
  const [nodeJustConnected, setNodeJustConnected] = useState(false);
  const prevNodeOnlineRef = useRef(false);
  useEffect(() => {
    const hasNodeCards = cards.some(c => c.resolved.needsNode || c.resolved.authType === "browser");
    if (!hasNodeCards) return;
    
    const check = async () => {
      try {
        const res = await fetch('/api/nodes/status');
        if (res.ok) {
          const data = await res.json();
          const nodes: Array<{ status?: string }> = data.nodes || [];
          const isOnline = nodes.some(n => n.status === 'connected');
          // Detect false → true transition
          if (isOnline && !prevNodeOnlineRef.current) {
            setNodeJustConnected(true);
            setTimeout(() => setNodeJustConnected(false), 1500);
          }
          prevNodeOnlineRef.current = isOnline;
          setNodeOnline(isOnline);
        }
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [cards]);

  const handleConnect = async (index: number) => {
    const card = cards[index];
    if (!card || card.status !== "idle") return;
    const { resolved } = card;

    // Browser-login integrations: show NodeRequiredModal to guide user
    if (resolved.needsNode || resolved.authType === "browser") {
      const urls: Record<string, string> = {
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com',
        facebook: 'https://facebook.com',
        whatsapp: 'https://web.whatsapp.com',
        youtube: 'https://youtube.com',
        twitter: 'https://twitter.com',
        reddit: 'https://reddit.com',
      };
      const url = resolved.loginUrl || urls[resolved.slug] || `https://${resolved.slug}.com`;
      setNodeModalCardIndex(index);
      setNodeModalUrl(url);
      setNodeModal(resolved.name);
      return;
    }

    // API key: show inline input
    if (resolved.authType === "api_key") {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "needs_key" } : c));
      setTimeout(() => apiKeyRefs.current[index]?.focus(), 50);
      return;
    }

    // OAuth popup for known providers
    setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "adding" } : c));
    try {
      const knownOauth = ["google", "slack", "notion", "github", "discord", "linear", "airtable", "hubspot"];
      // Use oauthProvider (for sub-services like google-sheets -> google) or fall back to slug
      const oauthSlug = resolved.oauthProvider || resolved.slug;
      const provider = knownOauth.includes(oauthSlug) ? oauthSlug : null;

      if (provider) {
        const success = await openOAuthPopup(provider);
        if (success) {
          // Fetch accounts after successful connection
          const accounts = await fetchAccountsForProvider(oauthSlug);
          setCards(prev => prev.map((c, i) =>
            i === index
              ? {
                  ...c,
                  status: "added",
                  accounts: accounts.length > 0 ? accounts : undefined,
                  showAccounts: accounts.length > 0,
                }
              : c
          ));
        } else {
          setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "idle" } : c));
        }
        return;
      }

      // Unknown OAuth — create record and mark added
      const res = await fetch("/api/integrations/create-dynamic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      const data = await res.json();
      setCards(prev => prev.map((c, i) =>
        i === index ? { ...c, status: (data.created || data.existed) ? "added" : "error" } : c
      ));
    } catch {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "error" } : c));
    }
  };

  /** Add another account for an already-connected OAuth provider */
  const handleAddAnother = async (index: number) => {
    const card = cards[index];
    if (!card) return;
    const { resolved } = card;

    const knownOauth = ["google", "slack", "notion", "github", "discord", "linear", "airtable", "hubspot"];
    const oauthSlug = resolved.oauthProvider || resolved.slug;
    const provider = knownOauth.includes(oauthSlug) ? oauthSlug : null;
    if (!provider) return;

    // Show spinner while popup is open
    setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "adding" } : c));
    const success = await openOAuthPopup(provider);
    if (success) {
      const accounts = await fetchAccountsForProvider(oauthSlug);
      setCards(prev => prev.map((c, i) =>
        i === index
          ? {
              ...c,
              status: "added",
              accounts: accounts.length > 0 ? accounts : c.accounts,
              showAccounts: true,
            }
          : c
      ));
    } else {
      // Restore added state even if popup was cancelled
      setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "added" } : c));
    }
  };

  const handleSaveApiKey = async (index: number) => {
    const card = cards[index];
    if (!card) return;
    const key = card.apiKeyValue?.trim();
    if (!key) return;

    setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "adding" } : c));
    try {
      const res = await fetch("/api/integrations/create-dynamic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: card.resolved, apiKey: key }),
      });
      const data = await res.json();
      setCards(prev => prev.map((c, i) =>
        i === index ? { ...c, status: (data.created || data.existed) ? "added" : "error" } : c
      ));
    } catch {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, status: "error" } : c));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-3 h-3 animate-spin text-grid/40" />
        <span className="font-mono text-[10px] text-grid/40">Resolving integrations...</span>
      </div>
    );
  }

  if (!cards.length) return null;

  return (
    <>
      {nodeModal && (
        <NodeRequiredModal
          name={nodeModal}
          onClose={() => { setNodeModal(null); setNodeModalCardIndex(null); setNodeModalUrl(undefined); }}
          gatewayHost={gatewayHost}
          loginUrl={nodeModalUrl}
          onConnected={() => {
            if (nodeModalCardIndex !== null) {
              setCards(prev => prev.map((c, idx) => idx === nodeModalCardIndex ? { ...c, status: "added" } : c));
            }
            if (nodeModalUrl) onOpenBrowser?.(nodeModalUrl);
          }}
        />
      )}
      <div className="flex flex-col gap-2 my-2">
        {cards.map((card, i) => {
          const accountCount = card.accounts?.length ?? 0;
          const isOAuth = card.resolved.authType === "oauth" && !card.resolved.needsNode;
          const showAccountsSection = card.status === "added" && isOAuth && accountCount > 0 && card.showAccounts;

          return (
            <div key={card.resolved.slug} className="border border-white/[0.1] bg-gray-100 p-3 max-w-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <IntegrationIcon provider={card.resolved.slug} size={24} />
                  <div className="min-w-0">
                    <p className="font-header font-bold text-sm truncate">{card.resolved.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {card.resolved.needsNode ? (
                        <span className="font-mono text-[8px] uppercase tracking-wide bg-amber-900/20 text-amber-400 px-1.5 py-0.5 border border-amber-500/30">
                          Uses your browser
                        </span>
                      ) : (
                        <span className="font-mono text-[8px] uppercase tracking-wide text-grid/40">
                          {card.resolved.authType === "api_key" ? "API Key" : "OAuth"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {card.status === "idle" && (
                  <>
                    {(card.resolved.needsNode || card.resolved.authType === "browser") ? (
                      nodeOnline ? (
                        <button
                          onClick={() => {
                            const urls: Record<string, string> = {
                              linkedin: 'https://linkedin.com',
                              instagram: 'https://instagram.com',
                              facebook: 'https://facebook.com',
                              whatsapp: 'https://web.whatsapp.com',
                              youtube: 'https://youtube.com',
                              twitter: 'https://twitter.com',
                              reddit: 'https://reddit.com',
                            };
                            const url = card.resolved.loginUrl || urls[card.resolved.slug] || `https://${card.resolved.slug}.com`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                            setCards(prev => prev.map((c, idx) => idx === i ? { ...c, status: "added" } : c));
                          }}
                          className="flex-shrink-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Ready
                        </button>
                      ) : nodeJustConnected ? (
                        <span className="flex-shrink-0 font-mono text-[10px] text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Connected!
                        </span>
                      ) : null
                    ) : (
                      <button
                        onClick={() => handleConnect(i)}
                        className="flex-shrink-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-grid text-paper hover:bg-grid/80 transition-colors"
                      >
                        Connect
                      </button>
                    )}
                  </>
                )}
                {card.status === "adding" && <Loader2 className="flex-shrink-0 w-4 h-4 animate-spin text-grid/40" />}
                {card.status === "added" && (
                  <button
                    onClick={() =>
                      isOAuth && accountCount > 0
                        ? setCards(prev => prev.map((c, idx) => idx === i ? { ...c, showAccounts: !c.showAccounts } : c))
                        : undefined
                    }
                    className={`flex-shrink-0 flex items-center gap-1 font-mono text-[10px] text-forest ${isOAuth && accountCount > 0 ? "cursor-pointer hover:text-forest/80" : "cursor-default"}`}
                  >
                    <Check className="w-3 h-3" />
                    Connected{accountCount > 1 ? ` (${accountCount})` : ""}
                    {isOAuth && accountCount > 0 && (
                      <ChevronDown className={`w-3 h-3 transition-transform ${card.showAccounts ? "rotate-180" : ""}`} />
                    )}
                  </button>
                )}
                {card.status === "error" && (
                  <button
                    onClick={() => setCards(prev => prev.map((c, idx) => idx === i ? { ...c, status: "idle" } : c))}
                    className="flex-shrink-0 font-mono text-[10px] text-coral hover:underline"
                  >
                    Try again
                  </button>
                )}
                {card.status === "needs_key" && (
                  <button
                    onClick={() => setCards(prev => prev.map((c, idx) => idx === i ? { ...c, status: "idle" } : c))}
                    className="flex-shrink-0 text-grid/40 hover:text-grid"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Inline Companion onboarding for browser-gated cards when node is offline */}
              {(card.resolved.needsNode || card.resolved.authType === 'browser') && card.status === "idle" && !nodeOnline && !nodeJustConnected && (
                <CompanionOnboardingInline name={card.resolved.name} />
              )}

              {/* Connected Accounts section */}
              {showAccountsSection && (
                <div className="mt-2 border border-white/[0.1] p-2 space-y-1">
                  <p className="font-mono text-[8px] uppercase tracking-wide text-grid/40 mb-1.5">Connected Accounts</p>
                  {card.accounts!.map(account => (
                    <AccountRow key={account.id} account={account} />
                  ))}
                  <button
                    onClick={() => handleAddAnother(i)}
                    className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-forest hover:text-forest/80 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Connect another account
                  </button>
                </div>
              )}

              {/* "adding another" spinner when re-opening OAuth from already-connected state */}
              {card.status === "adding" && accountCount > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-grid/40" />
                  <span className="font-mono text-[10px] text-grid/40">Connecting…</span>
                </div>
              )}

              {card.status === "needs_key" && (
                <div className="mt-3 flex gap-2">
                  <input
                    ref={el => { apiKeyRefs.current[i] = el; }}
                    type="password"
                    placeholder={card.resolved.apiKeyLabel || "Paste API key…"}
                    value={card.apiKeyValue || ""}
                    onChange={e => setCards(prev => prev.map((c, idx) => idx === i ? { ...c, apiKeyValue: e.target.value } : c))}
                    onKeyDown={e => e.key === "Enter" && handleSaveApiKey(i)}
                    className="flex-1 font-mono text-[11px] border border-white/[0.1] px-2 py-1.5 bg-white focus:outline-none focus:border-forest"
                  />
                  <button
                    onClick={() => handleSaveApiKey(i)}
                    disabled={!card.apiKeyValue?.trim()}
                    className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-forest text-white hover:bg-forest/90 disabled:opacity-40 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
