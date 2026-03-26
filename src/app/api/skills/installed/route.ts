import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { getInstalledSkills, type InstalledSkill } from '@/lib/skills/store';

export const dynamic = 'force-dynamic';

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/skills/installed
 * Returns list of installed skills (both builtin and clawhub).
 */
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const installed = await getInstalledSkills(user.id);
    return jsonResponse({
      installed: installed.map((s: InstalledSkill) => ({
        id: s.skill_id,
        slug: s.skill_id,
        name: s.skill_name,
        version: s.version,
        source: s.source,
        installed_at: s.installed_at,
      })),
    });
  } catch (err) {
    console.error('[api/skills/installed] GET error:', err);
    return jsonResponse({ installed: [], error: 'Failed to fetch installed skills' });
  }
}

/**
 * POST /api/skills/installed
 * Install a ClawHub skill. Body: { slug: string }
 * Stores in the installed_skills table with source='clawhub'.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return errorResponse('slug is required', 400);
  }

  try {
    const supabase = await createClient();

    // Check if already installed
    const { data: existing } = await supabase
      .from('installed_skills')
      .select('id')
      .eq('user_id', user.id)
      .eq('skill_id', slug)
      .single();

    if (existing) {
      return jsonResponse({ success: true, slug, message: 'Already installed' });
    }

    // Insert into installed_skills
    const { data, error: insertError } = await supabase
      .from('installed_skills')
      .insert({
        user_id: user.id,
        skill_id: slug,
        skill_name: slug,
        version: '0.0.0',
        source: 'clawhub',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[api/skills/installed] install error:', insertError);
      return errorResponse('Failed to install skill', 500);
    }

    return jsonResponse({ success: true, slug, skill: data });
  } catch (err) {
    console.error('[api/skills/installed] POST error:', err);
    return errorResponse('Failed to install skill', 500);
  }
}

/**
 * DELETE /api/skills/installed
 * Uninstall a skill. Body: { slug: string }
 */
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return errorResponse('slug is required', 400);
  }

  try {
    const supabase = await createClient();
    const { error: deleteError } = await supabase
      .from('installed_skills')
      .delete()
      .eq('user_id', user.id)
      .eq('skill_id', slug);

    if (deleteError) {
      console.error('[api/skills/installed] uninstall error:', deleteError);
      return errorResponse('Failed to uninstall skill', 500);
    }

    return jsonResponse({ success: true, slug });
  } catch (err) {
    console.error('[api/skills/installed] DELETE error:', err);
    return errorResponse('Failed to uninstall skill', 500);
  }
}
