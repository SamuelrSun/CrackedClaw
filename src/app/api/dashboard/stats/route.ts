import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const weekStart = getWeekStart();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const displayName = user.user_metadata?.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] || 'there';

  const { count: messagesThisWeek } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', weekStart);

  const { count: conversationsThisWeek } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', weekStart);

  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'connected');

  const { data: memoryItems } = await supabase
    .from('memories')
    .select('id, domain, content, metadata')
    .eq('user_id', user.id);

  const contactMemory = memoryItems?.filter((m: { domain: string }) => m.domain === 'email') ?? [];
  const writingStyleSaved = memoryItems?.some((m: { content: string }) =>
    m.content?.toLowerCase().includes('writing')
  ) ?? false;
  const schedulePatterns = memoryItems?.filter((m: { domain: string }) =>
    m.domain === 'calendar'
  ).length ?? 0;
  const automationIdeas = memoryItems?.filter((m: { content: string }) =>
    m.content?.toLowerCase().includes('automation')
  ).length ?? 0;

  const { data: recentConversations } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(5);

  const now = new Date();

  const weeklyActivity = days.map((day, idx) => {
    return { day, tasks: 0 };
  });

  const { data: weekMessages } = await supabase
    .from('messages')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', weekStart);

  if (weekMessages) {
    weekMessages.forEach((msg: { created_at: string }) => {
      const msgDate = new Date(msg.created_at);
      const dayIdx = msgDate.getDay();
      const normalizedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
      if (weeklyActivity[normalizedIdx]) {
        weeklyActivity[normalizedIdx].tasks += 1;
      }
    });
  }

  const recentActivity = (recentConversations ?? []).slice(0, 4).map((conv: { id: string; title: string; created_at: string; updated_at: string }, i: number) => ({
    id: conv.id,
    type: 'task' as const,
    status: 'success' as const,
    title: conv.title || `Conversation ${i + 1}`,
    timestamp: conv.updated_at || conv.created_at,
  }));

  if (recentActivity.length === 0) {
    recentActivity.push({
      id: 'placeholder-1',
      type: "task" as const,
      status: 'success' as const,
      title: 'Your AI is ready and waiting',
      timestamp: now.toISOString(),
    });
  }

  const integrationsCount = integrations?.length ?? 0;
  const tasksCompleted = conversationsThisWeek ?? 0;
  const timeSaved = Math.round((messagesThisWeek ?? 0) * 0.05 * 10) / 10;

  return jsonResponse({
    greeting: getGreeting(displayName),
    stats: {
      emailsProcessed: messagesThisWeek ?? 0,
      tasksCompleted,
      timeSavedHours: timeSaved,
      integrationsConnected: integrationsCount,
    },
    recentActivity,
    memoryInsights: {
      contactsLearned: contactMemory.length,
      writingStyleSaved,
      schedulePatterns,
      automationIdeas,
    },
    weeklyActivity,
  });
}
