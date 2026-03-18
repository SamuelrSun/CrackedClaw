"use client";

import { useState, useEffect, useRef } from "react";
import { Globe, Download, ExternalLink } from "lucide-react";

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

export function ComputerPopup({ onClose }: ComputerPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<NodeStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch node status on open
  useEffect(() => {
    let cancelled = false;
    fetch("/api/nodes/status")
      .then((r) => r.json())
      .then((data: NodeStatusResponse) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ connected: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Click-outside handled by overlay onClick

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-[calc(100%-2rem)] md:w-[420px] rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[10px] shadow-2xl"
        onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Desktop Companion</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Status indicator */}
        <div className="flex items-center gap-2.5">
          {loading ? (
            <span className="text-white/40 text-sm">Checking status…</span>
          ) : status?.connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />
              <div>
                <div className="text-sm text-white font-medium">Connected</div>
                {status.deviceName && (
                  <div className="text-xs text-white/40">{status.deviceName}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_#f87171]" />
              <div className="text-sm text-white/70 font-medium">Not Connected</div>
            </>
          )}
        </div>

        {/* Connected state */}
        {!loading && status?.connected && (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-white/50">Browser automation is active.</div>
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Enables</div>
              <div className="flex flex-col gap-1 text-xs text-white/60">
                <div>🔗 LinkedIn — Profile, connections, messaging</div>
                <div>📸 Instagram — Posts, stories, DMs</div>
                <div>🌐 Any browser-based service</div>
              </div>
            </div>
            {status.permissions && (
              <div>
                <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Permissions</div>
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
        )}

        {/* Not connected state */}
        {!loading && !status?.connected && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/50 leading-relaxed">
              Download the companion app to enable browser automation for LinkedIn, Instagram, and more.
            </p>
            <a
              href="/api/download/companion"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-[6px] bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-sm text-white/80 hover:text-white transition-colors font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              Download Companion
            </a>
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Setup</div>
              <div className="flex flex-col gap-1.5 text-xs text-white/50">
                <div className="flex gap-2"><span className="text-white/30 font-medium w-4 shrink-0">1.</span><span>Download &amp; install the app</span></div>
                <div className="flex gap-2"><span className="text-white/30 font-medium w-4 shrink-0">2.</span><span>Open it and scan the QR code</span></div>
                <div className="flex gap-2"><span className="text-white/30 font-medium w-4 shrink-0">3.</span><span>Grant Accessibility &amp; Screen Recording permissions</span></div>
              </div>
            </div>
            <div className="text-[11px] text-white/30 border-t border-white/[0.06] pt-2">
              Enables: LinkedIn, Instagram, and any browser-based service
            </div>
          </div>
        )}

        {/* Browser Relay section */}
        {!loading && (
          <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-white/50" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Browser Relay</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Chrome extension that lets your AI see and interact with your browser tabs.
            </p>
            <div className="flex gap-2">
              <a
                href="/api/download/browser-relay"
                download
                className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-[6px] bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-xs text-white/80 hover:text-white transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Download Extension
              </a>
              <a
                href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Setup Guide
              </a>
            </div>
            <div>
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Setup</div>
              <div className="flex flex-col gap-1.5 text-xs text-white/50">
                <div className="flex gap-2"><span className="text-white/30 font-medium w-4 shrink-0">1.</span><span>Download the extension</span></div>
                <div className="flex gap-2"><span className="text-white/30 font-medium w-4 shrink-0">2.</span><span>Open <span className="text-white/40 font-mono">chrome://extensions</span></span></div>
                <div className="flex gap-2"><span className="text-white/30 font-medium w-4 shrink-0">3.</span><span>Enable &quot;Developer mode&quot; and click &quot;Load unpacked&quot;</span></div>
                <div className="flex gap-2"><span className="text-white/30 font-medium w-4 shrink-0">4.</span><span>Select the downloaded folder</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
