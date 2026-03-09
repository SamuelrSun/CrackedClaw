'use client';

import { useState, useEffect, useCallback } from 'react';

interface StatusResponse {
  connected: boolean;
  token?: string;
  error?: string;
}

export function ConnectClient() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/companion/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, error: 'Failed to fetch status' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const copyToken = async () => {
    if (status?.token) {
      await navigator.clipboard.writeText(status.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Connection Status */}
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
        {loading ? (
          <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
        ) : (
          <div
            className={`h-3 w-3 rounded-full ${
              status?.connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
        )}
        <div>
          <p className="font-medium">
            {loading
              ? 'Checking status...'
              : status?.connected
              ? 'Connected'
              : 'Not connected'}
          </p>
          <p className="text-sm text-muted-foreground">
            {status?.connected
              ? 'Your computer is connected to CrackedClaw'
              : 'Your computer is not connected'}
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Token */}
      {status?.token && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Connection Token</label>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 rounded-md bg-muted text-sm font-mono truncate">
              {status.token}
            </code>
            <button
              onClick={copyToken}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors min-w-[80px]"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Install Instructions */}
      <div className="space-y-4">
        <h3 className="font-medium">Setup Instructions</h3>
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              1
            </span>
            <div>
              <p className="font-medium">Install CrackedClaw Connect</p>
              <code className="block mt-1 px-3 py-2 rounded-md bg-muted text-sm font-mono">
                npm install -g crackedclaw-connect
              </code>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              2
            </span>
            <div>
              <p className="font-medium">Run with your token</p>
              <code className="block mt-1 px-3 py-2 rounded-md bg-muted text-sm font-mono break-all">
                crackedclaw-connect --token {status?.token || 'YOUR_TOKEN'}
              </code>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </span>
            <div>
              <p className="font-medium">Done!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your computer is now connected. The status indicator above will turn green.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
