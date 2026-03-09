"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Copy, Loader2, Monitor, RefreshCw } from "lucide-react";

interface NodeStatus {
  isOnline: boolean;
  nodeName?: string;
  lastSeen?: string;
  gatewayUrl?: string;
  authToken?: string;
}

interface NodeGateCardProps {
  gatewayHost?: string;
  integrationName: string;
  integrationIcon: string;
  loginUrl?: string;
  onLaunch?: () => void;
}

// Parse gateway URL to extract host
function parseGatewayHost(url: string | null): string {
  if (!url) return "your-workspace.crackedclaw.com";
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "your-workspace.crackedclaw.com";
  }
}

export function NodeGateCard({ integrationName, integrationIcon, loginUrl, onLaunch, gatewayHost }: NodeGateCardProps) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkNodeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/node/status');
      if (res.ok) {
        const data = await res.json();
        // Only update if status actually changed to prevent flickering
        setNodeStatus(prev => {
          if (!prev) return data;
          if (prev.isOnline !== data.isOnline || prev.nodeName !== data.nodeName) return data;
          return prev;
        });
      }
    } catch {
      setNodeStatus(prev => prev?.isOnline ? prev : { isOnline: false });
    }
  }, []);

  useEffect(() => {
    checkNodeStatus();
    // Poll every 3 seconds for faster feedback
    const interval = setInterval(checkNodeStatus, 3000);
    return () => clearInterval(interval);
  }, [checkNodeStatus]);

  const handleRefresh = async () => {
    setChecking(true);
    await checkNodeStatus();
    setTimeout(() => setChecking(false), 500);
  };

  const handleCopy = async () => {
    const token = nodeStatus?.authToken || "YOUR_TOKEN";
    const fullCommand = `crackedclaw-connect --token ${token} --server wss://companion.crackedclaw.com/api/companion/ws`;
    
    try {
      await navigator.clipboard.writeText(fullCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const launchSession = async () => {
    if (!nodeStatus?.isOnline || !loginUrl) return;
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch('/api/node/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: { action: 'navigate', url: loginUrl, profile: 'chrome' }
        }),
      });
      const data = await res.json();
      if (data.success) {
        onLaunch?.();
      } else {
        setError(data.error || 'Failed to launch browser session');
      }
    } catch {
      setError('Failed to connect to node');
    } finally {
      setLaunching(false);
    }
  };

  const displayHost = nodeStatus?.gatewayUrl 
    ? parseGatewayHost(nodeStatus.gatewayUrl) 
    : (gatewayHost || "your-workspace.crackedclaw.com");

  const maskedCommand = nodeStatus?.authToken
    ? `crackedclaw-connect --token ${nodeStatus.authToken} --server wss://companion.crackedclaw.com/api/companion/ws`
    : `crackedclaw-connect --token YOUR_TOKEN --server wss://companion.crackedclaw.com/api/companion/ws`;

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
            disabled={launching}
            className="w-full py-2 font-mono text-[11px] uppercase tracking-wide bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {launching ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Check className="w-3 h-3" />
                Open {integrationName} in Browser
              </>
            )}
          </button>
          {error && <p className="font-mono text-[10px] text-red-600">{error}</p>}
          <p className="font-mono text-[9px] text-green-600 text-center">
            Will open in your Chrome browser on {nodeStatus.nodeName || 'your Mac'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold text-amber-800">Here&apos;s how to set that up:</p>
          <div className="space-y-2">
            {[
              { n: 1, text: 'Open Terminal on your Mac' },
              { n: 2, text: 'Paste the command below (it installs everything automatically):' },
              { n: 3, text: 'Leave that window open — that\'s it!' },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-2">
                <span className="font-mono text-[9px] bg-amber-200 text-amber-800 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">{step.n}</span>
                <p className="font-mono text-[10px] text-amber-800">{step.text}</p>
              </div>
            ))}
          </div>
          
          {/* Command box with Copy button */}
          <div className="relative bg-amber-100 border border-amber-300 p-3">
            <code className="font-mono text-[10px] text-amber-900 break-all pr-16">
              {maskedCommand}
            </code>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-800 font-mono text-[9px] uppercase tracking-wide transition-colors flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          
          <p className="font-mono text-[9px] text-amber-600 leading-relaxed">
            This connects your computer to CrackedClaw. Your auth token is embedded in the command. Nothing is stored on our servers — your data stays on your device.
          </p>
        </div>
      )}
    </div>
  );
}
