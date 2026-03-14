import { mem0Write } from './mem0-client';
import { fetchRecentEmails, fetchCalendarEvents } from '@/lib/integrations/google-client';

export interface ScanResult {
  memoriesCreated: number;
  summary: string;
  categories: Record<string, number>;
  emailsScanned: number;
  eventsScanned: number;
}

export function extractContacts(emails: Array<{from: string; subject: string}>) {
  const map = new Map<string, {name: string; count: number; subjects: string[]}>();
  for (const email of emails) {
    const match = email.from.match(/^(.+?)\s*<([^>]+)>/) || email.from.match(/([^@\s]+@[^\s]+)/);
    if (!match) continue;
    const emailAddr = (match[2] || match[1]).trim();
    const name = (match[1] || emailAddr).replace(/"/g, '').trim();
    if (!map.has(emailAddr)) map.set(emailAddr, { name, count: 0, subjects: [] });
    const entry = map.get(emailAddr)!;
    entry.count++;
    if (email.subject) entry.subjects.push(email.subject);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([addr, v]) => ({ email: addr, name: v.name, context: v.subjects.slice(0, 2).join(', ') }));
}

export function extractTopics(emails: Array<{subject: string; snippet: string}>): string[] {
  const stopwords = new Set(['about', 'would', 'could', 'should', 'there', 'their', 'where', 'which', 'email', 'gmail', 'please', 'thanks', 'hello', 'https', 'from', 'your', 'have', 'this', 'that', 'with', 'what', 'when', 'just']);
  const freq = new Map<string, number>();
  for (const e of emails) {
    const words = (e.subject + ' ' + e.snippet).toLowerCase().split(/[\s,.()\[\]{}:;!?@#$%^&*+=|\\/<>'"]+/);
    for (const w of words) {
      if (w.length > 4 && !stopwords.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return Array.from(freq.entries()).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
}

export async function scanGoogleData(userId: string): Promise<ScanResult> {
  const result: ScanResult = { memoriesCreated: 0, summary: '', categories: {}, emailsScanned: 0, eventsScanned: 0 };
  try {
    const [emails, events] = await Promise.all([fetchRecentEmails(userId), fetchCalendarEvents(userId)]);
    result.emailsScanned = emails.length;
    result.eventsScanned = events.length;

    const toSave: Array<{ key: string; value: string; domain: string; importance: number }> = [];

    const contacts = extractContacts(emails);
    for (const c of contacts.slice(0, 10)) {
      toSave.push({ key: `contact_${c.email.split('@')[0].replace(/[^a-z0-9]/gi, '_')}`, value: `${c.name} <${c.email}>${c.context ? ' — ' + c.context : ''}`, domain: 'email', importance: 0.6 });
    }

    const topics = extractTopics(emails);
    if (topics.length > 0) {
      toSave.push({ key: 'work_topics', value: topics.join(', '), domain: 'general', importance: 0.8 });
    }

    const recurring = events.filter(e => e.recurring);
    if (recurring.length > 0) {
      toSave.push({ key: 'recurring_meetings', value: recurring.slice(0, 5).map(e => e.title).join(', '), domain: 'calendar', importance: 0.6 });
    }

    const attendeeFreq = new Map<string, number>();
    for (const e of events) for (const a of e.attendees) attendeeFreq.set(a, (attendeeFreq.get(a) || 0) + 1);
    const topCollabs = Array.from(attendeeFreq.entries()).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e]) => e);
    if (topCollabs.length > 0) {
      toSave.push({ key: 'frequent_collaborators', value: topCollabs.join(', '), domain: 'email', importance: 0.6 });
    }

    await Promise.all(toSave.map(m => mem0Write(userId, `${m.key}: ${m.value}`, { source: 'scan', domain: m.domain, importance: m.importance })));


    result.memoriesCreated = toSave.length;
    result.categories = toSave.reduce((acc, m) => { acc[m.domain] = (acc[m.domain] || 0) + 1; return acc; }, {} as Record<string, number>);
    result.summary = `Scanned ${emails.length} emails + ${events.length} calendar events. Found ${contacts.length} frequent contacts, ${topics.length} work topics, ${recurring.length} recurring meetings.`;
  } catch (err) {
    console.error('Scan error:', err);
    result.summary = 'Scan encountered an error: ' + String(err);
  }
  return result;
}

/**
 * Lightweight scan for auto-scan-on-connect.
 * Uses structured pattern matching only (no Claude extraction).
 * Max 50 emails + 30 days calendar.
 */
export async function lightScan(
  userId: string,
  provider: string,
  accountEmail?: string,
  accountId?: string
): Promise<{ memoriesCreated: number }> {
  let memoriesCreated = 0;
  try {
    if (provider !== 'google') {
      // Only Google supported for now
      return { memoriesCreated: 0 };
    }

    const [emails, events] = await Promise.all([
      fetchRecentEmails(userId),
      fetchCalendarEvents(userId),
    ]);

    const meta = {
      source: 'auto-scan' as const,
      provider,
      ...(accountId ? { accountId } : {}),
      ...(accountEmail ? { accountEmail } : {}),
    };

    const toSave: Array<{ key: string; value: string; domain: string; importance: number }> = [];

    // Contacts from emails (up to 50 emails already limited by fetchRecentEmails)
    const contacts = extractContacts(emails);
    for (const c of contacts.slice(0, 10)) {
      toSave.push({
        key: `contact_${c.email.split('@')[0].replace(/[^a-z0-9]/gi, '_')}`,
        value: `${c.name} <${c.email}>${c.context ? ' — ' + c.context : ''}`,
        domain: 'email',
        importance: 0.6,
      });
    }

    // Topics
    const topics = extractTopics(emails);
    if (topics.length > 0) {
      toSave.push({ key: 'work_topics', value: topics.join(', '), domain: 'general', importance: 0.8 });
    }

    // Recurring meetings
    const recurring = events.filter(e => e.recurring);
    if (recurring.length > 0) {
      toSave.push({
        key: 'recurring_meetings',
        value: recurring.slice(0, 5).map(e => e.title).join(', '),
        domain: 'calendar',
        importance: 0.6,
      });
    }

    // Frequent collaborators
    const attendeeFreq = new Map<string, number>();
    for (const e of events) for (const a of e.attendees) attendeeFreq.set(a, (attendeeFreq.get(a) || 0) + 1);
    const topCollabs = Array.from(attendeeFreq.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([e]) => e);
    if (topCollabs.length > 0) {
      toSave.push({ key: 'frequent_collaborators', value: topCollabs.join(', '), domain: 'email', importance: 0.6 });
    }

    await Promise.all(
      toSave.map(m =>
        mem0Write(userId, `${m.key}: ${m.value}`, {
          source: 'auto-scan',
          domain: m.domain,
          importance: m.importance,
          metadata: meta,
        })
      )
    );

    memoriesCreated = toSave.length;
  } catch (err) {
    console.error('[lightScan] Error:', err);
  }
  return { memoriesCreated };
}
