"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, Monitor, RefreshCw } from "lucide-react";
import Link from "next/link";

interface NodeStatus {
  isOnline: boolean;
  nodeName?: string;
}

interface NodeGateCardProps {
  gatewayHost?: string;
  integrationName: string;
  integrationIcon: string;
  loginUrl?: string;
  onLaunch?: () => void;
}

export function NodeGateCard({ integrationName, integrationIcon, loginUrl, onLaunch, gatewayHost: _gatewayHost }: NodeGateCardProps) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const checkNodeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/nodes/status');
      if (res.ok) {
        const data = await res.json();
        const nodes: Array<{ status?: string; name?: string }> = data.nodes || [];
        const connected = nodes.find(n => n.status === 'connected');
        setNodeStatus(prev => {
          const next = { isOnline: !!connected, nodeName: connected?.name };
          if (!prev) return next;
          if (prev.isOnline !== next.isOnline || prev.nodeName !== next.nodeName) return next;
          return prev;
        });
      }
    } catch {
      setNodeStatus(prev => prev?.isOnline ? prev : { isOnline: false });
    }
  }, []);

  useEffect(() => {
    checkNodeStatus();
    const interval = setInterval(checkNodeStatus, 3000);
    return () => clearInterval(interval);
  }, [checkNodeStatus]);

  const handleRefresh = async () => {
    setChecking(true);
    await checkNodeStatus();
    setTimeout(() => setChecking(false), 500);
  };

  const launchSession = async () => {
    if (!nodeStatus?.isOnline || !loginUrl) return;
    setError(null);
    try {
      // Open the login URL directly in a new tab — CrackedClaw Connect handles browser automation
      window.open(loginUrl, '_blank', 'noopener,noreferrer');
      onLaunch?.();
    } catch {
      setError('Failed to open browser session');
    }
  };

  return (
    <div className="border border-amber-200 bg-amber-50 p-4 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{integrationIcon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-header font-bold text-sm">{integrationName}</p>
          <span className="font-mono text-[9px] uppercase tracking-wide bg-amber-200 text-amber-800 px-2 py-0.5">
            Works through your browser
          </span>
        </div>
      </div>

      {/* Live Connection Status Indicator */}
      <div className="mb-4 p-3 border border-amber-200 bg-white/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {nodeStatus === null ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                <span className="font-mono text-[10px] text-amber-700">Checking connection...</span>
              </>
            ) : nodeStatus.isOnline ? (
              <>
                <div className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-2 h-2 text-white" />
                </div>
                <span className="font-mono text-[10px] text-green-700">
                  ✅ Connected — ready to go!
                </span>
              </>
            ) : (
              <>
                <div className="relative w-3 h-3">
                  <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
                  <div className="relative w-3 h-3 rounded-full bg-amber-500" />
                </div>
                <span className="font-mono text-[10px] text-amber-700">
                  ⏳ Waiting for connection...
                </span>
              </>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={checking}
            className="p-1 hover:bg-amber-100 rounded transition-colors"
            title="Check connection"
          >
            <RefreshCw className={`w-3 h-3 text-amber-600 ${checking ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {nodeStatus?.isOnline && nodeStatus.nodeName && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Monitor className="w-3 h-3 text-green-600" />
            <span className="font-mono text-[9px] text-green-700">{nodeStatus.nodeName}</span>
          </div>
        )}
      </div>

      <p className="font-mono text-[10px] text-amber-800 mb-4">
        I&apos;ll open {integrationName} in a browser on your computer — just like you&apos;d use it yourself. Your existing login is used, so nothing is stored on our servers.
      </p>

      {nodeStatus?.isOnline ? (
        <div className="space-y-2">
          <button
            onClick={launchSession}
            className="w-full py-2 font-mono text-[11px] uppercase tracking-wide bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-3 h-3" />
            Open {integrationName} in Browser
          </button>
          {error && <p className="font-mono text-[10px] text-red-600">{error}</p>}
          <p className="font-mono text-[9px] text-green-600 text-center">
            Will open in your Chrome browser on {nodeStatus.nodeName || 'your Mac'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold text-amber-800">Here&apos;s how to connect:</p>
          <div className="space-y-2">
            {[
              { n: 1, text: 'Download CrackedClaw Connect from crackedclaw.com/connect' },
              { n: 2, text: 'Open the app and sign in with your CrackedClaw account' },
              { n: 3, text: 'Leave the app running in the background — that\'s it!' },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-2">
                <span className="font-mono text-[9px] bg-amber-200 text-amber-800 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">{step.n}</span>
                <p className="font-mono text-[10px] text-amber-800">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Link
              href="/settings/nodes"
              className="font-mono text-[10px] text-amber-800 underline hover:text-amber-900 transition-colors"
            >
              Manage connected devices →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
