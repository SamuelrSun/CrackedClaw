/**
 * Node Types for OpenClaw Cloud
 * Types for node pairing and management
 */

// Pending node awaiting approval
export interface PendingNode {
  requestId: string;
  deviceId: string;
  displayName: string;
  deviceType?: string; // "mac", "ios", "android", etc.
  requestedAt: string; // ISO timestamp
  expiresAt?: string;
  silent?: boolean;
}

// Paired and connected node
export interface PairedNode {
  nodeId: string;
  displayName: string;
  deviceType?: string;
  connected: boolean;
  lastConnected?: string; // ISO timestamp or relative like "2h ago"
  capabilities?: string[]; // ["system.run", "canvas.snapshot", "camera.snap", etc.]
  permissions?: Record<string, boolean>; // { screenRecording: true, accessibility: false }
}

// Node capabilities and system info
export interface NodeCapabilities {
  nodeId: string;
  displayName: string;
  commands: string[];
  permissions: Record<string, boolean>;
  platform?: string; // "darwin", "linux", "win32"
  arch?: string; // "arm64", "x64"
}

// Response from nodes status endpoint
export interface NodesStatusResponse {
  known: number;
  paired: number;
  connected: number;
  nodes: PairedNode[];
}

// Response from nodes pending endpoint
export interface NodesPendingResponse {
  pending: PendingNode[];
}

// Request to approve a pending node
export interface NodeApproveRequest {
  requestId: string;
}

// Request to reject a pending node
export interface NodeRejectRequest {
  requestId: string;
}

// Generic API response wrapper for nodes endpoints
export interface NodesApiResponse<T> {
  ok: boolean;
  result?: T;
  error?: {
    type: string;
    message: string;
  };
}
