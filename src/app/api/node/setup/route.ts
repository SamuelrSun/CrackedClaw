import { jsonResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/node/setup?token=GATEWAY_AUTH_TOKEN
 *
 * Returns a bash script that:
 * 1. Installs openclaw CLI if not present
 * 2. Reads the local device identity (~/.openclaw/identity/)
 * 3. POSTs device info to /api/node/pre-pair to pre-register the device
 * 4. Runs `openclaw node run --tls --host <gateway_host>`
 *
 * Auth: gateway token passed as `?token=` query param.
 * Usage: curl -sL "https://crackedclaw.com/api/node/setup?token=YOUR_TOKEN" | bash
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

  if (!org?.openclaw_gateway_url) {
    return new Response('Invalid token or workspace not found', { status: 401 });
  }

  let gatewayHost: string;
  try {
    gatewayHost = new URL(org.openclaw_gateway_url).hostname;
  } catch {
    return new Response('Invalid gateway URL', { status: 500 });
  }

  const authToken = org.openclaw_auth_token;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crackedclaw.com';

  const script = `#!/usr/bin/env bash
set -e

GATEWAY_HOST="${gatewayHost}"
APP_URL="${appUrl}"
GATEWAY_TOKEN="${authToken}"

echo ""
echo "🔧 Setting up OpenClaw node..."
echo ""

# Step 1: Install openclaw CLI if not present
if ! command -v openclaw &>/dev/null; then
  echo "📦 Installing OpenClaw CLI..."
  if command -v npm &>/dev/null; then
    npm install -g openclaw
  else
    echo "❌ Please install Node.js (https://nodejs.org) first, then re-run this command."
    exit 1
  fi
  echo "✅ OpenClaw installed"
else
  echo "✅ OpenClaw already installed ($(openclaw --version 2>/dev/null || echo 'unknown version'))"
fi

# Step 2: Initialize openclaw identity if needed
IDENTITY_DIR="\$HOME/.openclaw/identity"
if [ ! -f "\$IDENTITY_DIR/device.json" ]; then
  echo "🔑 Initializing device identity..."
  openclaw identity init 2>/dev/null || openclaw init 2>/dev/null || true
  sleep 1
fi

# Step 3: Read device identity
if [ ! -f "\$IDENTITY_DIR/device.json" ]; then
  echo "❌ Could not initialize device identity at \$IDENTITY_DIR/device.json"
  echo "   This may be a version issue. Try: openclaw --help"
  exit 1
fi

DEVICE_ID=\$(node -e "try{const f=require('\$IDENTITY_DIR/device.json');console.log(f.deviceId||f.id||'')}catch(e){}" 2>/dev/null)
PUBLIC_KEY=\$(node -e "try{const f=require('\$IDENTITY_DIR/device.json');console.log(f.publicKey||'')}catch(e){}" 2>/dev/null)

if [ -z "\$DEVICE_ID" ]; then
  echo "❌ Could not read deviceId from device.json"
  cat "\$IDENTITY_DIR/device.json" 2>/dev/null | head -5
  exit 1
fi

# Read existing node token from device-auth.json
AUTH_FILE="\$HOME/.openclaw/identity/device-auth.json"
NODE_TOKEN=""
if [ -f "\$AUTH_FILE" ]; then
  NODE_TOKEN=\$(node -e "
    try {
      const f = require('\$AUTH_FILE');
      const tokens = f.tokens || {};
      const t = tokens.node || tokens.operator || Object.values(tokens)[0] || {};
      console.log(t.token || '');
    } catch(e) { console.log(''); }
  " 2>/dev/null)
fi

# Generate a token if none found
if [ -z "\$NODE_TOKEN" ]; then
  NODE_TOKEN=\$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" 2>/dev/null)
fi

PLATFORM=\$(uname -s | tr '[:upper:]' '[:lower:]')
DISPLAY_NAME=\$(hostname -s 2>/dev/null || echo "User Node")

echo "🔗 Registering device with your workspace..."

# Step 4: Pre-register device with CrackedClaw
HTTP_STATUS=\$(curl -sf -o /tmp/openclaw-pair-response.json -w "%{http_code}" -X POST "\$APP_URL/api/node/pre-pair" \\
  -H "Content-Type: application/json" \\
  -H "X-Gateway-Token: \$GATEWAY_TOKEN" \\
  -d "{
    \\"deviceId\\": \\"\$DEVICE_ID\\",
    \\"publicKey\\": \\"\$PUBLIC_KEY\\",
    \\"token\\": \\"\$NODE_TOKEN\\",
    \\"displayName\\": \\"\$DISPLAY_NAME\\",
    \\"platform\\": \\"\$PLATFORM\\"
  }" 2>/dev/null || echo "000")

RESPONSE=\$(cat /tmp/openclaw-pair-response.json 2>/dev/null || echo "")

if [ "\$HTTP_STATUS" = "200" ] || echo "\$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Device registered!"
else
  echo "⚠️  Pre-registration failed (status: \$HTTP_STATUS). Continuing anyway..."
  echo "   Response: \$RESPONSE"
fi

# Step 5: Run the node
echo ""
echo "🚀 Starting OpenClaw node..."
echo "   Connecting to: \$GATEWAY_HOST"
echo "   Leave this window open. Press Ctrl+C to stop."
echo ""

export OPENCLAW_GATEWAY_TOKEN="\$GATEWAY_TOKEN"
exec openclaw node run --tls --host "\$GATEWAY_HOST"
`;

  return new Response(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
