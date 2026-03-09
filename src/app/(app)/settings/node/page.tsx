"use client";

import { useState, useEffect } from "react";

interface NodeStatus {
  isOnline: boolean;
  nodeId?: string;
  nodeName?: string;
  lastSeen?: string;
  capabilities: string[];
  hasBrowser: boolean;
}

export const dynamic = 'force-dynamic';

export default function NodeSettingsPage() {
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 10000);
    return () => clearInterval(iv);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/node/status');
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-header text-3xl font-bold tracking-tight mb-1">Node</h1>
      <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mb-6">
        Your local machine, connected to the cloud
      </p>

      {/* Status card */}
      <div className={`border p-4 mb-6 ${status?.isOnline ? 'border-green-300 bg-green-50' : 'border-[rgba(58,58,56,0.2)] bg-paper'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <div>
            <p className="font-header font-bold text-sm">
              {loading ? 'Checking...' : status?.isOnline ? `Connected · ${status.nodeName || 'Your Mac'}` : 'No Node Connected'}
            </p>
            {status?.isOnline && status.lastSeen && (
              <p className="font-mono text-[9px] text-grid/40">Last seen {status.lastSeen}</p>
            )}
          </div>
          {status?.isOnline && (
            <div className="ml-auto flex gap-1 flex-wrap">
              {status.capabilities.map(cap => (
                <span key={cap} className="font-mono text-[9px] bg-green-100 text-green-700 px-2 py-0.5 border border-green-200 uppercase">
                  {cap}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Why you need a node */}
      <div className="border border-[rgba(58,58,56,0.1)] bg-paper p-4 mb-6">
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-2">Why connect a node?</p>
        <ul className="space-y-1.5">
          {[
            { icon: '💼', text: 'LinkedIn, WhatsApp, Instagram — services with no public API' },
            { icon: '🌐', text: 'Any website: browser automation runs on YOUR machine, logged in as you' },
            { icon: '🔒', text: 'No credentials stored on our servers — your sessions stay on your device' },
            { icon: '📁', text: 'Access your local files and apps directly' },
          ].map(item => (
            <li key={item.icon} className="flex items-center gap-2">
              <span>{item.icon}</span>
              <span className="font-mono text-[10px] text-grid/70">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Setup instructions */}
      {!status?.isOnline && (
        <div className="border border-[rgba(58,58,56,0.2)] bg-paper p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/40 mb-3">Connect your node</p>
          <div className="space-y-3">
            <Step n={1} text="Install OpenClaw on your Mac (if not installed)" />
            <Step n={2} text="Open Terminal and run:" />
            <div className="bg-grid/5 border border-[rgba(58,58,56,0.1)] p-3 font-mono text-xs text-grid break-all">
              openclaw node run --tls --host crackedclaw.com
            </div>
            <Step n={3} text="Approve the pairing request that appears here" />
          </div>
          <button
            onClick={fetchStatus}
            className="mt-4 w-full py-2 font-mono text-[10px] uppercase tracking-wide border border-[rgba(58,58,56,0.2)] hover:bg-grid/5 transition-colors"
          >
            Check Connection
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-[9px] bg-grid/10 text-grid w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{n}</span>
      <p className="font-mono text-[11px] text-grid/70">{text}</p>
    </div>
  );
}
