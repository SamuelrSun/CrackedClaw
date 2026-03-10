import type { IntegrationData, RawEmailData, RawCalendarEvent, RawLabelData } from './types';
import { createClient } from '@supabase/supabase-js';

// Get valid Google OAuth token (with refresh)
async function getGoogleToken(userId: string): Promise<string | null> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('status', 'connected')
    .single();
  if (!data?.access_token) return null;

  // Check if needs refresh
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

async function gmailFetch(token: string, path: string): Promise<any> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Gmail API ' + res.status + ': ' + (await res.text()).substring(0, 200));
  return res.json();
}

async function calFetch(token: string, path: string): Promise<any> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/' + path, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Calendar API ' + res.status);
  return res.json();
}

function extractPlainBody(payload: any): string {
  let body = '';
  function walk(part: any) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return body;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// Fetch paginated email list (up to maxMessages)
async function fetchEmailIds(token: string, query: string, maxMessages: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = '';
  while (ids.length < maxMessages) {
    const remaining = maxMessages - ids.length;
    const batchSize = Math.min(remaining, 100);
    let url = 'messages?maxResults=' + batchSize + '&q=' + encodeURIComponent(query);
    if (pageToken) url += '&pageToken=' + pageToken;
    const data = await gmailFetch(token, url);
    for (const msg of (data.messages || [])) ids.push(msg.id);
    if (!data.nextPageToken || ids.length >= maxMessages) break;
    pageToken = data.nextPageToken;
  }
  return ids;
}

// Fetch full email details in parallel batches
async function fetchEmailDetails(token: string, ids: string[], format: 'full' | 'metadata' = 'full'): Promise<RawEmailData[]> {
  const BATCH = 10;
  const results: RawEmailData[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const details = await Promise.all(batch.map(async (id) => {
      try {
        const metaHeaders = format === 'metadata' ? '&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To' : '';
        const data = await gmailFetch(token, 'messages/' + id + '?format=' + format + metaHeaders);
        const headers = data.payload?.headers || [];
        const body = format === 'full' ? extractPlainBody(data.payload) : '';
        const direction = (data.labelIds || []).includes('SENT') ? 'sent' as const : 'received' as const;
        return {
          id: data.id,
          to: getHeader(headers, 'To'),
          from: getHeader(headers, 'From'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          body: body.substring(0, 3000),
          snippet: data.snippet || '',
          labels: data.labelIds || [],
          threadId: data.threadId || '',
          isReply: !!getHeader(headers, 'In-Reply-To'),
          direction,
        } as RawEmailData;
      } catch { return null; }
    }));
    results.push(...details.filter((d): d is RawEmailData => d !== null));
  }
  return results;
}

export async function fetchGoogleData(userId: string, onProgress?: (msg: string) => void): Promise<IntegrationData> {
  const token = await getGoogleToken(userId);
  if (!token) throw new Error('No Google integration connected');

  onProgress?.('Fetching Gmail profile...');
  const profile = await gmailFetch(token, 'profile');

  // Fetch labels
  onProgress?.('Fetching labels...');
  const labelData = await gmailFetch(token, 'labels');
  const labels: RawLabelData[] = (labelData.labels || []).map((l: any) => ({
    id: l.id, name: l.name, type: l.type,
    messagesTotal: l.messagesTotal, messagesUnread: l.messagesUnread,
  }));

  // Fetch SENT emails (full body — the user's writing DNA)
  onProgress?.('Fetching sent emails (up to 200)...');
  const sentIds = await fetchEmailIds(token, 'in:sent', 200);
  onProgress?.('Reading ' + sentIds.length + ' sent emails...');
  const sentEmails = await fetchEmailDetails(token, sentIds, 'full');

  // Fetch RECEIVED emails (metadata only — for relationship mapping)
  onProgress?.('Fetching received emails (up to 300)...');
  const receivedIds = await fetchEmailIds(token, 'in:inbox -in:sent', 300);
  onProgress?.('Reading ' + receivedIds.length + ' received email headers...');
  const receivedEmails = await fetchEmailDetails(token, receivedIds, 'metadata');

  // Fetch calendar — PAST 90 days + FUTURE 30 days
  onProgress?.('Fetching calendar events (past 90 days + future 30)...');
  const past90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const future30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const [pastCal, futureCal] = await Promise.all([
    calFetch(token, 'calendars/primary/events?timeMin=' + encodeURIComponent(past90) + '&timeMax=' + encodeURIComponent(now) + '&maxResults=250&singleEvents=true&orderBy=startTime'),
    calFetch(token, 'calendars/primary/events?timeMin=' + encodeURIComponent(now) + '&timeMax=' + encodeURIComponent(future30) + '&maxResults=100&singleEvents=true&orderBy=startTime'),
  ]);

  function mapEvent(e: any): RawCalendarEvent {
    return {
      id: e.id, title: e.summary || 'Untitled',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      attendees: (e.attendees || []).map((a: any) => ({ email: a.email, name: a.displayName, responseStatus: a.responseStatus })),
      recurring: !!e.recurringEventId,
      description: (e.description || '').substring(0, 500),
      location: e.location || '',
      status: e.status || 'confirmed',
    };
  }

  onProgress?.('Data fetch complete. Processing...');

  return {
    provider: 'google',
    accountEmail: profile.emailAddress,
    emails: {
      sent: sentEmails,
      received: receivedEmails,
      totalSent: sentEmails.length,
      totalReceived: receivedEmails.length,
    },
    calendar: {
      pastEvents: (pastCal.items || []).map(mapEvent),
      futureEvents: (futureCal.items || []).map(mapEvent),
    },
    labels,
    fetchedAt: new Date().toISOString(),
  };
}
