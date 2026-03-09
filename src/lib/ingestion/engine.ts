/**
 * Intelligent Data Ingestion Engine
 * Orchestrates fetching from Google APIs and analyzing user data locally.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { saveMemory } from '@/lib/memory/service';
import {
  analyzeWritingStyle,
  analyzeSchedule,
  findAutomationOpportunities,
  extractContacts,
  extractTopics,
  Email,
  CalendarEvent,
} from './analyzers';

export interface ScanInsights {
  topics: string[];
  contacts: { name: string; email: string; frequency: number }[];
  writingStyle: {
    tone: string;
    avgLength: number;
    openingPatterns: string[];
    closingPatterns: string[];
  };
  schedulePatterns: {
    busiestDays: string[];
    avgMeetingsPerWeek: number;
    commonAttendees: { email: string; frequency: number }[];
    recurringMeetings: string[];
  };
  automationOpportunities: string[];
  meta: {
    emailsScanned: number;
    eventsScanned: number;
    driveFilesFound: number;
    scannedAt: string;
  };
}

// ── Token helper ──────────────────────────────────────────────────────────────

async function getGoogleTokens(userId: string): Promise<{ access_token: string; refresh_token?: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('status', 'connected')
    .single();
  return data || null;
}

// ── Gmail fetcher ─────────────────────────────────────────────────────────────

async function fetchEmails(
  accessToken: string,
  query: string,
  maxResults: number,
): Promise<Email[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) return [];
  const listData = await listRes.json();
  const messages: { id: string }[] = listData.messages || [];

  const results = await Promise.all(
    messages.map(async (msg) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const headers: { name: string; value: string }[] = data.payload?.headers || [];
      const get = (name: string) => headers.find(h => h.name === name)?.value || '';
      return {
        subject: get('Subject'),
        from: get('From'),
        to: get('To'),
        date: get('Date'),
        snippet: data.snippet || '',
        labelIds: data.labelIds || [],
      } as Email;
    })
  );
  return results.filter((e): e is Email => e !== null);
}

async function fetchSentEmailsWithBody(accessToken: string, limit = 20): Promise<Email[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=in:sent`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) return [];
  const listData = await listRes.json();
  const messages: { id: string }[] = listData.messages || [];

  const results = await Promise.all(
    messages.map(async (msg) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const headers: { name: string; value: string }[] = data.payload?.headers || [];
      const get = (name: string) => headers.find(h => h.name === name)?.value || '';

      // Extract plain text body
      let body = '';
      const extractBody = (part: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          for (const p of part.parts as typeof part[]) {
            const text = extractBody(p);
            if (text) return text;
          }
        }
        return '';
      };
      body = extractBody(data.payload || {});

      return {
        subject: get('Subject'),
        from: get('From'),
        to: get('To'),
        date: get('Date'),
        snippet: data.snippet || '',
        body: body.slice(0, 5000), // cap at 5k chars per email
        labelIds: data.labelIds || [],
      } as Email;
    })
  );
  return results.filter((e): e is Email => e !== null);
}

// ── Calendar fetcher ──────────────────────────────────────────────────────────

async function fetchCalendarEvents(accessToken: string): Promise<CalendarEvent[]> {
  const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(past)}&timeMax=${encodeURIComponent(future)}&maxResults=250&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((ev: {
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: { email: string }[];
    recurrence?: string[];
    description?: string;
  }) => ({
    title: ev.summary || 'Untitled',
    start: ev.start?.dateTime || ev.start?.date || '',
    end: ev.end?.dateTime || ev.end?.date || '',
    attendees: (ev.attendees || []).map(a => a.email),
    recurring: !!(ev.recurrence?.length),
    description: ev.description || '',
  }));
}

// ── Drive fetcher (metadata only) ─────────────────────────────────────────────

async function fetchDriveFiles(accessToken: string): Promise<{ name: string; mimeType: string; modifiedTime: string }[]> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(name,mimeType,modifiedTime)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runScopedScan(
  userId: string,
  provider: string,
  scope: 'full' | 'quick' = 'full',
): Promise<ScanInsights> {
  if (provider !== 'google') {
    throw new Error(`Provider "${provider}" not supported yet`);
  }

  const tokens = await getGoogleTokens(userId);
  if (!tokens?.access_token) {
    throw new Error('Google integration not connected or missing access token');
  }

  const token = tokens.access_token;
  const emailCount = scope === 'quick' ? 20 : 100;
  const inboxCount = scope === 'quick' ? 10 : 50;
  const sentCount = scope === 'quick' ? 6 : 30;
  const starredCount = scope === 'quick' ? 4 : 20;

  // Fetch in parallel
  const [inboxEmails, sentEmails, starredEmails, sentWithBody, events, driveFiles] = await Promise.all([
    fetchEmails(token, 'in:inbox', inboxCount),
    fetchEmails(token, 'in:sent', sentCount),
    fetchEmails(token, 'is:starred', starredCount),
    fetchSentEmailsWithBody(token, Math.min(20, Math.round(emailCount * 0.2))),
    fetchCalendarEvents(token),
    fetchDriveFiles(token),
  ]);

  // Merge sent emails with body data
  const sentMerged = sentEmails.map(e => {
    const withBody = sentWithBody.find(s => s.subject === e.subject && s.from === e.from);
    return withBody || e;
  });

  const allEmails: Email[] = [...inboxEmails, ...sentMerged, ...starredEmails];

  // Run local analysis
  const [writingStyle, schedulePatterns] = await Promise.all([
    Promise.resolve(analyzeWritingStyle(sentMerged)),
    Promise.resolve(analyzeSchedule(events)),
  ]);

  const topics = extractTopics(allEmails);
  const contacts = extractContacts(allEmails);
  const automationOpportunities = findAutomationOpportunities(allEmails, events);

  const insights: ScanInsights = {
    topics,
    contacts,
    writingStyle: {
      tone: writingStyle.tone,
      avgLength: writingStyle.avgLength,
      openingPatterns: writingStyle.openingPatterns,
      closingPatterns: writingStyle.closingPatterns,
    },
    schedulePatterns: {
      busiestDays: schedulePatterns.busiestDays,
      avgMeetingsPerWeek: schedulePatterns.avgMeetingsPerWeek,
      commonAttendees: schedulePatterns.commonAttendees,
      recurringMeetings: schedulePatterns.recurringMeetings,
    },
    automationOpportunities,
    meta: {
      emailsScanned: allEmails.length,
      eventsScanned: events.length,
      driveFilesFound: driveFiles.length,
      scannedAt: new Date().toISOString(),
    },
  };

  // Persist insights to memory
  await persistInsights(userId, insights);

  return insights;
}

async function persistInsights(userId: string, insights: ScanInsights): Promise<void> {
  const entries: Array<{ key: string; value: string; category: 'contact' | 'context' | 'schedule' | 'preference'; importance: number }> = [];

  if (insights.topics.length > 0) {
    entries.push({ key: 'work_topics', value: insights.topics.join(', '), category: 'context', importance: 4 });
  }

  if (insights.writingStyle.tone) {
    entries.push({ key: 'email_writing_style', value: JSON.stringify(insights.writingStyle), category: 'preference', importance: 4 });
  }

  if (insights.schedulePatterns.busiestDays.length > 0) {
    entries.push({ key: 'schedule_patterns', value: JSON.stringify({
      busiestDays: insights.schedulePatterns.busiestDays,
      avgMeetingsPerWeek: insights.schedulePatterns.avgMeetingsPerWeek,
      recurringMeetings: insights.schedulePatterns.recurringMeetings,
    }), category: 'schedule', importance: 3 });
  }

  if (insights.automationOpportunities.length > 0) {
    entries.push({ key: 'automation_opportunities', value: insights.automationOpportunities.join(' | '), category: 'context', importance: 4 });
  }

  for (const contact of insights.contacts.slice(0, 10)) {
    const key = `contact_${contact.email.split('@')[0].replace(/[^a-z0-9]/gi, '_')}`;
    entries.push({ key, value: `${contact.name} <${contact.email}> (freq: ${contact.frequency})`, category: 'contact', importance: 3 });
  }

  await Promise.all(
    entries.map(e => saveMemory(userId, e.key, e.value, { category: e.category, source: 'scan', importance: e.importance }))
  );
}
