import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BrainClient } from './client';

export const dynamic = 'force-dynamic';

export const metadata = { title: "Brain — Dopl" };

export default async function BrainPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/brain`);

  // Fetch active brain criteria
  const { data: rawCriteria } = await supabase
    .from('memories')
    .select('id, content, context_scope, valid_from, valid_until, correction_count, importance, preference_type, weight, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('memory_type', 'criterion')
    .is('valid_until', null)
    .order('importance', { ascending: false });

  // Fetch recent signals (last 50)
  const { data: rawSignals } = await supabase
    .from('brain_signals')
    .select('id, signal_type, domain, subdomain, context, signal_data, session_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch patterns (last 20)
  const { data: rawPatterns } = await supabase
    .from('brain_patterns')
    .select('id, domain, subdomain, context, pattern_type, description, evidence, occurrence_count, confidence, status, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch memory count (facts)
  const { count: memoryCount } = await supabase
    .from('memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('memory_type', 'fact');

  // Parse criteria from JSON content
  const criteria = (rawCriteria || []).map((row) => {
    try {
      const parsed = JSON.parse(row.content);
      return {
        id: parsed.id || row.id,
        domain: parsed.domain || 'general',
        subdomain: parsed.subdomain || null,
        context: parsed.context || null,
        description: parsed.description || '',
        weight: parsed.weight ?? (row as Record<string, unknown>).weight ?? row.importance ?? 0.5,
        source: parsed.source || 'revealed',
        confidence: parsed.confidence ?? 0.5,
        correction_count: row.correction_count ?? parsed.correction_count ?? 0,
        preference_type: (row as Record<string, unknown>).preference_type || parsed.preference_type || 'general',
        examples: parsed.examples || [],
        valid_from: row.valid_from || parsed.valid_from,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const signals = (rawSignals || []).map((s) => ({
    id: s.id,
    signal_type: s.signal_type,
    domain: s.domain || 'general',
    subdomain: s.subdomain || null,
    context: s.context || null,
    signal_data: s.signal_data as Record<string, unknown>,
    session_id: s.session_id || null,
    created_at: s.created_at,
  }));

  const patterns = (rawPatterns || []).map((p) => ({
    id: p.id,
    domain: p.domain || 'general',
    subdomain: p.subdomain || null,
    context: p.context || null,
    pattern_type: p.pattern_type,
    description: p.description,
    evidence: p.evidence as Array<{ signal_type: string; summary: string; created_at: string }>,
    occurrence_count: p.occurrence_count,
    confidence: p.confidence,
    status: p.status,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  return (
    <BrainClient
      initialCriteria={criteria}
      initialSignals={signals}
      initialPatterns={patterns}
      initialMemoryCount={memoryCount ?? 0}
    />
  );
}
