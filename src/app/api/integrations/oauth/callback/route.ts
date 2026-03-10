/**
 * GET /api/integrations/oauth/callback
 * Handles OAuth callback from providers
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidProvider } from '@/lib/oauth/providers';
import {
  verifyOAuthFlow,
  updateOAuthFlowStatus,
  exchangeCodeForTokens,
  fetchUserInfo,
  storeUserIntegration,
  OAuthUserInfo,
} from '@/lib/oauth/utils';

// Generate HTML that posts message to parent window and closes
function generateCallbackHtml(success: boolean, provider: string, accountName?: string, error?: string) {
  const message = JSON.stringify({
    type: 'oauth_complete',
    provider,
    success,
    accountName,
    error,
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Connecting...</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e5e5;
      border-top-color: #3a3a38;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .message {
      color: #666;
      font-size: 14px;
    }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p class="message ${success ? 'success' : 'error'}">
      ${success ? 'Connected! Closing...' : error || 'Connection failed'}
    </p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(${message}, '*');
      }
    } catch (e) {
      console.error('Failed to post message:', e);
    }
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>
  `.trim();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error('CRITICAL: NEXT_PUBLIC_APP_URL is not set — OAuth redirects will fail in production');
  }
  const baseUrl = appUrl || 'http://localhost:3000';
  const redirectBase = `${baseUrl}/integrations`;

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error from provider:', error, errorDescription);
    const errorMsg = errorDescription || error;
    if (state) {
      await updateOAuthFlowStatus(state, 'failed', errorMsg);
    }
    
    // If this is a popup, post message and close
    const isPopup = searchParams.get('popup') === 'true' || request.headers.get('sec-fetch-dest') === 'document';
    if (isPopup) {
      return new NextResponse(generateCallbackHtml(false, 'unknown', undefined, errorMsg), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    
    return NextResponse.redirect(
      `${redirectBase}?error=${encodeURIComponent(errorMsg)}`
    );
  }

  // Validate required params
  if (!code || !state) {
    return new NextResponse(generateCallbackHtml(false, 'unknown', undefined, 'Missing code or state'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    // Verify the OAuth flow exists and is pending
    const flow = await verifyOAuthFlow(state);
    if (!flow) {
      return new NextResponse(generateCallbackHtml(false, 'unknown', undefined, 'Invalid or expired state'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const { provider, user_id } = flow;

    // Validate provider type
    if (!isValidProvider(provider)) {
      await updateOAuthFlowStatus(state, 'failed', 'Invalid provider');
      return new NextResponse(generateCallbackHtml(false, provider, undefined, 'Invalid provider'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(provider, code);
    if (!tokens || !tokens.access_token) {
      await updateOAuthFlowStatus(state, 'failed', 'Token exchange failed');
      return new NextResponse(generateCallbackHtml(false, provider, undefined, 'Failed to authenticate'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Fetch user info based on provider
    let userInfo: OAuthUserInfo | null = null;

    if (provider === 'notion') {
      // Notion returns user info in the token response
      if (tokens.owner?.user) {
        userInfo = {
          id: tokens.owner.user.id,
          name: tokens.owner.user.name,
          email: tokens.owner.user.person?.email,
          picture: tokens.owner.user.avatar_url,
        };
      }
      // Also include workspace info
      if (tokens.workspace_name) {
        userInfo = {
          ...userInfo,
          teamName: tokens.workspace_name,
          teamId: tokens.workspace_id,
        };
      }
    } else if (provider === 'slack') {
      // For Slack, user info is partially in token response
      const accessToken = tokens.authed_user?.access_token || tokens.access_token;
      userInfo = await fetchUserInfo(provider, accessToken);
      
      // Supplement with team info from token response
      if (tokens.team) {
        userInfo = {
          ...userInfo,
          teamId: tokens.team.id,
          teamName: tokens.team.name,
        };
      }
    } else {
      // Google and others - fetch user info separately
      userInfo = await fetchUserInfo(provider, tokens.access_token);
    }

    // Store the integration
    const integrationId = await storeUserIntegration(
      user_id,
      provider,
      tokens,
      userInfo
    );

    if (!integrationId) {
      await updateOAuthFlowStatus(state, 'failed', 'Failed to store integration');
      return new NextResponse(generateCallbackHtml(false, provider, undefined, 'Failed to save connection'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Mark flow as completed
    await updateOAuthFlowStatus(state, 'completed');

    // Get account name for display
    const accountName = userInfo?.email || userInfo?.name || userInfo?.teamName || 'Connected';

    // Return HTML that posts message to parent and closes popup
    return new NextResponse(generateCallbackHtml(true, provider, accountName), {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (err) {
    console.error('OAuth callback error:', err);
    if (state) {
      await updateOAuthFlowStatus(state, 'failed', 'Unexpected error');
    }
    return new NextResponse(generateCallbackHtml(false, 'unknown', undefined, 'An unexpected error occurred'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
