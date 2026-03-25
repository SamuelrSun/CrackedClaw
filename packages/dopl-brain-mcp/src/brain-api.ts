/**
 * src/brain-api.ts
 *
 * HTTP client for the Dopl Brain REST API.
 *
 * All requests are authenticated via the `Authorization: Bearer <token>` header.
 * The token is sourced from the `DOPL_BRAIN_TOKEN` environment variable.
 * The base URL defaults to `https://usedopl.com` and can be overridden via
 * `DOPL_BRAIN_URL` for local development or self-hosted deployments.
 *
 * This module is intentionally free of any framework or SDK dependencies —
 * it uses only the native `fetch` API (available in Node.js 18+).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
}

export interface RememberResponse {
  id: string;
  created: boolean;
}

export interface UpdateResponse {
  id: string;
  updated: boolean;
}

export interface ForgetResponse {
  deleted: boolean;
}

export interface ProfileDomain {
  domain: string;
  fact_count: number;
  last_updated?: string;
}

export interface ProfileResponse {
  user_id: string;
  domains: ProfileDomain[];
  fact_count: number;
  last_updated: string | null;
}

export interface ExtractedFact {
  content: string;
  domain?: string;
  source?: string;
}

export interface ExtractResponse {
  facts: ExtractedFact[];
}

export interface ImportResponse {
  imported: number;
  skipped_duplicates: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class BrainApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'BrainApiError';
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class BrainApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(token: string, baseUrl?: string) {
    this.token = token;
    this.baseUrl = (baseUrl ?? 'https://usedopl.com').replace(/\/$/, '');
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BrainApiError(
        `Network error reaching Dopl Brain API: ${message}`,
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }

      const errorMessage =
        typeof errorBody === 'object' &&
        errorBody !== null &&
        'error' in errorBody
          ? String((errorBody as { error: unknown }).error)
          : `HTTP ${response.status} ${response.statusText}`;

      throw new BrainApiError(
        `Dopl Brain API error: ${errorMessage}`,
        response.status,
        errorBody,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Public API methods
  // -------------------------------------------------------------------------

  /**
   * Semantic search across stored memories.
   */
  async recall(params: {
    query: string;
    domain?: string;
    limit?: number;
  }): Promise<RecallResponse> {
    return this.request<RecallResponse>('POST', '/api/brain/recall', params);
  }

  /**
   * Store a new fact in the brain.
   */
  async remember(params: {
    fact: string;
    domain?: string;
    source?: string;
  }): Promise<RememberResponse> {
    return this.request<RememberResponse>('POST', '/api/brain/remember', params);
  }

  /**
   * Update an existing fact by ID.
   */
  async update(params: {
    id: string;
    content: string;
  }): Promise<UpdateResponse> {
    return this.request<UpdateResponse>('PATCH', '/api/brain/update', params);
  }

  /**
   * Delete a fact by ID.
   */
  async forget(params: { id: string }): Promise<ForgetResponse> {
    return this.request<ForgetResponse>('DELETE', '/api/brain/forget', params);
  }

  /**
   * Retrieve the user's brain profile (name, domains, fact count).
   */
  async profile(): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('GET', '/api/brain/profile');
  }

  /**
   * Extract structured facts from a block of free-form text.
   */
  async extract(params: {
    text: string;
    max_facts?: number;
  }): Promise<ExtractResponse> {
    return this.request<ExtractResponse>('POST', '/api/brain/extract', params);
  }

  /**
   * Batch import a list of extracted facts, optionally deduplicating.
   */
  async import(params: {
    facts: ExtractedFact[];
    deduplicate?: boolean;
  }): Promise<ImportResponse> {
    return this.request<ImportResponse>('POST', '/api/brain/import', params);
  }
}

// ---------------------------------------------------------------------------
// Factory — reads config from environment variables
// ---------------------------------------------------------------------------

/**
 * Create a BrainApiClient from environment variables.
 * Throws a descriptive error if `DOPL_BRAIN_TOKEN` is not set.
 */
export function createClientFromEnv(): BrainApiClient {
  const token = process.env.DOPL_BRAIN_TOKEN;
  if (!token) {
    throw new Error(
      'DOPL_BRAIN_TOKEN environment variable is not set.\n' +
        'Get your token at https://usedopl.com/settings and set it:\n' +
        '  export DOPL_BRAIN_TOKEN=dpb_sk_your_token_here',
    );
  }

  const baseUrl = process.env.DOPL_BRAIN_URL;
  return new BrainApiClient(token, baseUrl);
}
