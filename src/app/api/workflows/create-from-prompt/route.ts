import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { getOrganization } from '@/lib/supabase/data';
import { buildWorkflowFromPrompt } from '@/lib/workflows/builder';
import { initWorkflowMemory } from '@/lib/workflows/memory';
import { createWorkflow } from '@/lib/supabase/data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== 'string') return errorResponse('prompt required', 400);

    // Get gateway for AI-powered parsing
    let gatewayUrl = '';
    let authToken = '';
    try {
      const org = await getOrganization(user.id);
      gatewayUrl = org?.openclaw_gateway_url || '';
      authToken = org?.openclaw_auth_token || '';
    } catch {}

    // Build structured workflow from prompt
    const built = await buildWorkflowFromPrompt(prompt, gatewayUrl, authToken);

    // Save to DB
    const workflow = await createWorkflow({
      name: built.name,
      description: built.description,
      trigger_type: built.trigger.type === 'schedule' ? 'scheduled' : built.trigger.type === 'webhook' ? 'webhook' : 'manual',
      schedule: built.trigger.cronExpression ? {
        cron: built.trigger.cronExpression,
        human_readable: built.trigger.humanReadable,
      } : undefined,
      status: 'inactive',
    });

    // Initialize workflow memory with detected integrations
    try {
      await initWorkflowMemory(workflow.id, user.id, built.requiredIntegrations);
    } catch {}

    // Store the full built workflow as metadata
    const supabase = await createClient();
    await supabase.from('workflows').update({
      metadata: {
        steps: built.steps,
        requiredIntegrations: built.requiredIntegrations,
        estimatedDuration: built.estimatedDuration,
        builtFrom: prompt,
        trigger: built.trigger,
      },
    }).eq('id', workflow.id).catch(() => {});

    return jsonResponse({ workflow, built }, 201);
  } catch (err) {
    console.error('create-from-prompt error:', err);
    return errorResponse('Failed to create workflow', 500);
  }
}
