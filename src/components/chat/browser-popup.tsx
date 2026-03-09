"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Globe, MonitorPlay, UserCheck, Square, X } from "lucide-react";

export interface BrowserPopupProps {
  isOpen: boolean;
  onClose: () => void;
  novncUrl: string;
  currentUrl?: string;
  mode: "watching" | "control" | "paused";
  onTakeControl: () => void;
  onReleaseControl: () => void;
  onStop: () => void;
  taskName?: string;
}

type Size = "normal" | "fullscreen";

export function BrowserPopup({
  isOpen,
  onClose,
  novncUrl,
  currentUrl,
  mode,
  onTakeControl,
  onReleaseControl,
  onStop,
  taskName,
}: BrowserPopupProps) {
  const [size, setSize] = useState<Size>("normal");
  const [mounted, setMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleToggleSize = useCallback(() => {
    setSize((s) => (s === "normal" ? "fullscreen" : "normal"));
  }, []);

  const iframePointerEvents = mode === "control" ? "auto" : "none";

  const displayUrl = currentUrl
    ? (() => {
        try { return new URL(currentUrl).hostname.replace("www.", ""); }
        catch { return currentUrl; }
      })()
    : "browser";

  if (!isOpen || !mounted) return null;

  const popup = (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        size === "fullscreen" ? "p-0" : "p-6"
      )}
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden shadow-2xl",
          size === "fullscreen"
            ? "w-full h-full"
            : "w-[900px] h-[620px] max-w-[95vw] max-h-[90vh] rounded-lg"
        )}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e1e] select-none flex-shrink-0">
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#e04e46] transition-colors flex-shrink-0" title="Close" />
          <button onClick={handleToggleSize} className="w-3 h-3 rounded-full bg-[#febc2e] hover:bg-[#e0a828] transition-colors flex-shrink-0" title="Minimize" />
          <button onClick={handleToggleSize} className="w-3 h-3 rounded-full bg-[#28c840] hover:bg-[#20a030] transition-colors flex-shrink-0" title={size === "fullscreen" ? "Restore" : "Fullscreen"} />

          <div className="flex-1 flex items-center gap-2 mx-3 px-3 py-1 bg-[#2a2a2a] rounded text-xs text-gray-300 overflow-hidden">
            <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate font-mono">{currentUrl || displayUrl}</span>
          </div>

          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wide flex-shrink-0",
            mode === "watching" && "bg-blue-600/30 text-blue-300",
            mode === "control" && "bg-green-600/30 text-green-300",
            mode === "paused" && "bg-amber-600/30 text-amber-300"
          )}>
            {mode === "watching" ? "watching" : mode === "control" ? "in control" : "paused"}
          </span>
        </div>

        {taskName && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252525] border-b border-[#333] flex-shrink-0">
            <MonitorPlay className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-300 truncate">{taskName}</span>
          </div>
        )}

        {/* noVNC iframe */}
        <div className="flex-1 relative bg-black overflow-hidden">
          {mode === "paused" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
              <div className="text-center">
                <p className="text-white font-semibold text-sm mb-1">Agent paused</p>
                <p className="text-white/60 text-xs">Take control to continue</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={novncUrl}
            className="w-full h-full border-none"
            style={{ pointerEvents: iframePointerEvents }}
            allow="fullscreen"
            title="Remote Browser"
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#1e1e1e] border-t border-[#333] flex-shrink-0">
          <div className="flex items-center gap-2">
            {mode !== "control" ? (
              <button
                onClick={onTakeControl}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  mode === "paused"
                    ? "bg-[#1A3C2B] text-white hover:bg-[#24503a] ring-1 ring-green-400/40"
                    : "bg-[#1A3C2B]/80 text-white hover:bg-[#1A3C2B]"
                )}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Take control
              </button>
            ) : (
              <button
                onClick={onReleaseControl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-gray-600 text-white hover:bg-gray-500 transition-colors"
              >
                <MonitorPlay className="w-3.5 h-3.5" />
                Let agent continue
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
