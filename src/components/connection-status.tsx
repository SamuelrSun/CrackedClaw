"use client";

import { cn } from "@/lib/utils";
import { useGateway } from "@/hooks/use-gateway";

interface ConnectionStatusProps {
  variant?: "minimal" | "compact" | "detailed";
  className?: string;
  showLatency?: boolean;
}

/**
 * Connection Status Indicator
 * Displays the current gateway connection status with reconnection state
 */
export function ConnectionStatus({
  variant = "compact",
  className,
  showLatency = true,
}: ConnectionStatusProps) {
  const {
    connectionStatus,
    latencyMs,
    reconnectAttempt,
    reconnectCountdown,
    isReconnecting,
    error,
    forceReconnect,
    cancelReconnect,
    statusInfo,
  } = useGateway();

  // Status colors
  const statusColors = {
    connected: "bg-[#9EFFBF]",
    checking: "bg-[#F4D35E] animate-pulse",
    connecting: "bg-[#F4D35E] animate-pulse",
    reconnecting: "bg-[#F4D35E] animate-pulse",
    disconnected: "bg-grid/30",
    error: "bg-[#FF6B6B]",
  };

  // Status labels
  const statusLabels = {
    connected: "Connected",
    checking: "Checking...",
    connecting: "Connecting...",
    reconnecting: `Reconnecting${reconnectCountdown ? ` in ${reconnectCountdown}s` : "..."}`,
    disconnected: "Disconnected",
    error: "Connection Error",
  };

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn("w-2 h-2 rounded-full", statusColors[connectionStatus])} />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn("w-2 h-2 rounded-full", statusColors[connectionStatus])} />
        <span className="font-mono text-[9px] uppercase tracking-wide text-grid/50">
          {statusLabels[connectionStatus]}
        </span>
        {showLatency && connectionStatus === "connected" && latencyMs && (
          <span className="font-mono text-[9px] text-grid/30">
            {latencyMs}ms
          </span>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={cn("border border-white/[0.1] rounded-none p-3", className)}>
      {/* Status Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusColors[connectionStatus])} />
          <span className="font-mono text-[10px] uppercase tracking-wide font-medium">
            Gateway {statusLabels[connectionStatus]}
          </span>
        </div>
        {showLatency && connectionStatus === "connected" && latencyMs && (
          <span className="font-mono text-[10px] text-grid/40">
            {latencyMs}ms latency
          </span>
        )}
      </div>

      {/* Connected Info */}
      {connectionStatus === "connected" && statusInfo && (
        <div className="text-xs text-grid/60 space-y-1">
          <div className="flex justify-between">
            <span>Agent:</span>
            <span className="font-medium text-forest">{statusInfo.agentName}</span>
          </div>
          <div className="flex justify-between">
            <span>Model:</span>
            <span className="font-mono text-[10px]">{statusInfo.model}</span>
          </div>
        </div>
      )}

      {/* Reconnecting State */}
      {isReconnecting && (
        <div className="space-y-2">
          <div className="text-xs text-grid/60">
            <span>Attempt {reconnectAttempt} of 5</span>
            {reconnectCountdown && (
              <span className="ml-2">• Retrying in {reconnectCountdown}s</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={forceReconnect}
              className="flex-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wide bg-forest text-white hover:bg-forest/90 transition-colors"
            >
              Retry Now
            </button>
            <button
              onClick={cancelReconnect}
              className="px-2 py-1 text-[10px] font-mono uppercase tracking-wide border border-white/[0.1] hover:bg-grid/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {connectionStatus === "error" && (
        <div className="space-y-2">
          {error && (
            <p className="text-[11px] text-[#FF6B6B]">{error}</p>
          )}
          <button
            onClick={forceReconnect}
            className="w-full px-2 py-1.5 text-[10px] font-mono uppercase tracking-wide bg-forest text-white hover:bg-forest/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Disconnected State */}
      {connectionStatus === "disconnected" && (
        <div className="space-y-2">
          <p className="text-[11px] text-grid/50">
            No gateway connected. Configure in Settings.
          </p>
          <button
            onClick={forceReconnect}
            className="w-full px-2 py-1.5 text-[10px] font-mono uppercase tracking-wide border border-white/[0.1] hover:bg-grid/5 transition-colors"
          >
            Check Connection
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Inline connection status for use in headers/navbars
 */
export function ConnectionStatusInline({ className }: { className?: string }) {
  const { connectionStatus, reconnectCountdown, forceReconnect } = useGateway();

  const isHealthy = connectionStatus === "connected";
  const isRetrying = connectionStatus === "reconnecting";

  if (isHealthy) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#9EFFBF]" />
        <span className="font-mono text-[9px] text-grid/40">Live</span>
      </div>
    );
  }

  if (isRetrying) {
    return (
      <button
        onClick={forceReconnect}
        className={cn(
          "flex items-center gap-1.5 hover:opacity-80 transition-opacity",
          className
        )}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#F4D35E] animate-pulse" />
        <span className="font-mono text-[9px] text-[#F4D35E]">
          {reconnectCountdown ? `Retrying ${reconnectCountdown}s` : "Reconnecting..."}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={forceReconnect}
      className={cn(
        "flex items-center gap-1.5 hover:opacity-80 transition-opacity",
        className
      )}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
      <span className="font-mono text-[9px] text-[#FF6B6B]">Offline</span>
    </button>
  );
}
