import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const CLAWHUB_BASE = 'https://clawhub.ai';

// ── Types ──────────────────────────────────────────────────────────────────

interface ClawHubSearchResult {
  score?: number;
  slug: string;
  displayName?: string;
  summary?: string;
  version?: string;
  updatedAt?: string;
  stats?: {
    downloads?: number;
    installsAllTime?: number;
    installsCurrent?: number;
    stars?: number;
  };
  owner?: {
    handle?: string;
    displayName?: string;
    image?: string;
  };
}

interface ClawHubBrowseResult {
  slug: string;
  displayName?: string;
  summary?: string;
  version?: string;
  updatedAt?: string;
  stats?: {
    downloads?: number;
    installsAllTime?: number;
    installsCurrent?: number;
    stars?: number;
  };
  owner?: {
    handle?: string;
    displayName?: string;
    image?: string;
  };
}

interface NormalizedSkill {
  slug: string;
  displayName: string;
  summary: string;
  downloads: number;
  installs: number;
  stars: number;
  version: string;
  updatedAt: string;
  owner: {
    handle: string;
    displayName: string;
    image: string | null;
  };
}

// ── Simple in-memory cache ─────────────────────────────────────────────────

interface CacheEntry {
  data: NormalizedSkill[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): NormalizedSkill[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NormalizedSkill[], ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Normalization ──────────────────────────────────────────────────────────

function normalizeSkill(item: ClawHubSearchResult | ClawHubBrowseResult): NormalizedSkill {
  return {
    slug: item.slug,
    displayName: item.displayName ?? item.slug,
    summary: item.summary ?? '',
    downloads: item.stats?.downloads ?? 0,
    installs: item.stats?.installsAllTime ?? item.stats?.installsCurrent ?? 0,
    stars: item.stats?.stars ?? 0,
    version: item.version ?? '',
    updatedAt: item.updatedAt ?? '',
    owner: {
      handle: item.owner?.handle ?? '',
      displayName: item.owner?.displayName ?? '',
      image: item.owner?.image ?? null,
    },
  };
}

// ── Quality filter ─────────────────────────────────────────────────────────

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/;

function isSkillTrusted(skill: NormalizedSkill): boolean {
  // Filter out non-English skills (CJK characters in name or summary)
  if (CJK_REGEX.test(skill.displayName) || CJK_REGEX.test(skill.summary)) {
    return false;
  }
  // Filter out explicitly Chinese-tagged slugs
  if (skill.slug.endsWith('-cn') || skill.slug.includes('-zh-') || skill.slug.includes('-chinese')) {
    return false;
  }
  return true;
}

// ── Route ──────────────────────────────────────────────────────────────────

/**
 * GET /api/skills/search
 * Query params:
 *   q      – search query (optional; omit for browse/explore)
 *   limit  – number of results (default 20)
 *   sort   – trending | downloads | newest | rating (used for browse)
 */
export async function GET(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);
  const sort = searchParams.get('sort') ?? 'trending';

  const cacheKey = q ? `search:${q}:${limit}` : `browse:${sort}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return jsonResponse({ skills: cached, cached: true });
  }

  try {
    let skills: NormalizedSkill[] = [];

    if (q) {
      // Search mode — 60 s TTL
      const url = new URL('/api/v1/search', CLAWHUB_BASE);
      url.searchParams.set('q', q);
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const json = await res.json() as { results?: ClawHubSearchResult[] };
        skills = (json.results ?? []).map(normalizeSkill).filter(isSkillTrusted);
      } else {
        console.error(`ClawHub search error: ${res.status}`);
        return jsonResponse({ skills: [], error: `ClawHub returned ${res.status}` });
      }

      setCache(cacheKey, skills, 60_000);
    } else {
      // Browse mode — try /api/v1/skills first, fall back to broad search if empty
      const browseUrl = new URL('/api/v1/skills', CLAWHUB_BASE);
      const clawhubSort = sort === 'rating' ? 'trending' : sort;
      browseUrl.searchParams.set('sort', clawhubSort);
      browseUrl.searchParams.set('limit', String(limit));

      const browseRes = await fetch(browseUrl.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (browseRes.ok) {
        const json = await browseRes.json() as { skills?: ClawHubBrowseResult[]; items?: ClawHubBrowseResult[] };
        const raw = json.skills ?? json.items ?? [];
        skills = raw.map(normalizeSkill).filter(isSkillTrusted);
      }

      // If browse returned empty (known ClawHub issue), fall back to a broad search
      if (skills.length === 0) {
        const fallbackQueries = ['automation', 'email', 'productivity', 'github', 'coding'];
        const allResults: NormalizedSkill[] = [];
        const seen = new Set<string>();

        for (const fq of fallbackQueries) {
          try {
            const searchUrl = new URL('/api/v1/search', CLAWHUB_BASE);
            searchUrl.searchParams.set('q', fq);
            searchUrl.searchParams.set('limit', '10');
            const searchRes = await fetch(searchUrl.toString(), {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(8_000),
            });
            if (searchRes.ok) {
              const searchJson = await searchRes.json() as { results?: ClawHubSearchResult[] };
              for (const r of searchJson.results ?? []) {
                if (!seen.has(r.slug)) {
                  const normalized = normalizeSkill(r);
                  if (isSkillTrusted(normalized)) {
                    seen.add(r.slug);
                    allResults.push(normalized);
                  }
                }
              }
            }
          } catch {
            // Continue with other queries
          }
          if (allResults.length >= limit) break;
        }

        // Sort by download count as a proxy for popularity
        skills = allResults
          .sort((a, b) => b.downloads - a.downloads)
          .slice(0, limit);
      }

      setCache(cacheKey, skills, 5 * 60_000);
    }

    return jsonResponse({ skills });
  } catch (err) {
    console.error('Skills search fetch error:', err);
    return jsonResponse({ skills: [], error: 'Failed to reach ClawHub' });
  }
}
