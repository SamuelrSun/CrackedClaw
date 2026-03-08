/**
 * Workflow Memory
 * Each workflow maintains its own memory: learned execution patterns,
 * linked integrations, specific resource URLs, and learnings from past runs.
 */

import { createClient } from '@/lib/supabase/server';

export interface WorkflowResource {
  type: 'spreadsheet' | 'channel' | 'folder' | 'doc' | 'calendar' | 'url' | 'other';
  name: string;
  url?: string;
  id?: string;
  integrationSlug: string;
}

export interface WorkflowLearning {
  date: string;
  note: string;
  type: 'improvement' | 'warning' | 'pattern';
}

export interface WorkflowMemory {
  workflowId: string;
  linkedIntegrations: string[];
  specificResources: WorkflowResource[];
  executionNotes: string;
  successCount: number;
  failureCount: number;
  learnings: WorkflowLearning[];
  updatedAt: string;
}

export async function getWorkflowMemory(workflowId: string): Promise<WorkflowMemory | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workflow_memory')
    .select('*')
    .eq('workflow_id', workflowId)
    .single();

  if (!data) return null;
  return {
    workflowId,
    linkedIntegrations: data.linked_integrations || [],
    specificResources: data.specific_resources || [],
    executionNotes: data.execution_notes || '',
    successCount: data.success_count || 0,
    failureCount: data.failure_count || 0,
    learnings: data.learnings || [],
    updatedAt: data.updated_at,
  };
}

export async function initWorkflowMemory(workflowId: string, userId: string, integrations: string[] = []): Promise<void> {
  const supabase = await createClient();
  await supabase.from('workflow_memory').upsert({
    workflow_id: workflowId,
    user_id: userId,
    linked_integrations: integrations,
    specific_resources: [],
    execution_notes: '',
    success_count: 0,
    failure_count: 0,
    learnings: [],
  }, { onConflict: 'workflow_id' });
}

export async function updateWorkflowMemory(workflowId: string, updates: {
  linkedIntegrations?: string[];
  specificResources?: WorkflowResource[];
  executionNotes?: string;
}): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.linkedIntegrations !== undefined) patch.linked_integrations = updates.linkedIntegrations;
  if (updates.specificResources !== undefined) patch.specific_resources = updates.specificResources;
  if (updates.executionNotes !== undefined) patch.execution_notes = updates.executionNotes;
  await supabase.from('workflow_memory').update(patch).eq('workflow_id', workflowId);
}

export async function addWorkflowLearning(workflowId: string, note: string, type: WorkflowLearning['type']): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from('workflow_memory').select('learnings').eq('workflow_id', workflowId).single();
  const learnings: WorkflowLearning[] = data?.learnings || [];
  learnings.push({ date: new Date().toISOString(), note, type });
  // Keep last 50 learnings
  const trimmed = learnings.slice(-50);
  await supabase.from('workflow_memory').update({ learnings: trimmed, updated_at: new Date().toISOString() }).eq('workflow_id', workflowId);
}

export async function recordWorkflowRun(workflowId: string, userId: string, success: boolean, error?: string): Promise<void> {
  const supabase = await createClient();
  // Update run counters
  const { data } = await supabase.from('workflow_memory').select('success_count, failure_count').eq('workflow_id', workflowId).single();
  if (data) {
    await supabase.from('workflow_memory').update({
      success_count: success ? (data.success_count || 0) + 1 : data.success_count,
      failure_count: !success ? (data.failure_count || 0) + 1 : data.failure_count,
      updated_at: new Date().toISOString(),
    }).eq('workflow_id', workflowId);
  }
  // Log run
  await supabase.from('workflow_runs').insert({
    workflow_id: workflowId,
    user_id: userId,
    status: success ? 'success' : 'failed',
    error,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}

/**
 * Build an AI-ready context string for a workflow (injected before execution).
 */
export async function buildWorkflowContext(workflowId: string): Promise<string> {
  const mem = await getWorkflowMemory(workflowId);
  if (!mem) return '';

  const parts: string[] = ['## Workflow Execution Context'];
  if (mem.linkedIntegrations.length) parts.push(`Connected integrations: ${mem.linkedIntegrations.join(', ')}`);
  if (mem.specificResources.length) {
    parts.push('Specific resources:');
    mem.specificResources.forEach(r => {
      parts.push(`  - ${r.name} (${r.type})${r.url ? ': ' + r.url : ''}`);
    });
  }
  if (mem.executionNotes) parts.push(`Execution notes: ${mem.executionNotes}`);
  if (mem.learnings.length) {
    const recent = mem.learnings.slice(-5);
    parts.push('Recent learnings:');
    recent.forEach(l => parts.push(`  - [${l.type}] ${l.note}`));
  }
  parts.push(`Run history: ${mem.successCount} successes, ${mem.failureCount} failures`);
  return parts.join('\n');
}
