/**
 * Gmail tools — high-level operations the agent can use directly
 * No curl needed — these handle the API calls internally
 */

import type { ToolDefinition, AgentContext } from '../runtime';

async function getGoogleToken(userId: string): Promise<string | null> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('status', 'connected')
    .single();
  if (!data?.access_token) return null;

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000 && data.refresh_token) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: data.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (res.ok) {
      const refreshed = await res.json();
      await supabase.from('user_integrations').update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
      }).eq('user_id', userId).eq('provider', 'google');
      return refreshed.access_token;
    }
  }
  return data.access_token;
}

async function gmailApi(token: string, path: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/' + path;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = res.ok ? await res.json().catch(() => ({})) : { error: await res.text().catch(() => res.statusText) };
  return { ok: res.ok, status: res.status, data };
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export const gmailSearchTool: ToolDefinition = {
  name: 'gmail_search',
  description: 'Search Gmail messages. Returns list of messages matching the query. Uses Gmail search syntax (same as Gmail search bar).',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Gmail search query. Examples: "from:hugo@example.com", "subject:meeting", "is:unread", "in:drafts to:hugo", "newer_than:7d"' },
      maxResults: { type: 'number', description: 'Max results to return (default 10, max 50)' },
    },
    required: ['query'],
  },
  async execute(input: unknown, context: AgentContext) {
    const { query, maxResults = 10 } = input as { query: string; maxResults?: number };
    const token = await getGoogleToken(context.userId);
    if (!token) return { error: 'Google not connected' };

    const limit = Math.min(maxResults, 50);
    const { ok, data } = await gmailApi(token, 'messages?q=' + encodeURIComponent(query) + '&maxResults=' + limit);
    if (!ok) return { error: 'Search failed', details: data };

    const messages = (data as { messages?: Array<{ id: string }> }).messages || [];
    if (messages.length === 0) return { results: [], message: 'No messages found for: ' + query };

    // Fetch details for each message
    const details = await Promise.all(messages.slice(0, limit).map(async (m) => {
      const { data: msgData } = await gmailApi(token, 'messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date');
      const msg = msgData as { id: string; snippet: string; labelIds: string[]; payload?: { headers: Array<{ name: string; value: string }> } };
      const headers = msg.payload?.headers || [];
      return {
        id: msg.id,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        date: getHeader(headers, 'Date'),
        snippet: msg.snippet,
        labels: msg.labelIds,
      };
    }));

    return { results: details, total: messages.length };
  },
};

export const gmailDraftsTool: ToolDefinition = {
  name: 'gmail_drafts',
  description: 'List, create, or delete Gmail drafts. Actions: list (with optional search), create (compose new draft), delete (remove draft by ID).',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'create', 'delete'], description: 'Action to perform' },
      query: { type: 'string', description: 'For list: optional search filter (e.g. "to:hugo")' },
      draftId: { type: 'string', description: 'For delete: the draft ID to delete' },
      to: { type: 'string', description: 'For create: recipient email' },
      subject: { type: 'string', description: 'For create: email subject' },
      body: { type: 'string', description: 'For create: email body (plain text)' },
      cc: { type: 'string', description: 'For create: CC recipients' },
    },
    required: ['action'],
  },
  async execute(input: unknown, context: AgentContext) {
    const { action, query, draftId, to, subject, body, cc } = input as {
      action: 'list' | 'create' | 'delete';
      query?: string;
      draftId?: string;
      to?: string;
      subject?: string;
      body?: string;
      cc?: string;
    };
    const token = await getGoogleToken(context.userId);
    if (!token) return { error: 'Google not connected' };

    if (action === 'list') {
      const { ok, data } = await gmailApi(token, 'drafts?maxResults=20');
      if (!ok) return { error: 'Failed to list drafts', details: data };

      const drafts = (data as { drafts?: Array<{ id: string; message: { id: string } }> }).drafts || [];
      if (drafts.length === 0) return { drafts: [], message: 'No drafts found' };

      // Fetch details
      const details = await Promise.all(drafts.map(async (d) => {
        const { data: msgData } = await gmailApi(token, 'messages/' + d.message.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date');
        const msg = msgData as { snippet: string; payload?: { headers: Array<{ name: string; value: string }> } };
        const headers = msg.payload?.headers || [];
        return {
          draftId: d.id,
          messageId: d.message.id,
          to: getHeader(headers, 'To'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          snippet: msg.snippet,
        };
      }));

      // Filter by query if provided
      if (query) {
        const q = query.toLowerCase();
        const filtered = details.filter(d =>
          d.to.toLowerCase().includes(q) ||
          d.subject.toLowerCase().includes(q) ||
          d.snippet.toLowerCase().includes(q)
        );
        return { drafts: filtered, total: filtered.length, query };
      }

      return { drafts: details, total: details.length };
    }

    if (action === 'delete') {
      if (!draftId) return { error: 'draftId is required for delete' };
      const { ok, status, data } = await gmailApi(token, 'drafts/' + draftId, 'DELETE');
      if (!ok && status !== 204) return { error: 'Failed to delete draft', details: data };
      return { success: true, deleted: draftId };
    }

    if (action === 'create') {
      if (!to || !subject) return { error: 'to and subject are required for create' };
      const rawMessage = [
        'To: ' + to,
        cc ? 'Cc: ' + cc : '',
        'Subject: ' + subject,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body || '',
      ].filter(Boolean).join('\r\n');

      const encoded = Buffer.from(rawMessage).toString('base64url');
      const { ok, data } = await gmailApi(token, 'drafts', 'POST', {
        message: { raw: encoded },
      });
      if (!ok) return { error: 'Failed to create draft', details: data };
      return { success: true, draft: data };
    }

    return { error: 'Unknown action: ' + action };
  },
};

export const gmailSendTool: ToolDefinition = {
  name: 'gmail_send',
  description: 'Send an email via Gmail. Composes and sends immediately.',
  input_schema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body (plain text)' },
      cc: { type: 'string', description: 'CC recipients (comma-separated)' },
      bcc: { type: 'string', description: 'BCC recipients (comma-separated)' },
      replyTo: { type: 'string', description: 'Message ID to reply to (for threading)' },
    },
    required: ['to', 'subject', 'body'],
  },
  async execute(input: unknown, context: AgentContext) {
    const { to, subject, body, cc, bcc, replyTo } = input as {
      to: string; subject: string; body: string; cc?: string; bcc?: string; replyTo?: string;
    };
    const token = await getGoogleToken(context.userId);
    if (!token) return { error: 'Google not connected' };

    const headers = [
      'To: ' + to,
      cc ? 'Cc: ' + cc : '',
      bcc ? 'Bcc: ' + bcc : '',
      'Subject: ' + subject,
      replyTo ? 'In-Reply-To: ' + replyTo : '',
      replyTo ? 'References: ' + replyTo : '',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].filter(Boolean).join('\r\n');

    const encoded = Buffer.from(headers).toString('base64url');
    const { ok, data } = await gmailApi(token, 'messages/send', 'POST', { raw: encoded });
    if (!ok) return { error: 'Failed to send email', details: data };
    return { success: true, messageId: (data as { id: string }).id, message: 'Email sent to ' + to };
  },
};

export const gmailLabelsTool: ToolDefinition = {
  name: 'gmail_labels',
  description: 'List Gmail labels, or modify labels on messages (archive, star, mark read/unread, move to trash, apply/remove labels).',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'modify'], description: 'list = show all labels, modify = change labels on messages' },
      messageIds: { type: 'array', items: { type: 'string' }, description: 'For modify: message IDs to update' },
      addLabels: { type: 'array', items: { type: 'string' }, description: 'Label IDs to add. Common: STARRED, IMPORTANT, TRASH, INBOX, UNREAD' },
      removeLabels: { type: 'array', items: { type: 'string' }, description: 'Label IDs to remove. Remove INBOX = archive, remove UNREAD = mark read' },
    },
    required: ['action'],
  },
  async execute(input: unknown, context: AgentContext) {
    const { action, messageIds, addLabels, removeLabels } = input as {
      action: 'list' | 'modify';
      messageIds?: string[];
      addLabels?: string[];
      removeLabels?: string[];
    };
    const token = await getGoogleToken(context.userId);
    if (!token) return { error: 'Google not connected' };

    if (action === 'list') {
      const { ok, data } = await gmailApi(token, 'labels');
      if (!ok) return { error: 'Failed to list labels', details: data };
      const labels = ((data as { labels: Array<{ id: string; name: string; type: string }> }).labels || [])
        .map(l => ({ id: l.id, name: l.name, type: l.type }));
      return { labels };
    }

    if (action === 'modify') {
      if (!messageIds?.length) return { error: 'messageIds required for modify' };
      const { ok, data } = await gmailApi(token, 'messages/batchModify', 'POST', {
        ids: messageIds,
        addLabelIds: addLabels || [],
        removeLabelIds: removeLabels || [],
      });
      if (!ok) return { error: 'Failed to modify messages', details: data };
      return { success: true, modified: messageIds.length };
    }

    return { error: 'Unknown action' };
  },
};
