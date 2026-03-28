/**
 * Shared Maton connection flow — used by integrations page, connections popup, and dynamic cards.
 * Creates a Maton connection, opens OAuth popup if needed, polls for completion.
 */

interface MatonConnectResult {
  success: boolean;
  error?: string;
}

interface MatonConnectOptions {
  /** Registry ID or Maton app name (e.g. "google", "slack") */
  app: string;
  /** Called when connection becomes active */
  onConnected?: () => void;
  /** Called on failure with error message */
  onError?: (error: string) => void;
}

export async function connectViaMaton({ app, onConnected, onError }: MatonConnectOptions): Promise<MatonConnectResult> {
  try {
    const res = await fetch('/api/integrations/maton/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app }),
    });
    const data = await res.json();

    if (!res.ok) {
      const error = data.error || `Failed to connect ${app}`;
      onError?.(error);
      return { success: false, error };
    }

    if (!data.connectionId) {
      const error = `No connection created for ${app}`;
      onError?.(error);
      return { success: false, error };
    }

    // No OAuth needed — immediately active
    if (!data.oauthUrl) {
      syncWorkspace();
      onConnected?.();
      return { success: true };
    }

    // Open OAuth popup
    const { connectionId, oauthUrl } = data;
    const width = 600, height = 700;
    const left = (typeof window !== 'undefined' ? window.screenX : 0) + ((typeof window !== 'undefined' ? window.innerWidth : 800) - width) / 2;
    const top = (typeof window !== 'undefined' ? window.screenY : 0) + ((typeof window !== 'undefined' ? window.innerHeight : 600) - height) / 2;
    const popup = window.open(
      oauthUrl,
      'maton_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      const error = 'Popup blocked — please allow popups for this site';
      onError?.(error);
      return { success: false, error };
    }

    // Poll Maton for connection status (up to ~2 min)
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const statusRes = await fetch(`/api/integrations/maton/status?connectionId=${connectionId}`);
        const statusData = await statusRes.json();
        if (statusData.status === 'ACTIVE') {
          if (!popup.closed) popup.close();
          syncWorkspace();
          onConnected?.();
          return { success: true };
        }
        if (statusData.status === 'FAILED') {
          if (!popup.closed) popup.close();
          const error = 'Connection failed or was rejected';
          onError?.(error);
          return { success: false, error };
        }
      } catch { /* continue polling */ }
      if (popup.closed && i > 5) break;
    }

    const error = 'Connection timed out. Please try again.';
    onError?.(error);
    return { success: false, error };
  } catch {
    const error = `Failed to connect ${app}`;
    onError?.(error);
    return { success: false, error };
  }
}

/** Fire-and-forget workspace sync after connection change */
function syncWorkspace() {
  fetch('/api/integrations/sync-workspace', { method: 'POST' }).catch(() => {});
}
