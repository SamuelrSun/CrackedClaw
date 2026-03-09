/**
 * Browser Session Manager
 * Routes browser commands through the companion relay on the DO server.
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
  profile?: string;
}

export interface BrowserResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: string;
}

const COMPANION_TOOLS_URL = 'https://companion.crackedclaw.com/api/tools/execute';

/**
 * Send a browser command to the companion relay.
 */
export async function sendBrowserCommand(
  userId: string,
  command: BrowserCommand
): Promise<BrowserResult> {
  const node = await getNodeStatus(userId);

  if (!node.isOnline) {
    return { success: false, error: 'Node is offline. Please start crackedclaw-connect on your local machine.' };
  }

  const secret = process.env.DO_SERVER_SECRET;
  if (!secret) {
    return { success: false, error: 'DO_SERVER_SECRET not configured' };
  }

  try {
    const res = await fetch(COMPANION_TOOLS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'browser',
        nodeId: node.nodeId,
        params: {
          action: command.action,
          profile: command.profile || 'chrome',
          url: command.url,
          request: command.request,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Companion error: ${text}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Browser command failed' };
  }
}

/**
 * Start a browser session for a specific integration.
 */
export async function startIntegrationSession(
  userId: string,
  _integrationSlug: string,
  loginUrl: string
): Promise<BrowserResult> {
  return sendBrowserCommand(userId, {
    action: 'navigate',
    url: loginUrl,
    profile: 'chrome',
  });
}

/**
 * Take a snapshot of the current browser state.
 */
export async function getSnapshot(userId: string): Promise<BrowserResult> {
  return sendBrowserCommand(userId, { action: 'snapshot' });
}
