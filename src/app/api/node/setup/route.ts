import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/node/setup?token=GATEWAY_AUTH_TOKEN
 *
 * Returns setup instructions for CrackedClaw Connect.
 * Usage: curl -sL "https://crackedclaw.com/api/node/setup?token=YOUR_TOKEN"
 *
 * Auth: gateway token passed as `?token=` query param.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response('Missing token parameter', { status: 400 });
  }

  // Look up org by gateway token
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('openclaw_gateway_url, openclaw_auth_token, openclaw_instance_id')
    .eq('openclaw_auth_token', token)
    .single();

  if (!org) {
    return new Response('Invalid token or workspace not found', { status: 401 });
  }

  const authToken = org.openclaw_auth_token;
  const serverUrl = 'wss://companion.crackedclaw.com/api/companion/ws';

  const script = `#!/usr/bin/env bash
set -e

COMPANION_TOKEN="${authToken}"
COMPANION_SERVER="${serverUrl}"

echo ""
echo "🔌 Setting up CrackedClaw Connect..."
echo ""

# Install crackedclaw-connect if not present
if ! command -v crackedclaw-connect &>/dev/null; then
  echo "📦 Installing CrackedClaw Connect..."
  if command -v npm &>/dev/null; then
    npm install -g crackedclaw-connect 2>/dev/null || true
  fi
fi

# If npm install succeeded, use it; otherwise fall back to npx
if command -v crackedclaw-connect &>/dev/null; then
  echo "✅ CrackedClaw Connect installed"
  echo ""
  echo "🚀 Connecting to CrackedClaw..."
  echo "   Leave this window open. Press Ctrl+C to stop."
  echo ""
  exec crackedclaw-connect --token "\$COMPANION_TOKEN" --server "\$COMPANION_SERVER"
else
  echo "⚠️  Could not install crackedclaw-connect globally."
  echo ""
  echo "To connect manually, run:"
  echo "  crackedclaw-connect --token \$COMPANION_TOKEN --server \$COMPANION_SERVER"
  echo ""
  echo "Or download CrackedClaw Connect from: https://crackedclaw.com/connect"
  exit 1
fi
`;

  return new Response(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
