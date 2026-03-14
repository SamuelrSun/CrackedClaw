/**
 * Batched chat memory extraction.
 * Collects messages and extracts after:
 *   - 10+ messages accumulated, OR
 *   - 2+ minutes since last message (debounce)
 *
 * Called from the chat API routes after each response.
 * All operations are fire-and-forget — NEVER blocks the chat response.
 */

interface ChatBuffer {
  messages: Array<{ role: string; content: string }>;
  lastUpdate: number;
  conversationId?: string;
}

// In-memory buffer per user (resets on server restart — acceptable)
const buffers = new Map<string, ChatBuffer>();

const FLUSH_THRESHOLD = 10; // messages
const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes

function getExtractUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/memory/extract`;
}

export async function addChatTurn(
  userId: string,
  userMessage: string,
  assistantMessage: string,
  conversationId?: string
): Promise<void> {
  try {
    let buf = buffers.get(userId);
    if (!buf) {
      buf = { messages: [], lastUpdate: Date.now() };
      buffers.set(userId, buf);
    }

    buf.messages.push({ role: 'user', content: userMessage });
    buf.messages.push({ role: 'assistant', content: assistantMessage });
    if (conversationId) buf.conversationId = conversationId;
    buf.lastUpdate = Date.now();

    // Flush if threshold reached
    if (buf.messages.length >= FLUSH_THRESHOLD) {
      await flushBuffer(userId);
    }
  } catch {
    // Never throw — memory ops must not affect chat
  }
}

export async function flushBuffer(userId: string): Promise<void> {
  const buf = buffers.get(userId);
  if (!buf || buf.messages.length === 0) return;

  const messages = [...buf.messages];
  const conversationId = buf.conversationId;
  buffers.delete(userId);

  // Fire-and-forget to extract endpoint
  try {
    await fetch(getExtractUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, messages, conversationId }),
    });
  } catch {
    // Silently ignore — fire-and-forget
  }
}

// Periodic flush for debounce (check every minute, flush stale buffers older than 2 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, buf] of buffers) {
      if (now - buf.lastUpdate > DEBOUNCE_MS && buf.messages.length > 0) {
        flushBuffer(userId).catch(() => {});
      }
    }
  }, 60_000);
}
