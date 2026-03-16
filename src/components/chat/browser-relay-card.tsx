"use client";

import { Globe, Download, ExternalLink } from "lucide-react";

interface BrowserRelayCardProps {
  onDownload?: () => void;
}

export function BrowserRelayCard({ onDownload }: BrowserRelayCardProps) {
  return (
    <div className="my-2 rounded-[6px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm overflow-hidden max-w-sm">
      <div className="flex items-center gap-3 p-4">
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
