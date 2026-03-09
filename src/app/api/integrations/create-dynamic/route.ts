import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import type { ResolvedIntegration } from '@/lib/integrations/resolver';

export const dynamic = 'force-dynamic';

// POST /api/integrations/create-dynamic
// Body: { resolved: ResolvedIntegration }
// Creates an integration record from a resolved integration config
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { resolved } = await request.json() as { resolved: ResolvedIntegration };
    if (!resolved?.slug) return errorResponse('resolved integration required', 400);

    const supabase = await createClient();

    // Check if already exists (by slug, which is unique per user after migration)
    const { data: existing } = await supabase
      .from('integrations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('slug', resolved.slug)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ message: 'Already exists', id: existing.id, existed: true });
    }

    const { data, error: dbErr } = await supabase
      .from('integrations')
      .insert({
        user_id: user.id,
        name: resolved.name,
        slug: resolved.slug,
        icon: resolved.icon,
        type: resolved.authType === 'browser' ? 'browser' : resolved.authType === 'api_key' ? 'api_key' : 'oauth',
        status: 'disconnected',
        config: {
          needs_node: resolved.needsNode,
          login_url: resolved.loginUrl,
          api_key_label: resolved.apiKeyLabel,
          oauth_scopes: resolved.oauthScopes,
          category: resolved.category,
          capabilities: resolved.capabilities,
          is_dynamic: true,
          known_service: resolved.knownService,
        },
        accounts: [],
      })
      .select()
      .single();

    if (dbErr) {
      // Fallback: return the resolved config even if DB fails (maybe columns don't exist yet)
      console.error('DB insert error (may need migration):', dbErr.message);
      return jsonResponse({ resolved, created: false, dbError: dbErr.message });
    }

    return jsonResponse({ integration: data, created: true }, 201);
  } catch (e) {
    return errorResponse('Failed to create integration', 500);
  }
}
