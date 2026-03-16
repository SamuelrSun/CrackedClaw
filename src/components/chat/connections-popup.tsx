"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const AVAILABLE_INTEGRATIONS = [
  { id: 'google', name: 'Google', desc: 'Gmail, Calendar, Drive, Contacts', icon: '🔵', hasOAuth: true },
  { id: 'slack', name: 'Slack', desc: 'Messages, channels, notifications', icon: '💬', hasOAuth: true },
  { id: 'github', name: 'GitHub', desc: 'Repos, issues, PRs, actions', icon: '🐙', hasOAuth: true },
  { id: 'notion', name: 'Notion', desc: 'Pages, databases, wikis', icon: '📝', hasOAuth: true },
  { id: 'linear', name: 'Linear', desc: 'Issues, projects, cycles', icon: '🔷', hasOAuth: true },
  { id: 'figma', name: 'Figma', desc: 'Designs, files, comments', icon: '🎨', hasOAuth: true },
  { id: 'stripe', name: 'Stripe', desc: 'Payments, subscriptions, invoices', icon: '💳', hasOAuth: true },
  { id: 'hubspot', name: 'HubSpot', desc: 'CRM, contacts, deals', icon: '🟠', hasOAuth: true },
  { id: 'salesforce', name: 'Salesforce', desc: 'CRM, leads, opportunities', icon: '☁️', hasOAuth: true },
  { id: 'jira', name: 'Jira', desc: 'Issues, sprints, boards', icon: '🔵', hasOAuth: true },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Profile, connections, messaging', icon: '🔗', requiresCompanion: true },
  { id: 'instagram', name: 'Instagram', desc: 'Posts, stories, DMs', icon: '📸', requiresCompanion: true },
  { id: 'twitter', name: 'X / Twitter', desc: 'Posts, DMs, notifications', icon: '🐦', hasOAuth: true },
] as const;

interface ConnectedIntegration {
  id: string;
  provider: string;
  email?: string;
  status: string;
}

interface ConnectionsPopupProps {
  onClose: () => void;
}

export function ConnectionsPopup({ onClose }: ConnectionsPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Fetch connected integrations on open
  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setConnected(Array.isArray(data) ? data : (data?.integrations ?? []));
        }
      })
      .catch(() => {
        if (!cancelled) setConnected([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Click-outside handled by overlay onClick

  const connectedIds = new Set(connected.map((c) => c.id ?? c.provider));

  const filtered = AVAILABLE_INTEGRATIONS.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative z-10 w-[480px] max-h-[70vh] overflow-y-auto flex flex-col gap-0 rounded-[10px] border border-white/[0.1] bg-white/[0.08] backdrop-blur-[20px] shadow-2xl"
        onClick={e => e.stopPropagation()}
      style={{ scrollbarWidth: "thin" }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-white/[0.08] flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-[10px] z-10 rounded-t-[10px]">
        <span className="text-sm font-semibold text-white">Connections</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* Connected section */}
        {loadingStatus ? (
          <div className="text-white/40 text-xs">Loading connected integrations…</div>
        ) : connected.length > 0 ? (
          <div>
            <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Connected</div>
            <div className="flex flex-col gap-1.5">
              {connected.map((c) => {
                const meta = AVAILABLE_INTEGRATIONS.find((i) => i.id === (c.id ?? c.provider));
                return (
                  <div
                    key={c.id ?? c.provider}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[6px] bg-white/[0.04] border border-white/[0.06]"
                  >
                    <span className="text-base leading-none">{meta?.icon ?? "🔌"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/90 font-medium leading-tight truncate">{meta?.name ?? c.provider}</div>
                      {c.email && <div className="text-xs text-white/40 truncate">{c.email}</div>}
                    </div>
                    <span className="text-[10px] font-medium text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                      Connected
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-white/30 text-xs">No integrations connected yet.</div>
        )}

        {/* Add Connection section */}
        <div>
          <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Add Connection</div>
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations…"
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[6px] px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-white/20 mb-2"
          />
          <div className="flex flex-col gap-1.5">
            {filtered.map((integration) => {
              const isConnected = connectedIds.has(integration.id);
              return (
                <div
                  key={integration.id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-[6px] border transition-colors",
                    isConnected
                      ? "bg-white/[0.03] border-white/[0.04] opacity-60"
                      : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.07]"
                  )}
                >
                  <span className="text-base leading-none">{integration.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium leading-tight">{integration.name}</div>
                    <div className="text-xs text-white/40 truncate">{integration.desc}</div>
                  </div>
                  {isConnected ? (
                    <span className="text-[10px] font-medium text-green-400/70 whitespace-nowrap">✓ Done</span>
                  ) : "requiresCompanion" in integration && integration.requiresCompanion ? (
                    <span className="text-[10px] text-white/30 whitespace-nowrap">Companion</span>
                  ) : (
                    <button
                      onClick={() =>
                        window.open(
                          `/api/integrations/oauth/start?provider=${integration.id}`,
                          "_blank",
                          "popup,width=600,height=700"
                        )
                      }
                      className="text-xs font-medium text-white/70 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] rounded-[4px] px-2.5 py-1 transition-colors whitespace-nowrap"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-white/30 text-xs py-2">No integrations match your search.</div>
            )}
          </div>
        </div>

        {/* Connection Methods */}
        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Connection Methods</div>
          <div className="flex flex-col gap-1.5 text-xs text-white/50">
            <div>☁️ <span className="text-white/70 font-medium">OAuth</span> — One-click connect for Google, Slack, GitHub &amp; more</div>
            <div>🔑 <span className="text-white/70 font-medium">Maton</span> — API gateway for 100+ services. Get your key at maton.ai</div>
            <div>🖥️ <span className="text-white/70 font-medium">Companion</span> — Desktop app for browser-based services (LinkedIn, Instagram)</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
