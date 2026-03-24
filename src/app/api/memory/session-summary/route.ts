/**
 * POST /api/memory/session-summary
 * Extract and store a session summary from conversation messages.
 * Called fire-and-forget after chat stream completes.
 *
 * Requires at least 4 messages (2 user + 2 assistant turns) before extracting.
 * Deduplicates by conversationId — UPDATE existing instead of inserting duplicates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mem0Write } from '@/lib/memory/mem0-client';
import { createClient } from '@supabase/supabase-js';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate a concise session summary using Claude Haiku.
 * Returns empty string if nothing meaningful happened.
 */
async function generateSummaryWithHaiku(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const convoText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-20250514',
    max_tokens: 256,
    timeout: 10_000,
    system: `Summarize this conversation in 2-3 sentences. Focus on: what was discussed, what was decided, and any action items or next steps. If nothing meaningful happened (just greetings or small talk), return an empty string.

Format: Just the summary text, no JSON wrapping.`,
    messages: [{ role: 'user', content: convoText }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  return text;
}

export async function POST(request: NextRequest) {
  // ── Auth: accept service role key (server-to-server) or session cookie ──
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  let resolvedUserId: string | null = null;

  if (serviceRoleKey && token === serviceRoleKey) {
    // Server-to-server call — userId must be in body
    resolvedUserId = null; // will be set from body below
  } else {
    // Try session cookie auth (browser client)
    try {
      const supabaseServer = await createSupabaseServerClient();
      const { data: { user } } = await supabaseServer.auth.getUser();
      if (user) resolvedUserId = user.id;
    } catch { /* ignore */ }

    // If no session cookie and not service key, reject in production
    if (!resolvedUserId) {
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  let body: {
    userId?: string;
    conversationId?: string;
    messages?: Array<{ role: string; content: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Resolve userId from body for server-to-server calls
  if (!resolvedUserId) resolvedUserId = body.userId || null;

  const userId = resolvedUserId;
  const { conversationId, messages } = body;

  if (!userId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'userId and messages are required' }, { status: 400 });
  }

  // ── Rate limit: require at least 4 messages (2 user + 2 assistant turns) ──
  const userTurns = messages.filter(m => m.role === 'user').length;
  const assistantTurns = messages.filter(m => m.role === 'assistant').length;
  if (userTurns < 2 || assistantTurns < 2) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_enough_turns' });
  }

  // ── Check auto_memory_extract setting ──
  try {
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('instance_settings')
      .eq('id', userId)
      .single();
    const instanceSettings = (profileData?.instance_settings as Record<string, unknown>) || {};
    const autoExtract = (instanceSettings.auto_memory_extract as boolean) ?? true;
    if (!autoExtract) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'auto_memory_extract_disabled' });
    }
  } catch {
    // If we can't read settings, default to allowing extraction
  }

  try {
    // ── Generate summary ──
    const summary = await generateSummaryWithHaiku(messages);

    if (!summary) {
      return NextResponse.json({ ok: true, summary: '', skipped: true, reason: 'nothing_meaningful' });
    }

    const now = new Date().toISOString();
    const metadata: Record<string, unknown> = {
      source: 'session_summary',
      extractedAt: now,
      ...(conversationId ? { conversationId } : {}),
    };

    // ── Dedup: check if session summary for this conversationId already exists ──
    if (conversationId) {
      const { data: existing } = await supabaseAdmin
        .from('memories')
        .select('id, importance')
        .eq('user_id', userId)
        .filter('metadata->>conversationId', 'eq', conversationId)
        .filter('metadata->>source', 'eq', 'session_summary')
        .limit(1)
        .maybeSingle();

      if (existing) {
        // UPDATE existing session summary instead of inserting a duplicate
        await supabaseAdmin
          .from('memories')
          .update({
            content: summary,
            importance: Math.max(0.65, existing.importance ?? 0),
            metadata,
            updated_at: now,
            accessed_at: now,
          })
          .eq('id', existing.id);

        return NextResponse.json({ ok: true, summary, updated: true });
      }
    }

    // ── Insert new session summary via mem0Write ──
    const id = await mem0Write(userId, summary, {
      domain: 'session',
      importance: 0.65,
      source: 'session_summary',
      metadata,
    });

    return NextResponse.json({ ok: true, summary, id });
  } catch (err) {
    console.error('[memory/session-summary] Error:', err);
    // Never let summary failures surface as errors — always return ok
    return NextResponse.json({ ok: true, summary: '', error: 'extraction_failed' });
  }
}
