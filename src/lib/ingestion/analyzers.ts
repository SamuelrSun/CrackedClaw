/**
 * Local analysis functions — no external API calls.
 * Uses string analysis, regex, and frequency counting.
 */

export interface Email {
  subject: string;
  from: string;
  to?: string;
  date: string;
  snippet: string;
  body?: string; // only available for sent emails (20 most recent)
  labelIds?: string[];
}

export interface CalendarEvent {
  title: string;
  start: string;
  end?: string;
  attendees: string[];
  recurring: boolean;
  description?: string;
}

export interface WritingStyle {
  tone: 'formal' | 'casual' | 'mixed';
  avgLength: number;
  openingPatterns: string[];
  closingPatterns: string[];
  sentenceStructure: 'short' | 'medium' | 'long';
  commonPhrases: string[];
}

export interface SchedulePatterns {
  busiestDays: string[];
  avgMeetingsPerWeek: number;
  commonAttendees: { email: string; frequency: number }[];
  preferredHours?: { start: number; end: number };
  recurringMeetings: string[];
}

export interface ContactInfo {
  name: string;
  email: string;
  frequency: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FORMAL_SIGNALS = [
  /\bdear\b/i, /\bsincerely\b/i, /\bregards\b/i, /\bplease find\b/i,
  /\bkindly\b/i, /\bherewith\b/i, /\bforthwith\b/i, /\bpursuant\b/i,
];
const CASUAL_SIGNALS = [
  /\bhey\b/i, /\bhi\b/i, /\bthanks!\b/i, /\bcheers\b/i, /\bawesome\b/i,
  /\bcool\b/i, /\bbtw\b/i, /\blol\b/i, /\byeah\b/i,
];

function detectTone(texts: string[]): 'formal' | 'casual' | 'mixed' {
  let formalScore = 0;
  let casualScore = 0;
  for (const t of texts) {
    for (const r of FORMAL_SIGNALS) if (r.test(t)) formalScore++;
    for (const r of CASUAL_SIGNALS) if (r.test(t)) casualScore++;
  }
  if (formalScore === 0 && casualScore === 0) return 'mixed';
  if (formalScore > casualScore * 2) return 'formal';
  if (casualScore > formalScore * 2) return 'casual';
  return 'mixed';
}

function extractOpenings(bodies: string[]): string[] {
  const patterns = new Map<string, number>();
  for (const b of bodies) {
    const firstLine = b.split(/\n/)[0]?.trim() || '';
    const match = firstLine.match(/^(hi|hey|hello|dear|good\s+\w+)[^,.\n]*/i);
    if (match) {
      const key = match[0].toLowerCase().trim().slice(0, 30);
      patterns.set(key, (patterns.get(key) || 0) + 1);
    }
  }
  return Array.from(patterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);
}

function extractClosings(bodies: string[]): string[] {
  const patterns = new Map<string, number>();
  for (const b of bodies) {
    const lines = b.split(/\n/).filter((l: string) => l.trim().length > 0);
    const lastLine = lines[lines.length - 1]?.trim() || '';
    const match = lastLine.match(/^(thanks|cheers|best|sincerely|regards|warm regards|take care|talk soon)[^,.\n]*/i);
    if (match) {
      const key = match[0].toLowerCase().trim().slice(0, 30);
      patterns.set(key, (patterns.get(key) || 0) + 1);
    }
  }
  return Array.from(patterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);
}

function avgWordCount(bodies: string[]): number {
  if (!bodies.length) return 0;
  const total = bodies.reduce((sum, b) => sum + b.split(/\s+/).filter(Boolean).length, 0);
  return Math.round(total / bodies.length);
}

function extractCommonPhrases(bodies: string[]): string[] {
  const bigramFreq = new Map<string, number>();
  const stopwords = new Set(['the', 'and', 'for', 'you', 'with', 'this', 'that', 'are', 'our', 'your', 'will', 'have', 'from', 'can', 'not', 'but', 'all', 'any']);
  for (const b of bodies) {
    const words = b.toLowerCase().split(/[\s.,!?]+/).filter((w: string) => w.length > 2 && !stopwords.has(w));
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigramFreq.set(bigram, (bigramFreq.get(bigram) || 0) + 1);
    }
  }
  return Array.from(bigramFreq.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);
}

export function analyzeWritingStyle(emails: Email[]): WritingStyle {
  const sentWithBody = emails.filter(e => e.body && e.labelIds?.includes('SENT'));
  const bodies = sentWithBody.map(e => e.body!);
  const allText = bodies.concat(emails.map(e => e.snippet));

  const avgLen = avgWordCount(bodies);
  const sentenceStructure: WritingStyle['sentenceStructure'] =
    avgLen < 50 ? 'short' : avgLen < 150 ? 'medium' : 'long';

  return {
    tone: detectTone(allText),
    avgLength: avgLen,
    openingPatterns: extractOpenings(bodies),
    closingPatterns: extractClosings(bodies),
    sentenceStructure,
    commonPhrases: extractCommonPhrases(bodies),
  };
}

export function analyzeSchedule(events: CalendarEvent[]): SchedulePatterns {
  const dayCount = new Array(7).fill(0);
  const attendeeFreq = new Map<string, number>();
  const hourCount = new Array(24).fill(0);

  for (const ev of events) {
    if (ev.start) {
      const d = new Date(ev.start);
      if (!isNaN(d.getTime())) {
        dayCount[d.getDay()]++;
        hourCount[d.getHours()]++;
      }
    }
    for (const a of ev.attendees) {
      attendeeFreq.set(a, (attendeeFreq.get(a) || 0) + 1);
    }
  }

  const busiestDays = dayCount
    .map((count, idx) => ({ day: DAY_NAMES[idx], count }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(d => d.day);

  const avgMeetingsPerWeek = Math.round((events.length / 60) * 7 * 10) / 10;

  const commonAttendees = Array.from(attendeeFreq.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, frequency]) => ({ email, frequency }));

  const peakHour = hourCount.indexOf(Math.max(...hourCount));
  const preferredHours = peakHour > 0
    ? { start: Math.max(peakHour - 2, 0), end: Math.min(peakHour + 4, 23) }
    : undefined;

  const recurringMeetings = Array.from(new Set(
    events.filter(e => e.recurring).map(e => e.title)
  )).slice(0, 10);

  return { busiestDays, avgMeetingsPerWeek, commonAttendees, preferredHours, recurringMeetings };
}

export function findAutomationOpportunities(emails: Email[], events: CalendarEvent[]): string[] {
  const opportunities: string[] = [];

  // Senders with report-like subjects
  const senderFreq = new Map<string, { name: string; subjects: string[] }>();
  for (const e of emails) {
    const match = e.from.match(/^(.+?)\s*<([^>]+)>/) || e.from.match(/([^@\s]+@[^\s]+)/);
    if (!match) continue;
    const addr = (match[2] || match[1]).trim();
    const name = (match[1] || addr).replace(/"/g, '').trim();
    if (!senderFreq.has(addr)) senderFreq.set(addr, { name, subjects: [] });
    senderFreq.get(addr)!.subjects.push(e.subject);
  }

  Array.from(senderFreq.values()).forEach(info => {
    if (info.subjects.length >= 3) {
      const reportLike = info.subjects.some((s: string) =>
        /report|update|digest|newsletter|weekly|daily|summary|recap/i.test(s)
      );
      if (reportLike) {
        opportunities.push(`You receive regular updates from ${info.name} — I could auto-summarize those for you`);
      }
    }
  });

  // Recurring subject threads
  const subjectFreq = new Map<string, number>();
  for (const e of emails) {
    const normalized = e.subject.replace(/^(re:|fwd?:|fw:)\s*/i, '').trim().toLowerCase();
    subjectFreq.set(normalized, (subjectFreq.get(normalized) || 0) + 1);
  }
  Array.from(subjectFreq.entries()).forEach(([subj, count]) => {
    if (count >= 3 && subj.length > 5) {
      opportunities.push(`Thread "${subj}" appears ${count} times — I could track and summarize this for you`);
    }
  });

  // 1:1 meetings
  const recurringEvents = events.filter(e => e.recurring);
  const eventTitles = new Set(recurringEvents.map(e => e.title.toLowerCase()));

  const eventTitlesArr = Array.from(eventTitles);
  if (eventTitlesArr.some(t => /1[:\-\s]?1|one.on.one|1on1|sync|check.?in/i.test(t))) {
    const example = recurringEvents.find(e => /1[:\-\s]?1|one.on.one|1on1/i.test(e.title))?.title;
    opportunities.push(`You have recurring 1:1s (e.g. "${example || '1:1'}") — I could prep talking points or agendas before each one`);
  }

  // Team meetings
  if (eventTitlesArr.some(t => /team|standup|stand-up|sprint|retro|planning|review/i.test(t))) {
    const matchTitle = recurringEvents.find(e => /team|standup|stand-up|sprint/i.test(e.title))?.title;
    opportunities.push(`You have recurring team meetings (e.g. "${matchTitle || 'standup'}") — I could draft agendas or summarize action items`);
  }

  // Large meetings
  const largeEvents = events.filter(e => e.attendees.length >= 5);
  if (largeEvents.length >= 2) {
    opportunities.push(`You attend larger group meetings (${largeEvents.length} found) — I could pull context on attendees before each one`);
  }

  // Packed calendar
  if (events.length > 30) {
    opportunities.push(`Your calendar is fairly packed — I could find focus blocks and suggest meeting-free times for deep work`);
  }

  return Array.from(new Set(opportunities)).slice(0, 8);
}

export function extractContacts(emails: Email[]): ContactInfo[] {
  const map = new Map<string, { name: string; count: number }>();
  for (const e of emails) {
    const sources = [e.from, e.to].filter(Boolean) as string[];
    for (const src of sources) {
      const parts = src.split(',');
      for (const part of parts) {
        const match = part.trim().match(/^(.+?)\s*<([^>]+)>/) || part.trim().match(/([^@\s]+@[^\s]+)/);
        if (!match) continue;
        const addr = (match[2] || match[1]).trim().toLowerCase();
        const name = (match[1] || addr).replace(/"/g, '').trim();
        if (!map.has(addr)) map.set(addr, { name, count: 0 });
        map.get(addr)!.count++;
      }
    }
  }
  return Array.from(map.entries())
    .map(([email, { name, count }]) => ({ name, email, frequency: count }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);
}

export function extractTopics(emails: Email[]): string[] {
  const stopwords = new Set([
    'about', 'would', 'could', 'should', 'there', 'their', 'where', 'which',
    'email', 'gmail', 'please', 'thanks', 'hello', 'https', 'from', 'your',
    'have', 'this', 'that', 'with', 'what', 'when', 'just', 'also', 'some',
    'been', 'were', 'they', 'them', 'into', 'more', 'will', 'sent', 'dear',
  ]);
  const freq = new Map<string, number>();
  for (const e of emails) {
    const text = (e.subject + ' ' + e.snippet + ' ' + (e.body || '')).toLowerCase();
    const words = text.split(/[\s,.()\[\]{}:;!?@#$%^&*+=|\\/<>'"]+/);
    for (const w of words) {
      if (w.length > 4 && !stopwords.has(w) && !/^\d+$/.test(w)) {
        freq.set(w, (freq.get(w) || 0) + 1);
      }
    }
  }
  return Array.from(freq.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w]) => w);
}
