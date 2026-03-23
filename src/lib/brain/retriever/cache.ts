/**
 * Brain retriever cache — avoids re-embedding on every message.
 *
 * Key: userId + hash of last N user messages
 * TTL: 2 minutes (re-evaluate as conversation shifts)
 */

import type { BrainCriterion } from '../types';

interface CacheEntry {
  criteria: BrainCriterion[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Simple string hash for cache keys.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Build a cache key from userId + recent user messages.
 */
export function buildCacheKey(userId: string, userMessages: string[]): string {
  const msgHash = hashString(userMessages.join('|||'));
  return `${userId}:${msgHash}`;
}

/**
 * Get cached criteria if still valid.
 */
export function getCached(key: string): BrainCriterion[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.criteria;
}

/**
 * Store criteria in cache with TTL.
 */
export function setCache(key: string, criteria: BrainCriterion[]): void {
  // Evict old entries if cache grows too large (>100 entries)
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
    // If still too large, clear all
    if (cache.size > 100) cache.clear();
  }

  cache.set(key, {
    criteria,
    expiresAt: Date.now() + TTL_MS,
  });
}
