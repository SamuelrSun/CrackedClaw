"use client";

import { useState, useEffect } from "react";
import { Globe, Download, ExternalLink, Copy, Check } from "lucide-react";

interface BrowserRelayCardProps {
  onDownload?: () => void;
}

export function BrowserRelayCard({ onDownload }: BrowserRelayCardProps) {
  const [connectionKey, setConnectionKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/instance/connection-key")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.key) setConnectionKey(data.key); })
      .catch(() => {});
  }, []);

  const handleCopy = async () => {
    if (!connectionKey) return;
    try {
      await navigator.clipboard.writeText(connectionKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // Truncate key for display: first 12 + … + last 4
  const displayKey = connectionKey
    ? `${connectionKey.slice(0, 12)}…${connectionKey.slice(-4)}`
    : null;

  return (
    <div className="my-2 rounded-[6px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
          <Globe className="w-5 h-5 text-white/50" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-white/90">Browser Relay</p>
          <p className="text-[11px] text-white/40 mt-0.5 leading-snug">
            Chrome extension that lets your AI see and interact with your browser tabs
          </p>
        </div>
      </div>

      {/* Connection Key section */}
      <div className="px-4 pb-3 space-y-2">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-[4px] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-white/30 mb-1.5">Your Connection Key</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-[10px] text-white/60 truncate select-none">
              {connectionKey ? displayKey : "Loading…"}
            </code>
            <button
              onClick={handleCopy}
              disabled={!connectionKey}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-[3px] bg-white/[0.08] hover:bg-white/[0.14] text-white/60 hover:text-white/90 disabled:opacity-30 transition-colors"
              title="Copy connection key"
            >
              {copied ? (
                <><Check className="w-3 h-3 text-emerald-400" /><span className="text-[9px] text-emerald-400">Copied!</span></>
              ) : (
                <><Copy className="w-3 h-3" /><span className="text-[9px]">Copy</span></>
              )}
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-0.5">
          <p className="text-[10px] text-white/40 leading-relaxed">
            1. Download &amp; install the extension below
          </p>
          <p className="text-[10px] text-white/40 leading-relaxed">
            2. Paste your connection key in the extension options
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-white/[0.06]">
        <a
          href="/api/download/browser-relay"
          download
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium text-white/70 hover:text-white/90 hover:bg-white/[0.04] transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download Extension
        </a>
        <div className="w-px bg-white/[0.06]" />
        <a
          href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Setup Guide
        </a>
      </div>
    </div>
  );
}
