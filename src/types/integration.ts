/**
 * Integration Types for OpenClaw Cloud
 * Supports dynamic integration configurations with various auth types
 */

// Integration authentication/connection types
export type IntegrationType = 'oauth' | 'api_key' | 'browser' | 'file' | 'webhook' | 'hybrid';

// Integration connection status
export type IntegrationStatus = 'disconnected' | 'connected' | 'error' | 'syncing';

// Connected account within an integration
export interface IntegrationAccount {
  id: string;
  email?: string;
  name?: string;
  connectedAt: string;
  is_default?: boolean;
  picture?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

// OAuth-specific configuration
export interface OAuthConfig {
  clientId?: string;
  scopes?: string[];
  authUrl?: string;
  tokenUrl?: string;
}

// API Key-specific configuration
export interface ApiKeyConfig {
  keyName?: string;
  headerName?: string;
  masked?: boolean;
}

// Browser scraping-specific configuration
export interface BrowserConfig {
  loginUrl?: string;
  targetUrl?: string;
  selectors?: Record<string, string>;
}

// Webhook-specific configuration
export interface WebhookConfig {
  endpointUrl?: string;
  secret?: string;
  events?: string[];
}

// File-based integration configuration
export interface FileConfig {
  supportedFormats?: string[];
  maxSize?: number;
  uploadPath?: string;
}

// Hybrid configuration (combines multiple types)
export interface HybridConfig {
  primaryType: Exclude<IntegrationType, 'hybrid'>;
  secondaryType?: Exclude<IntegrationType, 'hybrid'>;
  description?: string;
}

// Union type for all config types
export type IntegrationConfig = 
  | OAuthConfig 
  | ApiKeyConfig 
  | BrowserConfig 
  | WebhookConfig 
  | FileConfig 
  | HybridConfig 
  | Record<string, unknown>;

// Main Integration interface matching the database schema
export interface Integration {
  id: string;
  user_id?: string;
  name: string;
  slug: string;
  icon: string;
  type: IntegrationType;
  status: IntegrationStatus;
  config: IntegrationConfig;
  accounts: IntegrationAccount[];
  last_sync?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Database row type (snake_case as returned from Supabase)
export interface IntegrationRow {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  icon: string;
  type: IntegrationType;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  accounts: IntegrationAccount[];
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to convert DB row to Integration
export function toIntegration(row: IntegrationRow): Integration {
  return {
    id: row.id,
    user_id: row.user_id ?? undefined,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    type: row.type,
    status: row.status,
    config: row.config,
    accounts: row.accounts,
    last_sync: row.last_sync,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Type guard helpers
export function isOAuthIntegration(integration: Integration): boolean {
  return integration.type === 'oauth';
}

export function isApiKeyIntegration(integration: Integration): boolean {
  return integration.type === 'api_key';
}

export function isBrowserIntegration(integration: Integration): boolean {
  return integration.type === 'browser';
}

export function isWebhookIntegration(integration: Integration): boolean {
  return integration.type === 'webhook';
}

export function isHybridIntegration(integration: Integration): boolean {
  return integration.type === 'hybrid';
}

// Status badge color mapping
export const statusColors: Record<IntegrationStatus, string> = {
  connected: '#9EFFBF',
  disconnected: '#888888',
  error: '#FF6B6B',
  syncing: '#FFD93D',
};

// Type display info
export const typeInfo: Record<IntegrationType, { label: string; description: string }> = {
  oauth: { label: 'OAuth', description: 'Sign in with your account' },
  api_key: { label: 'API Key', description: 'Enter your API key' },
  browser: { label: 'Browser', description: 'Automated browser login' },
  file: { label: 'File Upload', description: 'Upload configuration files' },
  webhook: { label: 'Webhook', description: 'Receive events via webhook' },
  hybrid: { label: 'Hybrid', description: 'Multiple connection methods' },
};
