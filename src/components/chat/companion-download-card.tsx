"use client";

import { useState, useEffect } from "react";
import { Download, Copy, Check, Monitor } from "lucide-react";

export function CompanionDownloadCard() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch("/api/node/connection-token")
      .then(r => r.ok ? r.json() : null)
      .then(d => setToken(d?.token ?? null))
      .catch(() => {})
      .finally(() => setTokenLoading(false));

    fetch("/api/gateway/status")
      .then(r => r.json())
      .then(d => setConnected(d?.companion === true))
      .catch(() => {});
  }, []);

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="my-2 rounded-[6px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
          <Monitor className="w-5 h-5 text-white/50" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium text-white/90">Dopl Connect</p>
            {connected && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Connected
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/40 mt-0.5 leading-snug">
            Desktop companion for browser &amp; app automation
          </p>
        </div>
      </div>

      {/* Connection Token */}
      <div className="px-4 pb-3 space-y-2">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-[4px] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-white/30 mb-1.5">Connection Token</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-[10px] text-white/60 truncate">
              {tokenLoading ? "Loading…" : (token ?? "Unavailable")}
            </code>
            <button
              onClick={copyToken}
              disabled={!token}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-[3px] bg-white/[0.08] hover:bg-white/[0.14] text-white/60 hover:text-white/90 disabled:opacity-30 transition-colors"
              title="Copy connection token"
            >
              {copied ? (
                <><Check className="w-3 h-3 text-emerald-400" /><span className="text-[9px] text-emerald-400">Copied!</span></>
              ) : (
                <><Copy className="w-3 h-3" /><span className="text-[9px]">Copy</span></>
              )}
            </button>
          </div>
        </div>

        {/* Setup steps */}
        {!connected && (
          <div className="space-y-0.5">
            <p className="text-[10px] text-white/40 leading-relaxed">1. Download &amp; install the app below</p>
            <p className="text-[10px] text-white/40 leading-relaxed">2. Open Dopl Connect and paste the token above</p>
            <p className="text-[10px] text-white/40 leading-relaxed">3. No permissions required to get started — grant them later for full automation</p>
          </div>
        )}

        {/* Permission note */}
        <p className="text-[10px] text-white/25 leading-relaxed pt-0.5">
          No permissions required to get started — the app works without Accessibility, Screen Recording, etc. Grant them later for full automation.
        </p>
      </div>

      {/* Actions */}
      {!connected && (
        <div className="flex border-t border-white/[0.06]">
          <a
            href="/downloads/dopl-connect.dmg"
            download
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium text-white/70 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download Dopl Connect (.dmg)
          </a>
        </div>
      )}
    </div>
  );
}
