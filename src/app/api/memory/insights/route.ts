import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { mem0GetAll, type Mem0Memory } from '@/lib/memory/mem0-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain') ?? undefined;

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
    console.error('[memory] Failed to fetch insights:', err);
    // Return empty insights, not an error
    return jsonResponse({
      insights: {
        topics: [],
        contacts: [],
        automationOpportunities: [],
        memoryCount: 0,
        domains: [],
      },
      source: 'pgvector',
      memories: [],
    });
  }
}
