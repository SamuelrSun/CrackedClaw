"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GatewayErrorCode } from "@/types/gateway";

interface ChatErrorProps {
  code: GatewayErrorCode;
  message?: string;
  timestamp?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const ERROR_CONFIG: Record<
  GatewayErrorCode,
  { icon: string; title: string; description: string; retryable: boolean; color: string }
> = {
  GATEWAY_OFFLINE: {
    icon: "🔌",
    title: "Assistant offline",
    description: "Your assistant is currently offline. This usually resolves in a few minutes.",
    retryable: true,
    color: "#F4D35E",
  },
  TOKEN_EXPIRED: {
    icon: "🔐",
    title: "Session expired",
    description: "Your session has expired. Please refresh the page.",
    retryable: false,
    color: "#FF6B6B",
  },
  NODE_DISCONNECTED: {
    icon: "💻",
    title: "Computer disconnected",
    description: "Your computer disconnected. Reconnect to use browser features.",
    retryable: false,
    color: "#F4D35E",
  },
  RATE_LIMITED: {
    icon: "⏱️",
    title: "Too many messages",
    description: "Too many messages. Please wait a moment.",
    retryable: true,
    color: "#F4D35E",
  },
  AUTH_FAILED: {
    icon: "🔒",
    title: "Authentication failed",
    description: "Authentication failed. Please check your gateway token in Settings.",
    retryable: false,
    color: "#FF6B6B",
  },
  NO_GATEWAY: {
    icon: "🔌",
    title: "No gateway",
    description: "No gateway connected. Go to Settings to connect your gateway.",
    retryable: false,
    color: "#FF6B6B",
  },
  GATEWAY_ERROR: {
    icon: "⚠️",
    title: "Gateway error",
    description: "The gateway encountered an error. Please try again.",
    retryable: true,
    color: "#FF6B6B",
  },
  UNKNOWN_ERROR: {
    icon: "⚠️",
    title: "Something went wrong",
    description: "Something went wrong. Please try again.",
    retryable: true,
    color: "#FF6B6B",
  },
};

export function ChatError({
  code,
  message,
  timestamp,
  onRetry,
  onDismiss,
  className,
}: ChatErrorProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = ERROR_CONFIG[code] ?? ERROR_CONFIG.UNKNOWN_ERROR;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const isWarm = config.color === "#F4D35E";

  return (
    <div className={cn("max-w-[70%] mr-auto", className)}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">
          Assistant
        </span>
        {timestamp && (
          <span className="font-mono text-[9px] text-grid/30">{timestamp}</span>
        )}
      </div>
      <div
        className="border p-4 space-y-2"
        style={{
          borderColor: config.color + "40",
          backgroundColor: config.color + "08",
        }}
      >
        <div className="flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <p
              className="font-mono text-[11px] uppercase tracking-wide font-semibold mb-1"
              style={{ color: isWarm ? "#B8860B" : "#CC4444" }}
            >
              {config.title}
            </p>
            <p className="text-sm text-grid/70">
              {message || config.description}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-grid/30 hover:text-grid/60 transition-colors text-xs leading-none flex-shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>

        {config.retryable && onRetry && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide text-white transition-colors"
              style={{ backgroundColor: isWarm ? "#B8860B" : "#CC4444" }}
            >
              Try again
            </button>
          </div>
        )}

        {code === "TOKEN_EXPIRED" && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide text-white bg-[#CC4444] hover:bg-[#AA2222] transition-colors"
            >
              Refresh page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
