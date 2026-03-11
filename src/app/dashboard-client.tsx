"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useGateway } from "@/hooks/use-gateway";
import { cn } from "@/lib/utils";

interface DashboardClientProps {
  initialTokenUsage: {
    used: number;
    limit: number;
    resetDate: string;
  };
}

interface RealtimeStats {
  messageCount: number;
  avgResponseTime: number;
  activeSubagents: number;
  lastActivity: string | null;
}

export default function DashboardClient({ initialTokenUsage }: DashboardClientProps) {
  const {
    statusInfo,
    isConnected,
    isLoading,
    latencyMs,
    isLive,
    isReconnecting,
    reconnectAttempt,
    reconnectCountdown,
    forceReconnect,
    error: gatewayError,
  } = useGateway();

  const [daysUntilReset, setDaysUntilReset] = useState<number | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats>({
    messageCount: 0,
    avgResponseTime: 0,
    activeSubagents: 0,
    lastActivity: null,
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch real-time stats
  const fetchRealtimeStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/realtime');
      if (res.ok) {
        const data = await res.json();
        setRealtimeStats(data);
      }
    } catch {
      // Stats fetch failed, continue with defaults
    }
    setLastRefresh(new Date());
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchRealtimeStats();
    const interval = setInterval(fetchRealtimeStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchRealtimeStats]);

  // Use gateway token usage if available, otherwise use initial
  const tokenUsage = statusInfo?.tokenUsage || initialTokenUsage;
  const pct = Math.round((tokenUsage.used / tokenUsage.limit) * 100);

  // Calculate days until reset (only on client to avoid hydration mismatch)
  useEffect(() => {
    const resetDate = tokenUsage?.resetDate;
    if (!resetDate || resetDate === '—' || resetDate === 'Unknown') {
      setDaysUntilReset(null);
      return;
    }
    const reset = new Date(resetDate);
    const now = new Date();
    const diffTime = reset.getTime() - now.getTime();
    setDaysUntilReset(Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))));
  }, [tokenUsage?.resetDate]);

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <>
      {/* Agent Status - Enhanced with real-time data */}
      <Card label="Agent Status" accentColor="#9EFFBF" className="col-span-1" bordered={false}>
        <div className="flex items-center gap-3 mt-2">
          {isLoading ? (
            <Badge status="pending">Connecting...</Badge>
          ) : isReconnecting ? (
            <div className="flex flex-col gap-1">
              <Badge status="pending">Reconnecting...</Badge>
              {reconnectCountdown && (
                <span className="font-mono text-[9px] text-grid/40">
                  Retry in {reconnectCountdown}s (attempt {reconnectAttempt}/5)
                </span>
              )}
            </div>
          ) : isConnected ? (
            <>
              <Badge status="active">Online</Badge>
              {isLive && (
                <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-[#9EFFBF]/20 text-[#1A3C2B] border border-[#9EFFBF]/30">
                  Live
                </span>
              )}
            </>
          ) : (
            <Badge status="pending">Disconnected</Badge>
          )}
        </div>
        
        <p className="text-sm mt-3 text-grid/70">
          Model: {statusInfo?.model || 'Claude Sonnet 4.6'}
        </p>
        
        {statusInfo?.agentName && statusInfo.agentName !== 'OpenClaw Agent' && (
          <p className="font-mono text-[10px] text-grid/50 mt-1">
            Agent: {statusInfo.agentName}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-2">
          <p className="font-mono text-[10px] text-grid/40">
            {isConnected && latencyMs ? (
              <span className={cn(
                latencyMs > 500 ? "text-coral" : latencyMs > 200 ? "text-gold" : "text-mint"
              )}>
                Latency: {latencyMs}ms
              </span>
            ) : (
              <>Uptime: {statusInfo?.uptime || '99.9%'}</>
            )}
          </p>
          {isConnected && (
            <span className="font-mono text-[9px] text-grid/30">
              Updated {formatTimeAgo(lastRefresh)}
            </span>
          )}
        </div>

        {/* Error display */}
        {gatewayError && !isReconnecting && (
          <div className="mt-2 p-2 bg-[#FF6B6B]/10 border border-[#FF6B6B]/20">
            <p className="text-[10px] text-[#FF6B6B] truncate" title={gatewayError}>
              {gatewayError}
            </p>
            <button
              onClick={forceReconnect}
              className="mt-1 font-mono text-[9px] text-[#FF6B6B] hover:underline"
            >
              Retry connection
            </button>
          </div>
        )}

        {!isConnected && !isLoading && !isReconnecting && (
          <Link href="/settings" className="block mt-3">
            <Button variant="ghost" size="sm">Connect OpenClaw</Button>
          </Link>
        )}
      </Card>

      {/* Token Usage - Enhanced with live badge */}
      <Card label="Token Usage" accentColor="#F4D35E" className="col-span-1" bordered={false}>
        <div className="mt-2">
          <div className="flex justify-between items-baseline mb-2">
            <div className="flex items-center gap-2">
              <span className="font-header text-2xl font-bold">{pct}%</span>
              {pct >= 95 && (
                <span className="px-1.5 py-0.5 text-[8px] font-mono uppercase bg-coral text-white">
                  Critical
                </span>
              )}
              {pct >= 80 && pct < 95 && (
                <span className="px-1.5 py-0.5 text-[8px] font-mono uppercase bg-gold text-forest">
                  Warning
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-[#9EFFBF]/20 text-[#1A3C2B] border border-[#9EFFBF]/30">
                  Live
                </span>
              )}
              <span className="font-mono text-[10px] text-grid/50">
                {(tokenUsage.used / 1000).toFixed(0)}K / {(tokenUsage.limit / 1000).toFixed(0)}K
              </span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-[rgba(58,58,56,0.1)] rounded-none overflow-hidden">
            <div
              className={cn(
                "h-full rounded-none transition-all duration-500",
                pct >= 95 ? "bg-coral" : pct >= 80 ? "bg-gold" : "bg-forest"
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="font-mono text-[10px] text-grid/40">
              {daysUntilReset !== null ? `${daysUntilReset} days until reset` : `Resets ${tokenUsage.resetDate || 'Unknown'}`}
            </p>

          </div>
        </div>
      </Card>

      {/* Real-time Stats - New card */}
      <Card label="Today's Activity" accentColor="#9EFFBF" className="col-span-1" bordered={false}>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-grid/60">Messages</span>
            <span className="font-header text-lg font-bold">{realtimeStats.messageCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-grid/60">Avg Response</span>
            <span className="font-mono text-sm">
              {realtimeStats.avgResponseTime > 0 
                ? `${(realtimeStats.avgResponseTime / 1000).toFixed(1)}s` 
                : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-grid/60">Active Agents</span>
            <div className="flex items-center gap-1">
              <span className="font-header text-lg font-bold">{realtimeStats.activeSubagents}</span>
              {realtimeStats.activeSubagents > 0 && (
                <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
              )}
            </div>
          </div>
          {realtimeStats.lastActivity && (
            <div className="pt-2 border-t border-[rgba(58,58,56,0.1)]">
              <p className="font-mono text-[9px] text-grid/40">
                Last activity: {realtimeStats.lastActivity}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card label="Quick Actions" accentColor="#FF8C69" className="col-span-1" bordered={false}>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Link href="/chat">
            <Button variant="solid" size="sm">New Chat</Button>
          </Link>
          <Link href="/commands">
            <Button variant="ghost" size="sm">Run Workflow</Button>
          </Link>
          <Link href="/memory">
            <Button variant="ghost" size="sm">View Memory</Button>
          </Link>
          <Link href="/integrations">
            <Button variant="ghost" size="sm">Integrations</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}
