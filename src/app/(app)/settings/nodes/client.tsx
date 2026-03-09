"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Organization } from "@/lib/supabase/data";
import { 
  ArrowLeft, 
  Monitor, 
  Copy, 
  Check, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  Clock,
  Cpu,
  AlertCircle
} from "lucide-react";

interface PendingNode {
  id: string;
  name: string;
  deviceType: string;
  requestedAt: string;
}

interface ConnectedNode {
  id: string;
  name: string;
  status: "connected" | "disconnected";
  deviceType: string;
  lastSeen: string;
  capabilities?: string[];
}

interface NodeCapabilities {
  camera: boolean;
  screen: boolean;
  location: boolean;
  notifications: boolean;
  exec: boolean;
  browser: boolean;
}

interface NodesPageClientProps {
  organization: Organization | null;
}

// Helper to mask token
function maskToken(token: string | null): string {
  if (!token) return "••••••••••••••••";
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 4) + "••••••••" + token.slice(-4);
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Parse gateway URL to extract host and port
function parseGatewayUrl(url: string | null): { host: string; port: string } {
  if (!url) return { host: "gateway.openclaw.io", port: "443" };
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    return { host: "gateway.openclaw.io", port: "443" };
  }
}

export default function NodesPageClient({ organization }: NodesPageClientProps) {
  // State
  const [pendingNodes, setPendingNodes] = useState<PendingNode[]>([]);
  const [connectedNodes, setConnectedNodes] = useState<ConnectedNode[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingConnected, setLoadingConnected] = useState(true);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [nodeCapabilities, setNodeCapabilities] = useState<Record<string, NodeCapabilities>>({});
  const [loadingCapabilities, setLoadingCapabilities] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Derived values
  const { host, port } = parseGatewayUrl(organization?.openclaw_gateway_url || null);
  const token = organization?.openclaw_auth_token || "";

  const connectionCommand = `crackedclaw-connect --token ${showToken ? token : maskToken(token)} --server wss://companion.crackedclaw.com/api/companion/ws`;

  // Fetch pending nodes
  const fetchPendingNodes = useCallback(async () => {
    try {
      const res = await fetch("/api/nodes/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingNodes(data.nodes || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending nodes:", err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  // Fetch connected nodes
  const fetchConnectedNodes = useCallback(async () => {
    try {
      const res = await fetch("/api/nodes/status");
      if (res.ok) {
        const data = await res.json();
        setConnectedNodes(data.nodes || []);
      }
    } catch (err) {
      console.error("Failed to fetch connected nodes:", err);
    } finally {
      setLoadingConnected(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPendingNodes();
    fetchConnectedNodes();
  }, [fetchPendingNodes, fetchConnectedNodes]);

  // Refresh all
  async function handleRefresh() {
    setRefreshing(true);
    setLoadingPending(true);
    setLoadingConnected(true);
    await Promise.all([fetchPendingNodes(), fetchConnectedNodes()]);
    setRefreshing(false);
  }

  // Copy command to clipboard
  async function handleCopy() {
    const fullCommand = `crackedclaw-connect --token ${token} --server wss://companion.crackedclaw.com/api/companion/ws`;
    
    try {
      await navigator.clipboard.writeText(fullCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  // Approve pending node
  async function handleApprove(nodeId: string) {
    setActionLoading(nodeId);
    try {
      const res = await fetch("/api/nodes/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, action: "approve" }),
      });

      if (res.ok) {
        setPendingNodes((prev) => prev.filter((n) => n.id !== nodeId));
        // Refresh connected nodes after approval
        fetchConnectedNodes();
      }
    } catch (err) {
      console.error("Failed to approve node:", err);
    } finally {
      setActionLoading(null);
    }
  }

  // Reject pending node
  async function handleReject(nodeId: string) {
    setActionLoading(nodeId);
    try {
      const res = await fetch("/api/nodes/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, action: "reject" }),
      });

      if (res.ok) {
        setPendingNodes((prev) => prev.filter((n) => n.id !== nodeId));
      }
    } catch (err) {
      console.error("Failed to reject node:", err);
    } finally {
      setActionLoading(null);
    }
  }

  // Fetch node capabilities
  async function handleExpandNode(nodeId: string) {
    if (expandedNode === nodeId) {
      setExpandedNode(null);
      return;
    }

    setExpandedNode(nodeId);

    // Fetch capabilities if not already loaded
    if (!nodeCapabilities[nodeId]) {
      setLoadingCapabilities(nodeId);
      try {
        const res = await fetch(`/api/nodes/describe?nodeId=${nodeId}`);
        if (res.ok) {
          const data = await res.json();
          setNodeCapabilities((prev) => ({
            ...prev,
            [nodeId]: data.capabilities,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch node capabilities:", err);
      } finally {
        setLoadingCapabilities(null);
      }
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-grid/60 hover:text-forest transition-colors mb-4"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
              Nodes
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
              Connect your Mac via CrackedClaw Connect
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Section 1: Connect Your Mac */}
        <Card label="Connect Your Mac" accentColor="#9EFFBF" bordered>
          <div className="mt-2 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4 text-mint" />
              <span className="font-mono text-[11px] text-grid/60">
                Run this command on your Mac to connect it as a device
              </span>
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 p-4 border border-[rgba(58,58,56,0.1)] bg-forest/5">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                  Server
                </span>
                <span className="font-mono text-xs text-forest">
                  companion.crackedclaw.com
                </span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                  Protocol
                </span>
                <span className="font-mono text-xs text-forest">
                  WSS (encrypted)
                </span>
              </div>
            </div>

            {/* Command Block */}
            <div className="relative">
              <pre className="bg-forest text-white p-4 font-mono text-xs overflow-x-auto">
                <code>{connectionCommand}</code>
              </pre>
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white font-mono text-[9px] uppercase tracking-wide transition-colors"
                >
                  {showToken ? "Hide" : "Show"} Token
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white font-mono text-[9px] uppercase tracking-wide transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Install instructions link */}
            <div className="pt-2 border-t border-[rgba(58,58,56,0.1)]">
              <a
                href="https://crackedclaw.com/connect"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-forest hover:text-mint transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Download CrackedClaw Connect
              </a>
            </div>
          </div>
        </Card>

        {/* Section 2: Pending Requests */}
        <Card label="Pending Requests" accentColor="#F4D35E" bordered>
          <div className="mt-2">
            {loadingPending ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-forest/5 animate-pulse" />
                ))}
              </div>
            ) : pendingNodes.length === 0 ? (
              <div className="py-8 text-center">
                <AlertCircle className="w-8 h-8 text-grid/30 mx-auto mb-3" />
                <p className="font-mono text-[11px] text-grid/50">
                  No pending node requests
                </p>
                <p className="font-mono text-[10px] text-grid/30 mt-1">
                  Run the connection command on a new Mac to see it here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between p-4 border border-[rgba(58,58,56,0.1)] bg-paper"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/20 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="font-header text-sm font-bold text-forest">
                          {node.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-grid/50">
                            {node.deviceType}
                          </span>
                          <span className="text-grid/30">•</span>
                          <span className="font-mono text-[10px] text-grid/50 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(node.requestedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(node.id)}
                        disabled={actionLoading === node.id}
                        className="text-coral hover:text-coral"
                      >
                        Reject
                      </Button>
                      <Button
                        variant="solid"
                        size="sm"
                        onClick={() => handleApprove(node.id)}
                        disabled={actionLoading === node.id}
                      >
                        {actionLoading === node.id ? "..." : "Approve"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Section 3: Connected Devices */}
        <Card label="Connected Devices" accentColor="#9EFFBF" bordered>
          <div className="mt-2">
            {loadingConnected ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-forest/5 animate-pulse" />
                ))}
              </div>
            ) : connectedNodes.length === 0 ? (
              <div className="py-8 text-center">
                <Cpu className="w-8 h-8 text-grid/30 mx-auto mb-3" />
                <p className="font-mono text-[11px] text-grid/50">
                  No connected nodes
                </p>
                <p className="font-mono text-[10px] text-grid/30 mt-1">
                  Approve a pending request to see connected nodes here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedNodes.map((node) => (
                  <div
                    key={node.id}
                    className="border border-[rgba(58,58,56,0.1)] bg-paper"
                  >
                    {/* Node Header Row */}
                    <button
                      onClick={() => handleExpandNode(node.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-forest/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 flex items-center justify-center ${
                          node.status === "connected" ? "bg-mint/20" : "bg-grid/10"
                        }`}>
                          <Monitor className={`w-5 h-5 ${
                            node.status === "connected" ? "text-mint" : "text-grid/50"
                          }`} />
                        </div>
                        <div>
                          <p className="font-header text-sm font-bold text-forest">
                            {node.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge status={node.status === "connected" ? "active" : "inactive"}>
                              {node.status}
                            </Badge>
                            <span className="font-mono text-[10px] text-grid/50">
                              {node.deviceType}
                            </span>
                            <span className="text-grid/30">•</span>
                            <span className="font-mono text-[10px] text-grid/50">
                              Last seen: {formatRelativeTime(node.lastSeen)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedNode === node.id ? (
                          <ChevronDown className="w-4 h-4 text-grid/50" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-grid/50" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Capabilities */}
                    {expandedNode === node.id && (
                      <div className="px-4 pb-4 border-t border-[rgba(58,58,56,0.1)]">
                        <div className="pt-4">
                          <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-3">
                            Capabilities
                          </span>
                          {loadingCapabilities === node.id ? (
                            <div className="h-12 bg-forest/5 animate-pulse" />
                          ) : nodeCapabilities[node.id] ? (
                            <div className="grid grid-cols-3 gap-2">
                              {Object.entries(nodeCapabilities[node.id]).map(([cap, enabled]) => (
                                <div
                                  key={cap}
                                  className={`px-3 py-2 border ${
                                    enabled 
                                      ? "border-mint/30 bg-mint/10" 
                                      : "border-[rgba(58,58,56,0.1)] bg-grid/5"
                                  }`}
                                >
                                  <span className={`font-mono text-[10px] uppercase tracking-wide ${
                                    enabled ? "text-forest" : "text-grid/40"
                                  }`}>
                                    {cap}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="font-mono text-[10px] text-grid/50">
                              Failed to load capabilities
                            </p>
                          )}

                          {/* Quick capabilities from node list */}
                          {node.capabilities && node.capabilities.length > 0 && !nodeCapabilities[node.id] && (
                            <div className="flex flex-wrap gap-2">
                              {node.capabilities.map((cap) => (
                                <span
                                  key={cap}
                                  className="px-2 py-1 bg-mint/10 border border-mint/30 font-mono text-[10px] uppercase tracking-wide text-forest"
                                >
                                  {cap}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Remove button (disabled for now) */}
                        <div className="mt-4 pt-4 border-t border-[rgba(58,58,56,0.1)]">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="text-coral/50 cursor-not-allowed"
                          >
                            Remove Node (Coming Soon)
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
