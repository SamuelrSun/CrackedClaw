"use client";

import { useState, useEffect, useRef } from "react";
import { Globe, Download, Copy, Check } from "lucide-react";

interface NodeStatusResponse {
  connected: boolean;
  deviceName?: string;
  permissions?: {
    accessibility?: boolean;
    screenRecording?: boolean;
  };
}

interface ComputerPopupProps {
  onClose: () => void;
}

function useConnectionKey() {
  const [key, setKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/instance/connection-key")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setKey(data?.key ?? data?.connectionKey ?? null);
      })
      .catch(() => {
        if (!cancelled) setKey(null);
      })
      .finally(() => {
        if (!cancelled) setKeyLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const displayKey = key
    ? `${key.slice(0, 12)}…${key.slice(-4)}`
    : null;

  return { key, displayKey, keyLoading };
}

function useCompanionToken() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/node/connection-token")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setToken(data?.token ?? null);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setTokenLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const displayToken = token
    ? `${token.slice(0, 12)}…${token.slice(-4)}`
    : null;

  return { token, displayToken, tokenLoading };
}


function TokenPill({ displayKey, keyLoading, onCopy }: {
  displayKey: string | null;
  keyLoading: boolean;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="text-[11px] text-white/30 mb-1">Connection Token</div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-white/[0.04] border border-white/[0.08]">
        {keyLoading ? (
          <code className="text-[11px] text-white/30 font-mono flex-1 truncate animate-pulse">
            Loading…
          </code>
        ) : displayKey ? (
          <code className="text-[11px] text-white/50 font-mono flex-1 truncate">
            {displayKey}
          </code>
        ) : (
          <code className="text-[11px] text-white/30 font-mono flex-1 truncate italic">
            unavailable
          </code>
        )}
        <button
          onClick={handleCopy}
          disabled={!displayKey}
          className="text-white/40 hover:text-white/70 transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

export function ComputerPopup({ onClose }: ComputerPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<NodeStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const { key, displayKey, keyLoading } = useConnectionKey();
  const { token: companionToken, displayToken: companionDisplayToken, tokenLoading: companionTokenLoading } = useCompanionToken();

  // Fetch node status on open + poll every 5s
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch("/api/nodes/status")
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          // API returns { nodes: [{ name, status }] } — map to our interface
          const nodes: Array<{ name?: string; status?: string }> = data.nodes || [];
          const connectedNode = nodes.find(n => n.status === 'connected');
          setStatus({
            connected: !!connectedNode,
            deviceName: connectedNode?.name,
          });
        })
        .catch(() => {
          if (!cancelled) setStatus({ connected: false });
        })
        .finally(() => {
          if (!cancelled) setStatusLoading(false);
        });
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const copyToken = () => {
    if (key) navigator.clipboard.writeText(key).catch(() => {});
  };

  const copyCompanionToken = () => {
    if (companionToken) navigator.clipboard.writeText(companionToken).catch(() => {});
  };

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-[calc(100%-2rem)] md:w-[420px] rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[10px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-white/[0.08] flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Connections</span>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5">

          {/* ── Browser Relay Section ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-white/50" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Browser Relay
              </span>
            </div>

            <p className="text-xs text-white/50 leading-relaxed">
              Chrome extension that lets your AI see and interact with your browser tabs.
            </p>

            {/* Download Extension — full width */}
            <a
              href="/api/download/browser-relay"
              download
              className="flex items-center justify-center gap-2 w-full py-2 rounded-[6px] bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-sm text-white/80 hover:text-white transition-colors font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Download Extension
            </a>

            {/* Token pill */}
            <TokenPill displayKey={displayKey} keyLoading={keyLoading} onCopy={copyToken} />

            {/* Setup instructions */}
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Setup
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-white/50">
                <div className="flex gap-2">
                  <span className="text-white/30 font-medium w-4 shrink-0">1.</span>
                  <span>Download the extension and unzip the folder</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-white/30 font-medium w-4 shrink-0">2.</span>
                  <span>
                    Open{" "}
                    <code className="text-white/40 font-mono bg-white/[0.06] px-1 py-0.5 rounded text-[10px]">
                      chrome://extensions
                    </code>
                    {" "}in Chrome
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-white/30 font-medium w-4 shrink-0">3.</span>
                  <span>
                    Enable <span className="text-white/40">&quot;Developer mode&quot;</span> (toggle, top-right) and click{" "}
                    <span className="text-white/40">&quot;Load unpacked&quot;</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-white/30 font-medium w-4 shrink-0">4.</span>
                  <span>Select the unzipped folder</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-white/30 font-medium w-4 shrink-0">5.</span>
                  <span>
                    Pin the extension — click the 🧩 puzzle piece in Chrome toolbar, then pin{" "}
                    <span className="text-white/40">&quot;Dopl Browser Relay&quot;</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-white/30 font-medium w-4 shrink-0">6.</span>
                  <span>
                    Click the Dopl extension icon on any tab to attach it. Badge shows{" "}
                    <span className="text-white/40 font-mono">&quot;ON&quot;</span> when active.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-white/[0.08]" />

          {/* ── Desktop Companion Section ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Desktop Companion
              </span>
              {/* Status indicator lives here */}
              {statusLoading ? (
                <span className="text-[11px] text-white/30 animate-pulse">Checking…</span>
              ) : status?.connected ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_#4ade80]" />
                  <span className="text-[11px] text-green-400 font-medium">Connected</span>
                  {status.deviceName && (
                    <span className="text-[11px] text-white/30">· {status.deviceName}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_5px_#f87171]" />
                  <span className="text-[11px] text-white/50">Not connected</span>
                </div>
              )}
            </div>

            {/* Connected state */}
            {!statusLoading && status?.connected ? (
              <div className="flex flex-col gap-2">
                <div className="text-xs text-white/50">Browser automation is active.</div>
                <div>
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                    Enables
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-white/60">
                    <div>🔗 LinkedIn — Profile, connections, messaging</div>
                    <div>📸 Instagram — Posts, stories, DMs</div>
                    <div>🌐 Any browser-based service</div>
                  </div>
                </div>
                {status.permissions && (
                  <div>
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">
                      Permissions
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={status.permissions.accessibility ? "text-green-400" : "text-red-400"}>
                          {status.permissions.accessibility ? "✓" : "✗"}
                        </span>
                        <span className="text-white/60">Accessibility</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={status.permissions.screenRecording ? "text-green-400" : "text-red-400"}>
                          {status.permissions.screenRecording ? "✓" : "✗"}
                        </span>
                        <span className="text-white/60">Screen Recording</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Not connected state */
              <div className="flex flex-col gap-3">
                <p className="text-xs text-white/50 leading-relaxed">
                  Download the companion app to enable browser automation for LinkedIn, Instagram, and more.
                </p>

                {/* Download Companion — full width */}
                <a
                  href="/api/download/companion"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-[6px] bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-sm text-white/80 hover:text-white transition-colors font-medium"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  Download Companion
                </a>

                {/* Token pill */}
                <TokenPill displayKey={companionDisplayToken} keyLoading={companionTokenLoading} onCopy={copyCompanionToken} />

                {/* Setup instructions */}
                <div>
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                    Setup
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs text-white/50">
                    <div className="flex gap-2">
                      <span className="text-white/30 font-medium w-4 shrink-0">1.</span>
                      <span>Download &amp; install Dopl Connect</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-white/30 font-medium w-4 shrink-0">2.</span>
                      <span>Open the app and paste your connection token</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-white/30 font-medium w-4 shrink-0">3.</span>
                      <span>Grant Accessibility &amp; Screen Recording permissions when prompted</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-white/30 font-medium w-4 shrink-0">4.</span>
                      <span>Status will show &quot;Connected&quot; once paired</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-white/30 border-t border-white/[0.06] pt-2">
                  Enables: LinkedIn, Instagram, and any browser-based service
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
