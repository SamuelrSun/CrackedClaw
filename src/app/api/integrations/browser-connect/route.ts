/**
 * POST /api/integrations/browser-connect
 * 
 * Initiates a browser-based integration connection.
 * Creates a pending user_integrations record, then instructs the OpenClaw
 * gateway to open a browser profile to the login page.
 * 
 * The gateway agent opens the browser, waits for user login, verifies it,
 * then calls /api/integrations/browser-connect/verify to confirm.
 * 
 * Body: { provider: string }
 * Returns: { success: boolean, integration_id: string, status: 'pending' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { INTEGRATIONS } from '@/lib/integrations/registry';
import { getUserInstance, chatThroughGateway } from '@/lib/gateway/openclaw-proxy';

export const dynamic = 'force-dynamic';

// Map provider IDs to their login URLs and verification checks
const BROWSER_PROVIDERS: Record<string, { loginUrl: string; verifyUrl: string; cookieName?: string }> = {
  linkedin: {
    loginUrl: 'https://www.linkedin.com/login',
    verifyUrl: 'https://www.linkedin.com/feed/',
  },
  instagram: {
    loginUrl: 'https://www.instagram.com/accounts/login/',
    verifyUrl: 'https://www.instagram.com/',
  },
  facebook: {
    loginUrl: 'https://www.facebook.com/login',
    verifyUrl: 'https://www.facebook.com/',
  },
  tiktok: {
    loginUrl: 'https://www.tiktok.com/login',
    verifyUrl: 'https://www.tiktok.com/foryou',
  },
  twitter: {
    loginUrl: 'https://x.com/i/flow/login',
    verifyUrl: 'https://x.com/home',
  },
};

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { provider } = await request.json();

    if (!provider || typeof provider !== 'string') {
      return errorResponse('provider is required', 400);
    }

    // Validate it's a browser-login provider
    const regEntry = INTEGRATIONS.find(r => r.id === provider);
    if (!regEntry) {
      return errorResponse(`Unknown provider: ${provider}`, 400);
    }

    const browserConfig = BROWSER_PROVIDERS[provider];
    if (!browserConfig && regEntry.authType !== 'browser-login') {
      return errorResponse(`${provider} is not a browser-login integration`, 400);
    }

    const supabase = await createClient();

    // Check if user has an active OpenClaw instance (needed for browser)
    const instance = await getUserInstance(user.id);
    if (!instance) {
      return errorResponse('No active agent instance. Please set up your agent first.', 400);
    }

    // Check for existing connection
    const { data: existing } = await supabase
      .from('user_integrations')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .maybeSingle();

    let integrationId: string;

    if (existing) {
      // Update existing to pending
      await supabase
        .from('user_integrations')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      integrationId = existing.id;
    } else {
      // Create new pending integration
      const { data: newInt, error: insertErr } = await supabase
        .from('user_integrations')
        .insert({
          user_id: user.id,
          provider,
          status: 'pending',
          account_email: null,
          account_name: null,
        })
        .select('id')
        .single();

      if (insertErr || !newInt) {
        console.error('[browser-connect] Insert failed:', insertErr);
        return errorResponse('Failed to create integration record', 500);
      }
      integrationId = newInt.id;
    }

    const loginUrl = browserConfig?.loginUrl || `https://${provider}.com/login`;
    const verifyUrl = browserConfig?.verifyUrl || `https://${provider}.com`;

    // Send instruction to the gateway agent to open browser
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://usedopl.com';
    const pushSecret = process.env.CHAT_PUSH_SECRET || 'dopl-push-2026';

    // Fire-and-forget: tell the gateway to open browser for login
    chatThroughGateway(
      user.id,
      [{
        role: 'user',
        content: `SYSTEM INSTRUCTION: Open a browser for the user to log into ${regEntry.name}.

Steps:
1. Open browser with profile="${provider}" to URL: ${loginUrl}
2. Tell the user the browser is open and they should log in
3. Wait for them to confirm they've logged in (or check periodically by navigating to ${verifyUrl} and seeing if it loads without redirecting to login)
4. Once login is confirmed, extract the user's display name or account info from the page if possible
5. When verified, call this endpoint to confirm:
   exec({ command: 'curl -s -X POST ${appUrl}/api/integrations/browser-connect/verify -H "Content-Type: application/json" -d \'{"user_id":"${user.id}","provider":"${provider}","integration_id":"${integrationId}","status":"connected","push_secret":"${pushSecret}","account_name":"<extracted name or email>"}\'' })

IMPORTANT: This is a background task. Open the browser and let the user know it's ready.`,
      }],
    ).catch(err => {
      console.error('[browser-connect] Gateway chat failed:', err);
    });

    return jsonResponse({ 
      success: true, 
      integration_id: integrationId, 
      status: 'pending',
      message: `Opening ${regEntry.name} login in browser...`,
    });
  } catch (err) {
    console.error('[browser-connect] Error:', err);
    return errorResponse('Failed to initiate browser connection', 500);
  }
}
