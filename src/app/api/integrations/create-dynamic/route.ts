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
      // If reconnecting via Maton, update the config with new connection info
      if (resolved.apiProvider === 'maton' && resolved.matonConnectionId) {
        // Fetch current config to merge
        const { data: current } = await supabase
          .from('integrations')
          .select('config')
          .eq('id', existing.id)
          .single();

        const currentConfig = (current?.config as Record<string, unknown>) ?? {};
        await supabase
          .from('integrations')
          .update({
            status: 'connected',
            config: {
              ...currentConfig,
              api_provider: 'maton',
              maton_connection_id: resolved.matonConnectionId,
            },
          })
          .eq('id', existing.id);
      }
      return jsonResponse({ message: 'Already exists', id: existing.id, integration: existing, existed: true });
    }

    const { data, error: dbErr } = await supabase
      .from('integrations')
      .insert({
        user_id: user.id,
        name: resolved.name,
        slug: resolved.slug,
        icon: resolved.icon,
        type: resolved.authType === 'browser' ? 'browser' : resolved.authType === 'api_key' ? 'api_key' : 'oauth',
        status: resolved.apiProvider === 'maton' ? 'connected' : 'disconnected',
        config: {
          needs_node: resolved.needsNode,
          login_url: resolved.loginUrl,
          api_key_label: resolved.apiKeyLabel,
          oauth_scopes: resolved.oauthScopes,
          category: resolved.category,
          capabilities: resolved.capabilities,
          is_dynamic: true,
          known_service: resolved.knownService,
          // Maton integration fields
          ...(resolved.apiProvider === 'maton' ? {
            api_provider: 'maton',
            maton_connection_id: resolved.matonConnectionId,
          } : {}),
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
