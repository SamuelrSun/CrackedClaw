"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Copy, Loader2, Monitor, RefreshCw, X } from "lucide-react";
import type { ResolvedIntegration } from "@/lib/integrations/resolver";
import { IntegrationIcon } from "@/components/integrations/integration-icon";

interface DynamicIntegrationsCardProps {
  services: string[];
  gatewayHost?: string;
  onOpenBrowser?: (url: string) => void;
}

interface CardState {
  resolved: ResolvedIntegration;
  status: "idle" | "adding" | "added" | "error" | "needs_key";
  apiKeyValue?: string;
}

interface NodeStatus {
  isOnline: boolean;
  nodeName?: string;
  gatewayUrl?: string;
  authToken?: string;
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

// Parse gateway URL to extract host
function parseGatewayHost(url: string | null): string {
  if (!url) return "your-workspace.crackedclaw.com";
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "your-workspace.crackedclaw.com";
  }
}

function NodeRequiredModal({ name, onClose, gatewayHost, loginUrl, onConnected }: { name: string; onClose: () => void; gatewayHost?: string; loginUrl?: string; onConnected?: () => void }) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkNodeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/node/status');
      if (res.ok) {
        const data = await res.json();
        // Only update if status actually changed to avoid flickering
        setNodeStatus(prev => {
          if (!prev) return data;
          if (prev.isOnline !== data.isOnline || prev.nodeName !== data.nodeName) return data;
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
    const token = nodeStatus?.authToken || "YOUR_TOKEN";
    const fullCommand = `crackedclaw-connect --token ${token} --server wss://companion.crackedclaw.com/api/companion/ws`;
    
    try {
      await navigator.clipboard.writeText(fullCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const displayHost = nodeStatus?.gatewayUrl 
    ? parseGatewayHost(nodeStatus.gatewayUrl) 
    : (gatewayHost || "your-workspace.crackedclaw.com");

  const maskedCommand = nodeStatus?.authToken
    ? `crackedclaw-connect --token ${nodeStatus.authToken} --server wss://companion.crackedclaw.com/api/companion/ws`
    : `crackedclaw-connect --token YOUR_TOKEN --server wss://companion.crackedclaw.com/api/companion/ws`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-paper border border-[rgba(58,58,56,0.2)] p-6 max-w-md w-full mx-4 space-y-4"
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
        <div className="p-3 border border-[rgba(58,58,56,0.15)] bg-forest/5">
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
                    <div className="relative w-3 h-3 rounded-full bg-amber-500" />
                  </div>
                  <span className="font-mono text-[10px] text-amber-700">
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
              <p className="font-mono text-[10px] text-grid/60">1. Download CrackedClaw Connect from crackedclaw.com/connect</p>
              <p className="font-mono text-[10px] text-grid/60">2. Open <strong>Terminal</strong> on your Mac and paste the command below:</p>
            </div>
            
            {/* Command box with Copy button */}
            <div className="relative bg-forest/5 border border-[rgba(58,58,56,0.15)] p-3">
              <code className="font-mono text-[11px] text-forest break-all pr-16">
                {maskedCommand}
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

        setCards(resolved.map(r => ({
          resolved: r,
          status: connectedSlugs.has(r.slug) ? "added" : "idle",
        })));
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
  useEffect(() => {
    const hasNodeCards = cards.some(c => c.resolved.needsNode || c.resolved.authType === "browser");
    if (!hasNodeCards) return;
    
    const check = async () => {
      try {
        const res = await fetch('/api/node/status');
        if (res.ok) {
          const data = await res.json();
          setNodeOnline(data.isOnline);
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
        setCards(prev => prev.map((c, i) => i === index ? { ...c, status: success ? "added" : "idle" } : c));
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
        {cards.map((card, i) => (
          <div key={card.resolved.slug} className="border border-[rgba(58,58,56,0.2)] bg-gray-100 p-3 max-w-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <IntegrationIcon provider={card.resolved.slug} size={24} />
                <div className="min-w-0">
                  <p className="font-header font-bold text-sm truncate">{card.resolved.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {card.resolved.needsNode ? (
                      <span className="font-mono text-[8px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 border border-amber-200">
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
                <button
                  onClick={() => handleConnect(i)}
                  className="flex-shrink-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide bg-grid text-paper hover:bg-grid/80 transition-colors"
                >
                  {(card.resolved.needsNode || card.resolved.authType === "browser") && nodeOnline
                    ? "Ready ✓"
                    : "Connect"}
                </button>
              )}
              {card.status === "adding" && <Loader2 className="flex-shrink-0 w-4 h-4 animate-spin text-grid/40" />}
              {card.status === "added" && (
                <span className="flex-shrink-0 flex items-center gap-1 font-mono text-[10px] text-forest">
                  <Check className="w-3 h-3" /> Connected
                </span>
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

            {card.status === "needs_key" && (
              <div className="mt-3 flex gap-2">
                <input
                  ref={el => { apiKeyRefs.current[i] = el; }}
                  type="password"
                  placeholder={card.resolved.apiKeyLabel || "Paste API key…"}
                  value={card.apiKeyValue || ""}
                  onChange={e => setCards(prev => prev.map((c, idx) => idx === i ? { ...c, apiKeyValue: e.target.value } : c))}
                  onKeyDown={e => e.key === "Enter" && handleSaveApiKey(i)}
                  className="flex-1 font-mono text-[11px] border border-[rgba(58,58,56,0.2)] px-2 py-1.5 bg-white focus:outline-none focus:border-forest"
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
        ))}
      </div>
    </>
  );
}
