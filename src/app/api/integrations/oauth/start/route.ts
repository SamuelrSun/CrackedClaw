/**
 * GET /api/integrations/oauth/start
 * DEPRECATED: Direct OAuth is no longer supported.
 * All integrations now go through the Maton gateway.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider') || 'unknown';
  
  // Return HTML that shows a message and closes the popup
  const html = `
<!DOCTYPE html>
<html>
<head><title>Integration Moved</title>
<style>
  body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .container { text-align: center; padding: 2rem; max-width: 400px; }
  .message { color: #666; font-size: 14px; line-height: 1.6; }
  h2 { color: #333; }
</style>
</head>
<body>
  <div class="container">
    <h2>Connection Method Updated</h2>
    <p class="message">
      Direct OAuth for ${provider} has been replaced with Maton gateway connections.<br /><br />
      Please close this window and use the Connect button in the Integrations page.
    </p>
  </div>
  <script>setTimeout(() => window.close(), 5000);</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
