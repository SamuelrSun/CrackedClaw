/**
 * Gateway Types for OpenClaw Cloud
 * Types for communicating with a user's personal OpenClaw gateway
 */

// Gateway connection status
export type GatewayConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type GatewayStatus = 'connected' | 'disconnected' | 'error' | 'checking';

// Gateway status response from /api/status endpoint
export interface GatewayStatusInfo {
  agentName: string;
  model: string;
  defaultModel?: string;
  uptime?: string;
  runtime?: {
    os: string;
    node: string;
    shell: string;
    channel?: string;
  };
  tokenUsage?: {
    used: number;
    limit: number;
    resetDate?: string;
  };
  capabilities?: string[];
}

// Memory entry from OpenClaw gateway
export interface GatewayMemoryEntry {
  id: string;
  content: string;
  source: 'MEMORY.md' | 'daily' | 'user' | 'soul';
  filename?: string;
  category?: string;
  date?: string;
  createdAt?: string;
}

// Gateway connection stored per user (database row)
export interface GatewayConnection {
  id: string;
  user_id: string;
  gateway_url: string;
  auth_token: string;
  name?: string;
  status: GatewayStatus;
  last_ping?: string | null;
  created_at: string;
  updated_at: string;
}

// Input for creating/updating gateway connection
export interface GatewayConnectionInput {
  gateway_url: string;
  auth_token: string;
  name?: string;
}

// Result from testing gateway connection
export interface GatewayTestResult {
  success: boolean;
  latencyMs?: number;  // Optional for error cases
  agentName?: string;
  model?: string;
  error?: string;
}

// Gateway configuration (simplified for forms)
export interface GatewayConfig {
  id?: string;
  userId?: string;
  url: string;
  token: string;
  agentName?: string;
  lastConnected?: string;
  status?: GatewayConnectionStatus;
  createdAt?: string;
  updatedAt?: string;
}

// Response from gateway status check
export interface GatewayStatusResponse {
  connected: boolean;
  status: GatewayStatusInfo | null;
  latencyMs?: number;
  error?: string;
  isLive: boolean;
}

// Response from gateway memory fetch
export interface GatewayMemoryResponse {
  entries: GatewayMemoryEntry[];
  total: number;
  source: 'live' | 'mock';
  error?: string;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  conversation_id?: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  timestamp: string;
}

// Chat message to send to gateway
export interface GatewayChatMessage {
  content: string;
  channel?: string;
}

// Chat response from gateway
export interface GatewayChatResponse {
  conversation_id?: string;
  id: string;
  content: string;
  timestamp: string;
  error?: string;
}

// Gateway error type with specific codes
export type GatewayErrorCode = 'GATEWAY_OFFLINE' | 'AUTH_FAILED' | 'NO_GATEWAY' | 'GATEWAY_ERROR' | 'UNKNOWN_ERROR';

export interface GatewayError {
  code: GatewayErrorCode;
  message: string;
}

// Helper to convert DB row to GatewayConnection
export function toGatewayConnection(row: GatewayConnection): GatewayConnection {
  return {
    id: row.id,
    user_id: row.user_id,
    gateway_url: row.gateway_url,
    auth_token: row.auth_token,
    name: row.name,
    status: row.status,
    last_ping: row.last_ping,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
