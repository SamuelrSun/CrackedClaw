"use client";

import { useState, useEffect } from "react";
import { X, Check, Loader2, Key, Copy, Download, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { IntegrationIcon } from "@/components/integrations/integration-icon";

const INTEGRATIONS = [
  { id: "google",      name: "Google",     hasOAuth: true },
  { id: "github",      name: "GitHub",     hasOAuth: true },
  { id: "slack",       name: "Slack",      hasOAuth: true },
  { id: "notion",      name: "Notion",     hasOAuth: true },
  { id: "linear",      name: "Linear",     hasOAuth: true },
  { id: "figma",       name: "Figma",      hasOAuth: true },
  { id: "stripe",      name: "Stripe",     hasOAuth: true },
  { id: "hubspot",     name: "HubSpot",    hasOAuth: true },
  { id: "salesforce",  name: "Salesforce", hasOAuth: true },
  { id: "jira",        name: "Jira",       hasOAuth: true },
  { id: "twitter",     name: "X / Twitter",hasOAuth: true },
  { id: "linkedin",    name: "LinkedIn",   requiresCompanion: true },
  { id: "instagram",   name: "Instagram",  requiresCompanion: true },
] as const;

interface ConnectionsPopupProps {
  onClose: () => void;
}

export function ConnectionsPopup({ onClose }: ConnectionsPopupProps) {
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [matonKey, setMatonKey] = useState("");
  const [matonSaved, setMatonSaved] = useState(false);
  const [matonSaving, setMatonSaving] = useState(false);
  const [companionConnected, setCompanionConnected] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = data?.connected ?? (Array.isArray(data) ? data : []);
        setConnectedIds(new Set(list.map((s: string) => String(s).toLowerCase())));
      })
      .catch(() => setConnectedIds(new Set()))
      .finally(() => setLoading(false));

    fetch("/api/gateway/status")
      .then(r => r.json())
      .then(d => setCompanionConnected(d?.companion === true))
      .catch(() => {});

    fetch("/api/node/connection-token")
      .then(r => r.ok ? r.json() : null)
      .then(d => setToken(d?.token ?? null))
      .catch(() => {});
  }, []);

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  }

  async function handleSaveMaton() {
    if (!matonKey.trim()) return;
    setMatonSaving(true);
    try {
      await fetch("/api/integrations/maton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: matonKey.trim() }),
      });
      setMatonSaved(true);
      setTimeout(() => setMatonSaved(false), 3000);
    } catch { /* ignore */ }
    setMatonSaving(false);
  }

  const connected = INTEGRATIONS.filter((i) => connectedIds.has(i.id));
  const available = INTEGRATIONS.filter((i) => !connectedIds.has(i.id));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div
        className="relative z-10 w-[calc(100%-2rem)] md:w-[680px] max-h-[85vh] overflow-y-auto rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[10px] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] sticky top-0 bg-black/[0.5] backdrop-blur-[10px] z-10 rounded-t-[3px]">
          <span className="text-[13px] font-semibold text-white">Connections</span>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">

          {/* ── Contact Methods (top) ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-2">Contact Methods</p>
            <div className="flex flex-col gap-1.5 text-[12px] text-white/60">
              <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-white/[0.04] border border-white/[0.06]">
                <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <span className="text-white/70 font-medium flex-1">OAuth / Companion</span>
                <span className="text-[10px] text-white/30">Connected via app</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-white/[0.04] border border-white/[0.06]">
                <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <span className="text-white/70 font-medium flex-1">SMS</span>
                <a href="/settings" onClick={onClose} className="text-[10px] text-white/40 hover:text-white/60 underline transition-colors">Configure in Settings</a>
              </div>
            </div>
          </div>

          {/* ── Desktop App ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-2">Desktop App</p>
            <div className="px-3 py-3 rounded-[4px] bg-white/[0.04] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-white/80 font-medium">Dopl Connect</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {companionConnected ? "Connected to your Mac" : "Connect your Mac for browser & app automation"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className={cn("w-3.5 h-3.5", companionConnected ? "text-emerald-400" : "text-white/20")} />
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", companionConnected ? "bg-emerald-400" : "bg-white/20")} />
                </div>
              </div>

              {/* Token */}
              <div className="space-y-1">
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Connection Token</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] text-white/60 bg-white/[0.05] border border-white/[0.08] px-2.5 py-2 truncate font-mono rounded-[3px]">
                    {token ?? "Loading…"}
                  </code>
                  <button
                    onClick={copyToken}
                    disabled={!token}
                    className="flex-shrink-0 p-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-[3px] transition-colors disabled:opacity-30"
                    title="Copy token"
                  >
                    {tokenCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/60" />}
                  </button>
                </div>
              </div>

              {/* Download link */}
              {!companionConnected && (
                <a
                  href="/downloads/dopl-connect.dmg"
                  className="flex items-center gap-2 text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download Dopl Connect
                </a>
              )}
            </div>
          </div>

          {/* ── Maton API Gateway ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-2">Maton API Gateway</p>
            <div className="px-3 py-3 rounded-[4px] bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div>
                  <p className="text-[12px] text-white/80 font-medium">100+ Cloud APIs</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Access Notion, Linear, Stripe, HubSpot &amp; more via a single key —{" "}
                    <a href="https://maton.ai" target="_blank" rel="noreferrer" className="underline hover:text-white/60 transition-colors">
                      maton.ai
                    </a>
                  </p>
                </div>
                <Key className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={matonKey}
                  onChange={(e) => setMatonKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveMaton()}
                  placeholder="Enter Maton API key..."
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white/80 text-[12px] px-3 py-2 outline-none focus:border-white/20 placeholder:text-white/25 rounded-[3px]"
                />
                <button
                  onClick={handleSaveMaton}
                  disabled={!matonKey.trim() || matonSaving}
                  className="px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70 text-[11px] rounded-[3px] transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  {matonSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : matonSaved ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                  {matonSaved ? "Saved!" : "Save"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Connected integrations ── */}
          {loading ? (
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading connections...
            </div>
          ) : connected.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-2">Connected</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {connected.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-[4px] bg-white/[0.05] border border-emerald-500/20"
                  >
                    <IntegrationIcon provider={integration.id} size={24} />
                    <span className="text-[11px] text-white/70 text-center leading-tight">{integration.name}</span>
                    <div className="flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-[9px] text-emerald-400">Connected</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Available integrations (grid) ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-2">
              {connected.length > 0 ? "Add More" : "Integrations"}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {available.map((integration) => (
                <button
                  key={integration.id}
                  onClick={() => {
                    if ("requiresCompanion" in integration && integration.requiresCompanion) return;
                    window.open(
                      `/api/integrations/oauth/start?provider=${integration.id}`,
                      "_blank",
                      "popup,width=600,height=700"
                    );
                  }}
                  disabled={"requiresCompanion" in integration && integration.requiresCompanion}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-3 py-3 rounded-[4px] border transition-colors text-left",
                    "requiresCompanion" in integration && integration.requiresCompanion
                      ? "bg-white/[0.02] border-white/[0.04] opacity-50 cursor-default"
                      : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] cursor-pointer"
                  )}
                >
                  <IntegrationIcon provider={integration.id} size={24} />
                  <span className="text-[11px] text-white/70 text-center leading-tight">{integration.name}</span>
                  {"requiresCompanion" in integration && integration.requiresCompanion ? (
                    <span className="text-[9px] text-white/25">Companion</span>
                  ) : (
                    <span className="text-[9px] text-white/40">Connect</span>
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
