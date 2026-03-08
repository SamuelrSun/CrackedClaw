/**
 * Browser Session Manager
 * Routes browser commands through the user's paired local node.
 * This is how browser-only integrations (LinkedIn, WhatsApp, etc.) work:
 * the user is already logged in on their Mac — we just drive it remotely.
 */

import { getNodeStatus } from './status';

export interface BrowserCommand {
  action: 'navigate' | 'snapshot' | 'act' | 'screenshot' | 'evaluate';
  url?: string;
  request?: {
    kind: string;
    ref?: string;
    text?: string;
    fn?: string;
    [key: string]: unknown;
  };
  profile?: string;  // 'chrome' to use user's real Chrome (already logged in)
}

export interface BrowserResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: string;  // base64
}

/**
 * Send a browser command to the user's node.
 * Uses the 'chrome' profile by default so we operate in the user's real browser session.
 */
export async function sendBrowserCommand(
  userId: string,
  command: BrowserCommand
): Promise<BrowserResult> {
  const node = await getNodeStatus(userId);
  
  if (!node.isOnline || !node.gatewayUrl || !node.authToken) {
    return { success: false, error: 'Node is offline. Please start OpenClaw on your local machine.' };
  }

  try {
    const res = await fetch(`${node.gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${node.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'browser',
        params: {
          action: command.action,
          profile: command.profile || 'chrome',
          url: command.url,
          request: command.request,
          target: 'node',
          node: node.nodeId,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Node error: ${text}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Browser command failed' };
  }
}

/**
 * Start a browser session for a specific integration.
 * Navigates to the service's login URL in the user's browser.
 */
export async function startIntegrationSession(
  userId: string,
  integrationSlug: string,
  loginUrl: string
): Promise<BrowserResult> {
  return sendBrowserCommand(userId, {
    action: 'navigate',
    url: loginUrl,
    profile: 'chrome',
  });
}

/**
 * Take a snapshot of the current browser state (for debugging/verification).
 */
export async function getSnapshot(userId: string): Promise<BrowserResult> {
  return sendBrowserCommand(userId, { action: 'snapshot' });
}
