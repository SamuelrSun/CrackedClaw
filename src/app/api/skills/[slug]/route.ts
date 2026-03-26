import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CLAWHUB_BASE = 'https://clawhub.ai';

// ── Types ──────────────────────────────────────────────────────────────────

interface ClawHubSkillStats {
  comments?: number;
  downloads?: number;
  installsAllTime?: number;
  installsCurrent?: number;
  stars?: number;
  versions?: number;
}

interface ClawHubOwner {
  handle?: string;
  displayName?: string;
  image?: string;
}

interface ClawHubLatestVersion {
  version?: string;
  changelog?: string;
  license?: string;
}

interface ClawHubSkillResponse {
  skill?: {
    slug?: string;
    displayName?: string;
    summary?: string;
    tags?: Record<string, string> | string[];
    stats?: ClawHubSkillStats;
  };
  owner?: ClawHubOwner;
  latestVersion?: ClawHubLatestVersion;
}

interface NormalizedSkillDetail {
  slug: string;
  displayName: string;
  summary: string;
  tags: string[];
  stats: ClawHubSkillStats;
  owner: ClawHubOwner;
  latestVersion: ClawHubLatestVersion;
  readme: string | null;
  // Flattened for frontend
  version?: string;
  changelog?: string | null;
  license?: string | null;
  downloads?: number;
  installs?: number;
  stars?: number;
  versions?: number;
}

// ── Cache (5 min TTL) ──────────────────────────────────────────────────────

interface CacheEntry {
  data: NormalizedSkillDetail;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(slug: string): NormalizedSkillDetail | null {
  const entry = cache.get(slug);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(slug);
    return null;
  }
  return entry.data;
}

function setCache(slug: string, data: NormalizedSkillDetail): void {
  cache.set(slug, { data, expiresAt: Date.now() + 5 * 60_000 });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeTags(raw: Record<string, string> | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Record<tagName, version> — just return the keys
  return Object.keys(raw);
}

async function fetchReadme(slug: string, version: string): Promise<string | null> {
  try {
    const url = new URL(`/api/v1/skills/${encodeURIComponent(slug)}/file`, CLAWHUB_BASE);
    url.searchParams.set('path', 'SKILL.md');
    if (version) url.searchParams.set('version', version);

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'text/plain, */*' },
      signal: AbortSignal.timeout(8_000),
    });

    if (res.ok) {
      return await res.text();
    }
    return null;
  } catch {
    return null;
  }
}

// ── Route ──────────────────────────────────────────────────────────────────

/**
 * GET /api/skills/[slug]
 * Returns full skill metadata + SKILL.md readme content.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { slug } = await params;
  if (!slug) {
    return jsonResponse({ error: 'Slug is required' }, 400);
  }

  const cached = getCached(slug);
  if (cached) {
    return jsonResponse({ skill: cached, cached: true });
  }

  try {
    const metaUrl = `${CLAWHUB_BASE}/api/v1/skills/${encodeURIComponent(slug)}`;
    const res = await fetch(metaUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return jsonResponse({ error: 'Skill not found' }, 404);
      }
      return jsonResponse({ error: `ClawHub returned ${res.status}` }, 502);
    }

    const json = await res.json() as ClawHubSkillResponse;
    const skillData = json.skill;

    if (!skillData) {
      return jsonResponse({ error: 'Skill not found' }, 404);
    }

    const version = json.latestVersion?.version ?? '';

    // Fetch SKILL.md concurrently (best-effort)
    const readme = await fetchReadme(slug, version);

    const normalized: NormalizedSkillDetail = {
      slug: skillData.slug ?? slug,
      displayName: skillData.displayName ?? slug,
      summary: skillData.summary ?? '',
      tags: normalizeTags(skillData.tags),
      stats: skillData.stats ?? {},
      owner: json.owner ?? {},
      latestVersion: json.latestVersion ?? {},
      readme,
      // Flatten for frontend consumption
      version: json.latestVersion?.version ?? '',
      changelog: json.latestVersion?.changelog ?? null,
      license: json.latestVersion?.license ?? null,
      downloads: skillData.stats?.downloads ?? 0,
      installs: skillData.stats?.installsAllTime ?? 0,
      stars: skillData.stats?.stars ?? 0,
      versions: skillData.stats?.versions ?? 0,
    };

    setCache(slug, normalized);
    return jsonResponse({ skill: normalized });
  } catch (err) {
    console.error(`Skills detail fetch error for "${slug}":`, err);
    return jsonResponse({ skill: null, error: 'Failed to reach ClawHub' });
  }
}

/**
 * DELETE /api/skills/[slug]
 * Uninstall a skill by its ID/slug.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { slug } = await params;
  if (!slug) {
    return jsonResponse({ error: 'Slug is required' }, 400);
  }

  const supabase = await createClient();
  await supabase.from('installed_skills').delete().eq('user_id', user.id).eq('skill_id', slug);
  return jsonResponse({ message: 'Skill uninstalled', slug });
}
