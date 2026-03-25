import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api-auth";

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

const KEY_PREFIX = "dpb_sk_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(16).toString("hex"); // 32 hex chars
  const key = `${KEY_PREFIX}${random}`;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, KEY_PREFIX.length + 8); // e.g. dpb_sk_a1b2c3d4
  return { key, hash, prefix };
}

// ---------------------------------------------------------------------------
// In-memory rate limiter — 100 requests/min per key
// ---------------------------------------------------------------------------

const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(keyId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(keyId);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(keyId, bucket);
  }

  bucket.count++;

  if (bucket.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}

// Periodic cleanup so the map doesn't grow unbounded
if (typeof globalThis !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of rateBuckets) {
      if (now >= bucket.resetAt) rateBuckets.delete(key);
    }
  }, RATE_WINDOW_MS);
  // Don't prevent process exit
  if (timer && typeof timer === "object" && "unref" in timer) {
    (timer as NodeJS.Timeout).unref();
  }
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  return response;
}

// ---------------------------------------------------------------------------
// Main auth function
// ---------------------------------------------------------------------------

export interface BrainAuthResult {
  user: { id: string };
  keyId?: string;
  keyName?: string;
  error?: never;
}

export interface BrainAuthError {
  user?: never;
  keyId?: never;
  keyName?: never;
  error: NextResponse;
}

/**
 * Authenticate a Brain API request.
 * Tries API key auth first (`Authorization: Bearer dpb_sk_...`),
 * then falls back to Supabase session auth for web-app requests.
 */
export async function requireBrainAuth(
  request: NextRequest,
): Promise<BrainAuthResult | BrainAuthError> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // --- API key path ---
  if (token.startsWith(KEY_PREFIX)) {
    const hash = hashApiKey(token);
    const admin = createAdminClient();

    const { data: keyRow, error: dbErr } = await admin
      .from("brain_api_keys")
      .select("id, user_id, name, request_count")
      .eq("key_hash", hash)
      .is("revoked_at", null)
      .maybeSingle();

    if (dbErr || !keyRow) {
      return { error: withCors(NextResponse.json({ error: "Invalid API key" }, { status: 401 })) };
    }

    // Rate limit
    const rl = checkRateLimit(keyRow.id);
    if (!rl.allowed) {
      const res = NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(rl.retryAfter));
      return { error: withCors(res) };
    }

    // Fire-and-forget: update last_used_at and increment request_count
    void admin
      .from("brain_api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        request_count: (keyRow.request_count ?? 0) + 1,
      })
      .eq("id", keyRow.id)
      .then(() => {})
      .catch(() => {});

    return {
      user: { id: keyRow.user_id },
      keyId: keyRow.id,
      keyName: keyRow.name,
    };
  }

  // --- Supabase session fallback ---
  const { user, error } = await requireApiAuth();
  if (error) {
    return { error: withCors(error) };
  }

  return { user: user! };
}
