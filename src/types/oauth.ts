/**
 * OAuth-specific types for the integration system
 */

import { OAuthProvider } from '@/lib/oauth/providers';

/**
 * OAuth flow record stored in the database
 */
export interface OAuthFlowRecord {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  state: string;
  status: 'pending' | 'completed' | 'failed';
  scopes: string[];
  error_message?: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
}

/**
 * User integration record stored in the database
 */
export interface UserIntegrationRecord {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scope: string | null;
  account_id: string | null;
  account_email: string | null;
  account_name: string | null;
  account_picture: string | null;
  team_id: string | null;
  team_name: string | null;
  status: 'connected' | 'disconnected' | 'error';
  raw_response: string;
  created_at: string;
  updated_at: string;
}

/**
 * API response for integration list
 */
export interface IntegrationListItem {
  id: string;
  provider: OAuthProvider;
  providerName: string;
  accountEmail: string | null;
  accountName: string | null;
  accountPicture: string | null;
  teamName: string | null;
  status: 'connected' | 'disconnected' | 'error' | 'expired';
  connectedAt: string;
  scopes: string[];
  expiresAt: string | null;
}

/**
 * API response for integration status check
 */
export interface IntegrationStatusResponse {
  connected: boolean;
  provider: OAuthProvider;
  providerName: string;
  status?: string;
  tokenStatus?: 'valid' | 'expired' | 'refreshed';
  account?: {
    id: string | null;
    email: string | null;
    name: string | null;
    picture: string | null;
    teamId: string | null;
    teamName: string | null;
  };
  connectedAt?: string;
  expiresAt?: string | null;
  scopes?: string[];
}

/**
 * OAuth start request body
 */
export interface OAuthStartRequest {
  provider: OAuthProvider;
  scopes?: string[];
}

/**
 * OAuth start response
 */
export interface OAuthStartResponse {
  success: boolean;
  provider: OAuthProvider;
  authorizationUrl: string;
  state: string;
  scopes: string[];
}
