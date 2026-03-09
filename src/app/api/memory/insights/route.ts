import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { mem0GetAll, isMem0Enabled, type Mem0Memory } from '@/lib/memory/mem0-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain') ?? undefined;

  // ─── Self-hosted pgvector memory (primary) ────────────────────────────────
  if (isMem0Enabled()) {
    try {
      const memories: Mem0Memory[] = await mem0GetAll(user.id, domain);

      // Group by domain
      const domainGroups: Record<string, Mem0Memory[]> = {};
      for (const m of memories) {
        const d = m.domain ?? 'general';
        if (!domainGroups[d]) domainGroups[d] = [];
        domainGroups[d].push(m);
      }

      const insights: {
        topics: string[];
        contacts: { name: string; email?: string; frequency: number }[];
        automationOpportunities: string[];
        memoryCount: number;
        domains: string[];
      } = {
        topics: [],
        contacts: [],
        automationOpportunities: [],
        memoryCount: memories.length,
        domains: Object.keys(domainGroups),
      };

      // Topics: use active domains
      for (const d of Object.keys(domainGroups)) {
        if (d !== 'general' && insights.topics.length < 10) {
          insights.topics.push(d.replace(/_/g, ' '));
        }
      }

      // Automation opportunities: pull from email + calendar domains
      const automationCandidates = [
        ...(domainGroups['email'] ?? []),
        ...(domainGroups['calendar'] ?? []),
      ].slice(0, 5);
      for (const m of automationCandidates) {
        if (m.memory && insights.automationOpportunities.length < 5) {
          insights.automationOpportunities.push(m.memory);
        }
      }

      return jsonResponse({ insights, source: 'pgvector', memories });
    } catch (err) {
      console.error('[memory] Failed to fetch insights, falling back to Supabase:', err);
      // fall through
    }
  }

  // ─── Supabase fallback (legacy user_memory table) ─────────────────────────
  const supabase = await createClient();

  const { data, error: dbError } = await supabase
    .from('user_memory')
    .select('key, value, category, tags, source')
    .eq('user_id', user.id)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200);

  if (dbError) {
    return errorResponse('Failed to fetch memory', 500);
  }

  const entries = data || [];

  const insights: {
    topics: string[];
    contacts: { name: string; email?: string; frequency: number }[];
    writingStyle?: { tone: string; avgLength?: number; openingPatterns?: string[]; closingPatterns?: string[] };
    schedulePatterns?: { busiestDays?: string[]; avgMeetingsPerWeek?: number; recurringMeetings?: string[] };
    automationOpportunities: string[];
  } = {
    topics: [],
    contacts: [],
    automationOpportunities: [],
  };

  const writingStyle: Record<string, unknown> = {};
  const schedulePatterns: Record<string, unknown> = {};

  for (const entry of entries) {
    const key = entry.key?.toLowerCase() || '';
    const value = entry.value || '';
    const category = entry.category || '';

    if (category === 'fact' || key.includes('topic') || key.includes('subject')) {
      if (value && !insights.topics.includes(value) && insights.topics.length < 10) {
        insights.topics.push(value);
      }
      if (entry.tags) {
        for (const tag of entry.tags.slice(0, 3)) {
          if (!insights.topics.includes(tag) && insights.topics.length < 10) {
            insights.topics.push(tag);
          }
        }
      }
    }

    if (category === 'contact' || key.includes('contact') || key.includes('person')) {
      const name = key.replace(/^contact_?/i, '').replace(/_/g, ' ').trim();
      if (name && !insights.contacts.find((c) => c.name.toLowerCase() === name.toLowerCase())) {
        const freqMatch = value.match(/(\d+)/);
        insights.contacts.push({
          name,
          frequency: freqMatch ? parseInt(freqMatch[1]) : 1,
          email: value.includes('@') ? value.split(' ')[0] : undefined,
        });
      }
    }

    if (category === 'preference' || key.includes('tone') || key.includes('style') || key.includes('writing')) {
      if (key.includes('tone')) writingStyle.tone = value;
      if (key.includes('length') || key.includes('avg')) {
        const num = parseFloat(value);
        if (!isNaN(num)) writingStyle.avgLength = num;
      }
      if (key.includes('opening') || key.includes('greeting')) {
        writingStyle.openingPatterns = (writingStyle.openingPatterns as string[] || []).concat(value);
      }
      if (key.includes('closing') || key.includes('sign')) {
        writingStyle.closingPatterns = (writingStyle.closingPatterns as string[] || []).concat(value);
      }
    }

    if (category === 'schedule' || key.includes('schedule') || key.includes('meeting') || key.includes('calendar')) {
      if (key.includes('busiest') || key.includes('busy_day')) {
        schedulePatterns.busiestDays = value.split(/[,;]/).map((d: string) => d.trim()).filter(Boolean);
      }
      if (key.includes('avg_meeting') || key.includes('meetings_per_week')) {
        const num = parseFloat(value);
        if (!isNaN(num)) schedulePatterns.avgMeetingsPerWeek = num;
      }
      if (key.includes('recurring')) {
        schedulePatterns.recurringMeetings = (schedulePatterns.recurringMeetings as string[] || []).concat(value);
      }
    }

    if (key.includes('automation') || key.includes('opportunity') || key.includes('automate')) {
      if (value && insights.automationOpportunities.length < 5) {
        insights.automationOpportunities.push(value);
      }
    }
  }

  if (Object.keys(writingStyle).length > 0) {
    insights.writingStyle = writingStyle.tone
      ? (writingStyle as typeof insights.writingStyle)
      : { tone: 'Professional', ...writingStyle };
  }

  if (Object.keys(schedulePatterns).length > 0) {
    insights.schedulePatterns = schedulePatterns as typeof insights.schedulePatterns;
  }

  return jsonResponse({ insights, source: 'supabase' });
}
