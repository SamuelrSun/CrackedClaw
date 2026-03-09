"use client";

import { useState, useEffect } from "react";

interface NodeStatus {
  isOnline: boolean;
  nodeName?: string;
  lastSeen?: string;
}

interface NodeGateCardProps {
  gatewayHost?: string;
  integrationName: string;
  integrationIcon: string;
  loginUrl?: string;
  onLaunch?: () => void;
}

export function NodeGateCard({ integrationName, integrationIcon, loginUrl, onLaunch, gatewayHost }: NodeGateCardProps) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkNodeStatus();
    const interval = setInterval(checkNodeStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkNodeStatus = async () => {
    try {
      const res = await fetch('/api/node/status');
      if (res.ok) {
        const data = await res.json();
        setNodeStatus(data);
      }
    } catch {
      setNodeStatus({ isOnline: false });
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

  return (
    <div className="border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{integrationIcon}</span>
        <div>
          <p className="font-header font-bold text-sm">{integrationName}</p>
          <span className="font-mono text-[9px] uppercase tracking-wide bg-amber-200 text-amber-800 px-2 py-0.5">
            Works through your browser
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${nodeStatus?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="font-mono text-[9px] text-amber-700">
            {nodeStatus === null ? 'Checking...' : nodeStatus.isOnline ? `Connected: ${nodeStatus.nodeName || 'Your Mac'}` : 'Not connected yet'}
          </span>
        </div>
      </div>

      <p className="font-mono text-[10px] text-amber-800 mb-4">
        I'll open {integrationName} in a browser on your computer — just like you'd use it yourself. Your existing login is used, so nothing is stored on our servers.
      </p>

      {nodeStatus?.isOnline ? (
        <div className="space-y-2">
          <button
            onClick={launchSession}
            disabled={launching}
            className="w-full py-2 font-mono text-[11px] uppercase tracking-wide bg-amber-700 text-white hover:bg-amber-800 transition-colors disabled:opacity-50"
          >
            {launching ? 'Launching...' : `Open ${integrationName} in Browser`}
          </button>
          {error && <p className="font-mono text-[10px] text-red-600">{error}</p>}
          <p className="font-mono text-[9px] text-amber-600 text-center">
            Will open in your Chrome browser on {nodeStatus.nodeName || 'your Mac'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold text-amber-800">Here's how to set that up:</p>
          <div className="space-y-2">
            {[
              { n: 1, text: 'Install OpenClaw on your Mac' },
              { n: 2, text: 'Open the Terminal app on your Mac (search "Terminal" in Spotlight — ⌘+Space) and paste:' },
              { n: 3, text: 'Leave that window open — that\'s it! I can only do things you ask me to.' },
            ].map(step => (
              <div key={step.n} className="flex items-start gap-2">
                <span className="font-mono text-[9px] bg-amber-200 text-amber-800 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">{step.n}</span>
                <p className="font-mono text-[10px] text-amber-800">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="bg-amber-100 border border-amber-300 p-2">
            <code className="font-mono text-[10px] text-amber-900 break-all">
              {gatewayHost ? `openclaw node run --host ${gatewayHost}` : "openclaw node run --host your-workspace.crackedclaw.com"}
            </code>
          </div>
          <p className="font-mono text-[9px] text-amber-600 leading-relaxed">
            I&apos;m not monitoring your screen or accessing anything without your permission. Your data stays on your device and the connection is encrypted.
          </p>
          <button
            onClick={checkNodeStatus}
            className="w-full py-1.5 font-mono text-[10px] uppercase tracking-wide border border-amber-400 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Check Again
          </button>
        </div>
      )}
    </div>
  );
}
