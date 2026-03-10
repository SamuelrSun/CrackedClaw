/**
 * Google native ingestion adapter
 * Covers Gmail, Calendar, and Drive.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { saveMemory } from '@/lib/memory/service';
import { getValidToken } from '@/lib/integrations/oauth-tokens';
import {
  analyzeWritingStyle,
  analyzeSchedule,
  findAutomationOpportunities,
  extractContacts,
  extractTopics,
  Email,
  CalendarEvent,
} from '../analyzers';
import { IngestResult } from '../engine';

// Token management handled by shared oauth-tokens module

async function fetchEmails(accessToken: string, query: string, maxResults: number): Promise<Email[]> {
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
        body: body.slice(0, 5000),
        labelIds: data.labelIds || [],
      } as Email;
    })
  );
  return results.filter((e): e is Email => e !== null);
}

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

async function fetchDriveFiles(accessToken: string): Promise<{ name: string; mimeType: string; modifiedTime: string }[]> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(name,mimeType,modifiedTime)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

export async function scanGoogle(userId: string, scope: 'quick' | 'full'): Promise<IngestResult> {
  const startMs = Date.now();

  // Get a valid (auto-refreshed) token
  const token = await getValidToken(userId, 'google');
  const inboxCount = scope === 'quick' ? 10 : 50;
  const sentCount = scope === 'quick' ? 6 : 30;
  const starredCount = scope === 'quick' ? 4 : 20;
  const sentBodyCount = scope === 'quick' ? 6 : 30;

  const [inboxEmails, sentEmails, starredEmails, sentWithBody, events, driveFiles] = await Promise.all([
    fetchEmails(token, 'in:inbox', inboxCount),
    fetchEmails(token, 'in:sent', sentCount),
    fetchEmails(token, 'is:starred', starredCount),
    fetchSentEmailsWithBody(token, sentBodyCount),
    fetchCalendarEvents(token),
    fetchDriveFiles(token),
  ]);

  const sentMerged = sentEmails.map(e => {
    const withBody = sentWithBody.find(s => s.subject === e.subject && s.from === e.from);
    return withBody || e;
  });

  const allEmails: Email[] = [...inboxEmails, ...sentMerged, ...starredEmails];

  const writingStyle = analyzeWritingStyle(sentMerged);
  const schedulePatterns = analyzeSchedule(events);
  const topics = extractTopics(allEmails);
  const contacts = extractContacts(allEmails);
  const automationOpportunities = findAutomationOpportunities(allEmails, events);

  const rawContext = [
    `Gmail: ${allEmails.length} emails (inbox: ${inboxEmails.length}, sent: ${sentMerged.length}, starred: ${starredEmails.length})`,
    `Calendar: ${events.length} events in ±30 days`,
    `Drive: ${driveFiles.length} recent files`,
    topics.length > 0 ? `Top topics: ${topics.slice(0, 8).join(', ')}` : '',
    `Writing tone: ${writingStyle.tone}, avg ${writingStyle.avgLength} words/email`,
    schedulePatterns.busiestDays.length > 0
      ? `Busiest days: ${schedulePatterns.busiestDays.join(', ')}, ~${schedulePatterns.avgMeetingsPerWeek} meetings/week`
      : '',
  ].filter(Boolean).join('\n');

  const result: IngestResult = {
    provider: 'google',
    scannedAt: new Date().toISOString(),
    scope,
    insights: {
      contacts: contacts.map(c => ({ name: c.name, frequency: c.frequency })),
      topics,
      writingStyle: {
        tone: writingStyle.tone,
        patterns: [...writingStyle.openingPatterns, ...writingStyle.closingPatterns],
      },
      schedulePatterns: {
        busiestDays: schedulePatterns.busiestDays,
        avgMeetingsPerWeek: schedulePatterns.avgMeetingsPerWeek,
        commonAttendees: schedulePatterns.commonAttendees,
        recurringMeetings: schedulePatterns.recurringMeetings,
      },
      automationOpportunities,
      rawContext,
    },
    metadata: {
      itemsScanned: allEmails.length + events.length + driveFiles.length,
      timeMs: Date.now() - startMs,
    },
  };

  // Persist to memory
  const entries: Array<{ key: string; value: string; category: 'contact' | 'context' | 'schedule' | 'preference'; importance: number }> = [];

  if (topics.length > 0) {
    entries.push({ key: 'work_topics', value: topics.join(', '), category: 'context', importance: 4 });
  }
  if (writingStyle.tone) {
    entries.push({
      key: 'email_writing_style',
      value: JSON.stringify({ tone: writingStyle.tone, avgLength: writingStyle.avgLength, openingPatterns: writingStyle.openingPatterns, closingPatterns: writingStyle.closingPatterns }),
      category: 'preference',
      importance: 4,
    });
  }
  if (schedulePatterns.busiestDays.length > 0) {
    entries.push({
      key: 'schedule_patterns',
      value: JSON.stringify({ busiestDays: schedulePatterns.busiestDays, avgMeetingsPerWeek: schedulePatterns.avgMeetingsPerWeek, recurringMeetings: schedulePatterns.recurringMeetings }),
      category: 'schedule',
      importance: 3,
    });
  }
  if (automationOpportunities.length > 0) {
    entries.push({ key: 'automation_opportunities', value: automationOpportunities.join(' | '), category: 'context', importance: 4 });
  }
  for (const contact of contacts.slice(0, 10)) {
    const key = `contact_${contact.email.split('@')[0].replace(/[^a-z0-9]/gi, '_')}`;
    entries.push({ key, value: `${contact.name} <${contact.email}> (freq: ${contact.frequency})`, category: 'contact', importance: 3 });
  }

  await Promise.all(
    entries.map(e => saveMemory(userId, e.key, e.value, { category: e.category, source: 'scan', importance: e.importance }))
  );

  return result;
}
