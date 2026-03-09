/**
 * GET/POST /api/integrations/oauth/start
 * Initiates OAuth flow for a provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { isValidProvider, isProviderConfigured, OAUTH_PROVIDERS } from '@/lib/oauth/providers';
import { generateStateToken, buildAuthorizationUrl, createOAuthFlow } from '@/lib/oauth/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/oauth/start?provider=google
 * Initiates OAuth flow and redirects directly to provider
 * Used for popup-based OAuth flows
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const provider = searchParams.get('provider');
  const scopesParam = searchParams.get('scopes');
  const prompt = searchParams.get('prompt') || undefined;
  const scopes = scopesParam ? scopesParam.split(',') : undefined;

  // Validate provider
  if (!provider || typeof provider !== 'string') {
    return new NextResponse('Provider is required', { status: 400 });
  }

  if (!isValidProvider(provider)) {
    return new NextResponse(
      `Invalid provider. Supported: ${Object.keys(require('@/lib/oauth/providers').OAUTH_PROVIDERS).join(', ')}` as string,
      { status: 400 }
    );
  }

  // Check if provider is configured
  if (!isProviderConfigured(provider)) {
    return new NextResponse(
      `Provider ${provider} is not configured. Check environment variables.`,
      { status: 500 }
    );
  }

  // Generate state token
  const state = generateStateToken();

  // Store OAuth flow in database
  const flowCreated = await createOAuthFlow(user.id, provider, state, scopes);
  if (!flowCreated) {
    return new NextResponse('Failed to initiate OAuth flow', { status: 500 });
  }

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(provider, state, scopes, prompt);
  if (!authUrl) {
    return new NextResponse('Failed to generate authorization URL', { status: 500 });
  }

  // Redirect to the authorization URL
  return NextResponse.redirect(authUrl);
}

/**
 * POST /api/integrations/oauth/start
 * Initiates OAuth flow and returns the authorization URL
 * Used for API-based flows
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { provider, scopes } = body;

    // Validate provider
    if (!provider || typeof provider !== 'string') {
      return errorResponse('Provider is required', 400);
    }

    if (!isValidProvider(provider)) {
      return errorResponse(
        `Invalid provider. Supported: ${Object.keys(require('@/lib/oauth/providers').OAUTH_PROVIDERS).join(', ')}` as string,
        400
      );
    }

    // Check if provider is configured
    if (!isProviderConfigured(provider)) {
      return errorResponse(
        `Provider ${provider} is not configured. Check environment variables.`,
        500
      );
    }

    // Validate scopes if provided
    if (scopes && !Array.isArray(scopes)) {
      return errorResponse('Scopes must be an array', 400);
    }

    // Generate state token
    const state = generateStateToken();

    // Store OAuth flow in database
    const flowCreated = await createOAuthFlow(user.id, provider, state, scopes);
    if (!flowCreated) {
      return errorResponse('Failed to initiate OAuth flow', 500);
    }

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(provider, state, scopes);
    if (!authUrl) {
      return errorResponse('Failed to generate authorization URL', 500);
    }

    return jsonResponse({
      success: true,
      provider,
      authorizationUrl: authUrl,
      state,
      scopes: scopes || OAUTH_PROVIDERS[provider].defaultScopes,
    });

  } catch (err) {
    console.error('OAuth start error:', err);
    return errorResponse('Invalid request body', 400);
  }
}
