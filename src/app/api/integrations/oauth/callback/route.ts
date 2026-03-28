/**
 * GET /api/integrations/oauth/callback
 * DEPRECATED: Direct OAuth callbacks are no longer supported.
 * All integrations now go through the Maton gateway.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const html = `
<!DOCTYPE html>
<html>
<head><title>Deprecated</title>
<style>
  body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .container { text-align: center; padding: 2rem; }
  .message { color: #666; font-size: 14px; }
</style>
</head>
<body>
  <div class="container">
    <p class="message">This OAuth callback is no longer in use. Closing...</p>
  </div>
  <script>
    try { window.opener?.postMessage({ type: "oauth_complete", success: false, error: "deprecated" }, "*"); } catch {}
    setTimeout(() => window.close(), 2000);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
