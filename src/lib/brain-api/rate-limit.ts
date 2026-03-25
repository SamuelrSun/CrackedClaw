/**
 * Brain Public API — per-user, per-endpoint in-memory rate limiter.
 *
 * Limits are enforced per userId+endpoint combination using a sliding
 * fixed-window counter. The bucket map is periodically pruned to prevent
 * unbounded memory growth.
 *
 * Endpoint limits (requests per minute):
 *   recall   — 60 req/min  (read-only, lightweight)
 *   remember — 30 req/min  (write, embeds one fact)
 *   update   — 30 req/min  (write, re-embeds)
 *   forget   — 30 req/min  (delete)
 *   profile  — 30 req/min  (aggregation query)
 *   extract  — 10 req/min  (LLM call — Haiku)
 *   import   —  5 req/min  (bulk embed + dedup — heavy)
 *   default  — 30 req/min
 */

export type RateLimitedEndpoint =
  | 'recall'
  | 'remember'
  | 'update'
  | 'forget'
  | 'profile'
  | 'extract'
  | 'import';

const LIMITS: Record<RateLimitedEndpoint | 'default', number> = {
  recall: 60,
  remember: 30,
  update: 30,
  forget: 30,
  profile: 30,
  extract: 10,
  import: 5,
  default: 30,
};

const WINDOW_MS = 60_000; // 1 minute

interface Bucket {
  count: number;
  resetAt: number;
}

// key → `${userId}:${endpoint}`
const buckets = new Map<string, Bucket>();

// Prune expired buckets once per window to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}, WINDOW_MS).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (only set when !allowed) */
  retryAfter: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Total limit for this endpoint */
  limit: number;
}

/**
 * Check (and increment) the rate-limit counter for a user+endpoint pair.
 *
 * @param userId   Authenticated user's UUID
 * @param endpoint Endpoint identifier (e.g. 'recall', 'import')
 */
export function checkRateLimit(
  userId: string,
  endpoint: RateLimitedEndpoint | string,
): RateLimitResult {
  const limit = LIMITS[endpoint as RateLimitedEndpoint] ?? LIMITS.default;
  const bucketKey = `${userId}:${endpoint}`;
  const now = Date.now();

  let bucket = buckets.get(bucketKey);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(bucketKey, bucket);
  }

  bucket.count++;

  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0, limit };
  }

  return {
    allowed: true,
    retryAfter: 0,
    remaining: Math.max(0, limit - bucket.count),
    limit,
  };
}
