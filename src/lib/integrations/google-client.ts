import { createAdminClient } from '@/lib/supabase/admin';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
}

async function getGoogleTokens(userId: string): Promise<GoogleTokens | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('status', 'connected')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data || null;
}

export async function fetchRecentEmails(userId: string): Promise<Array<{
  subject: string;
  from: string;
  date: string;
  snippet: string;
}>> {
  const tokens = await getGoogleTokens(userId);
  if (!tokens?.access_token) return [];
  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=in:inbox',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!listRes.ok) return [];
    const listData = await listRes.json();
    const messages: Array<{id: string}> = listData.messages || [];
    const details = await Promise.all(
      messages.slice(0, 20).map(async (msg) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const headers: Array<{name: string; value: string}> = data.payload?.headers || [];
        const get = (name: string) => headers.find(h => h.name === name)?.value || '';
        return { subject: get('Subject'), from: get('From'), date: get('Date'), snippet: data.snippet || '' };
      })
    );
    return details.filter((d): d is NonNullable<typeof d> => d !== null);
  } catch { return []; }
}

export async function fetchCalendarEvents(userId: string): Promise<Array<{
  title: string;
  start: string;
  attendees: string[];
  recurring: boolean;
}>> {
  const tokens = await getGoogleTokens(userId);
  if (!tokens?.access_token) return [];
  try {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(future)}&maxResults=50&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((event: {
      summary?: string;
      start?: { dateTime?: string; date?: string };
      attendees?: Array<{ email: string }>;
      recurrence?: string[];
    }) => ({
      title: event.summary || 'Untitled',
      start: event.start?.dateTime || event.start?.date || '',
      attendees: (event.attendees || []).map(a => a.email),
      recurring: !!(event.recurrence?.length),
    }));
  } catch { return []; }
}
