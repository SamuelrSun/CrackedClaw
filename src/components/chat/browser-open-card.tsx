"use client";

import { useState } from "react";
import { ExternalLink, Globe, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BrowserOpenCardProps {
  url: string;
  message?: string;
}

export function BrowserOpenCard({ url, message }: BrowserOpenCardProps) {
  const [opened, setOpened] = useState(false);

  const displayUrl = (() => {
    try {
      const u = new URL(url);
      return u.hostname.replace("www.", "");
    } catch {
      return url;
    }
  })();

  const favicon = (() => {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch {
      return null;
    }
  })();

  const handleOpen = () => {
    window.open(url, "_blank", "noopener,noreferrer");
    setOpened(true);
  };

  return (
    <div className={cn(
      "my-2 border rounded-lg overflow-hidden font-mono text-xs max-w-sm transition-all duration-200",
      opened ? "border-green-400/30 bg-green-50/30" : "border-[#1A3C2B]/20 bg-[#1A3C2B]/[0.03]"
    )}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" className="w-4 h-4 flex-shrink-0" />
        ) : (
          <Globe className="w-4 h-4 text-[#1A3C2B] flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-gray-700 truncate">{displayUrl}</p>
          {message && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{message}</p>}
        </div>
        <button
          onClick={handleOpen}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors flex-shrink-0",
            opened
              ? "bg-green-100 text-green-700"
              : "bg-[#1A3C2B] text-white hover:bg-[#24503a]"
          )}
        >
          {opened ? (
            <>
              <CheckCircle className="w-3 h-3" />
              Opened
            </>
          ) : (
            <>
              <ExternalLink className="w-3 h-3" />
              Open
            </>
          )}
        </button>
      </div>
    </div>
  );
}
