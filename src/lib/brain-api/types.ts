/**
 * Brain Public API — shared TypeScript types.
 *
 * Used by all /api/brain/* route handlers and the auth/rate-limit middleware.
 */

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface BrainAuthContext {
  userId: string;
  keyId?: string;
  keyName?: string;
}

// ---------------------------------------------------------------------------
// Recall  (POST /api/brain/recall)
// ---------------------------------------------------------------------------

export interface RecallRequest {
  query: string;
  domain?: string;
  limit?: number;
}

export interface RecallResult {
  id: string;
  content: string;
  domain: string;
  similarity: number;
  importance: number;
  source?: string;
  created_at: string;
}

export interface RecallResponse {
  results: RecallResult[];
  count: number;
}

// ---------------------------------------------------------------------------
// Remember  (POST /api/brain/remember)
// ---------------------------------------------------------------------------

export interface RememberRequest {
  fact: string;
  domain?: string;
  source?: string;
}

export interface RememberResponse {
  id: string | null;
  created: boolean;
}

// ---------------------------------------------------------------------------
// Update  (PATCH /api/brain/update)
// ---------------------------------------------------------------------------

export interface UpdateRequest {
  id: string;
  content: string;
}

export interface UpdateResponse {
  id: string;
  updated: boolean;
}

// ---------------------------------------------------------------------------
// Forget  (DELETE /api/brain/forget)
// ---------------------------------------------------------------------------

export interface ForgetRequest {
  id: string;
}

export interface ForgetResponse {
  id: string;
  deleted: boolean;
}

// ---------------------------------------------------------------------------
// Profile  (GET /api/brain/profile)
// ---------------------------------------------------------------------------

export interface DomainSummary {
  domain: string;
  fact_count: number;
  last_updated: string;
}

export interface ProfileResponse {
  user_id: string;
  fact_count: number;
  domains: DomainSummary[];
  last_updated: string | null;
}

// ---------------------------------------------------------------------------
// Extract  (POST /api/brain/extract)
// ---------------------------------------------------------------------------

export interface ExtractRequest {
  text: string;
  max_facts?: number;
}

export interface ExtractedFact {
  content: string;
  domain: string;
}

export interface ExtractResponse {
  facts: ExtractedFact[];
  tokens_used: {
    input: number;
    output: number;
  };
}

// ---------------------------------------------------------------------------
// Import  (POST /api/brain/import)
// ---------------------------------------------------------------------------

export interface ImportFact {
  content: string;
  domain?: string;
  source?: string;
  source_file?: string;
}

export interface ImportRequest {
  facts: ImportFact[];
  deduplicate?: boolean;
}

export interface ImportResponse {
  imported: number;
  skipped_duplicates: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Keys  (POST /api/brain/keys — action-based CRUD)
// ---------------------------------------------------------------------------

export type KeyAction = 'create' | 'revoke' | 'status';

export interface KeysRequest {
  action: KeyAction;
  name?: string;
}

export interface KeyCreateResponse {
  key: string;
  id: string;
  prefix: string;
  name: string;
  created_at: string;
}

export interface KeyStatusResponse {
  active: boolean;
  prefix: string | null;
  name: string | null;
  created_at: string | null;
}

export interface KeyRevokeResponse {
  revoked: boolean;
}
