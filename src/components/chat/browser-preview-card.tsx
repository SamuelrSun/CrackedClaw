"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Globe, UserCheck, X, Loader2 } from "lucide-react";

export interface BrowserPreviewCardProps {
  screenshotUrl?: string;
  currentUrl?: string;
  status: "browsing" | "waiting-login" | "complete" | "error";
  message?: string;
  onOpenPopup: () => void;
  onTakeControl: () => void;
  onIgnore: () => void;
}

const STATUS_LABELS: Record<BrowserPreviewCardProps["status"], string> = {
  browsing: "Browsing",
  "waiting-login": "Waiting for login",
  complete: "Automation complete",
  error: "Error",
};

export function BrowserPreviewCard({
  screenshotUrl: initialScreenshotUrl,
  currentUrl,
  status,
  message,
  onOpenPopup,
  onTakeControl,
  onIgnore,
}: BrowserPreviewCardProps) {
  const [screenshot, setScreenshot] = useState<string | undefined>(initialScreenshotUrl);
  const [dismissed, setDismissed] = useState(false);

  const fetchScreenshot = useCallback(async () => {
    try {
      const res = await fetch("/api/gateway/browser/screenshot");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setScreenshot((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (dismissed || status === "complete") return;
    // Poll every 2s
    const interval = setInterval(fetchScreenshot, 2000);
    return () => clearInterval(interval);
  }, [dismissed, status, fetchScreenshot]);

  const handleIgnore = () => {
    setDismissed(true);
    onIgnore();
  };

  if (dismissed) return null;

  const displayUrl = currentUrl
    ? (() => {
        try { return new URL(currentUrl).hostname.replace("www.", ""); }
        catch { return currentUrl; }
      })()
    : null;

  const isWaiting = status === "waiting-login";

  return (
    <div className={cn(
      "my-2 border rounded-lg overflow-hidden font-mono text-xs transition-all duration-200 max-w-sm",
      isWaiting ? "border-amber-400/30 bg-amber-50/30" : "border-[#1A3C2B]/20 bg-[#1A3C2B]/[0.03]"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-inherit">
        <Globe className="w-3.5 h-3.5 text-[#1A3C2B] flex-shrink-0" />
        <span className="text-[#1A3C2B] font-medium truncate">
          {STATUS_LABELS[status]}{displayUrl ? ` · ${displayUrl}` : ""}
        </span>
        <button onClick={handleIgnore} className="ml-auto text-grid/40 hover:text-grid/70 transition-colors flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Screenshot thumbnail */}
      <button
        onClick={onOpenPopup}
        className="relative w-full overflow-hidden bg-black/10 hover:opacity-90 transition-opacity"
        style={{ height: 160 }}
      >
        {screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={screenshot} alt="Browser screenshot" className="w-full h-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-[#1A3C2B]/40 animate-spin" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-2 left-3 right-3 text-white text-[10px] text-left truncate drop-shadow pointer-events-none">
          Click to open live view
        </div>
      </button>

      {/* Message */}
      {message && (
        <div className="px-3 py-2 text-[11px] text-grid/70 leading-relaxed border-t border-inherit">
          {message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-inherit">
        <button
          onClick={onTakeControl}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
            isWaiting
              ? "bg-[#1A3C2B] text-white hover:bg-[#24503a]"
              : "bg-[#1A3C2B]/80 text-white hover:bg-[#1A3C2B]"
          )}
        >
          <UserCheck className="w-3 h-3" />
          Take control
        </button>
        <button
          onClick={handleIgnore}
          className="px-2.5 py-1 rounded text-[11px] text-grid/50 hover:text-grid/70 border border-grid/20 hover:border-grid/40 transition-colors"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
