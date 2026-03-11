"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface NodeStatusState {
  isOnline: boolean;
  nodeName?: string;
  capabilities: string[];
  hasBrowser: boolean;
  loading: boolean;
  error: string | null;
  /** True if node was previously online but has gone offline */
  wasOnline: boolean;
  /** True if user dismissed the disconnect banner */
  bannerDismissed: boolean;
  dismissBanner: () => void;
}

export function useNodeStatus(pollIntervalMs = 30000): NodeStatusState {
  const [isOnline, setIsOnline] = useState(false);
  const [nodeName, setNodeName] = useState<string | undefined>();
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [hasBrowser, setHasBrowser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasOnline, setWasOnline] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const wasOnlineRef = useRef(false);
  const bannerDismissedRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/nodes/status");
      if (!res.ok) throw new Error("Failed to fetch node status");
      const data = await res.json();

      // /api/nodes/status returns { nodes: [...] }
      const nodes: Array<{ id: string; name?: string; status?: string; capabilities?: string[] }> = data.nodes || [];
      const connectedNode = nodes.find(n => n.status === "connected");
      const online: boolean = !!connectedNode;
      const caps: string[] = connectedNode?.capabilities ?? [];

      setIsOnline(online);
      setNodeName(connectedNode?.name);
      setCapabilities(caps);
      setHasBrowser(caps.includes("browser"));
      setError(null);

      if (online) {
        wasOnlineRef.current = true;
        setWasOnline(true);
        // Node reconnected — auto-dismiss banner
        if (bannerDismissedRef.current) {
          bannerDismissedRef.current = false;
          setBannerDismissed(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, pollIntervalMs]);

  const dismissBanner = useCallback(() => {
    bannerDismissedRef.current = true;
    setBannerDismissed(true);
  }, []);

  return {
    isOnline,
    nodeName,
    capabilities,
    hasBrowser,
    loading,
    error,
    wasOnline,
    bannerDismissed,
    dismissBanner,
  };
}
