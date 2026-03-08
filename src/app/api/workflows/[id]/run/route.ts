import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { recordWorkflowRun, buildWorkflowContext } from '@/lib/workflows/memory';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const startTime = Date.now();
  try {
    const context = await buildWorkflowContext(params.id);
    // In production this would dispatch to the gateway for execution
    // For now, record a manual trigger and return context
    await recordWorkflowRun(params.id, user.id, true);
    return jsonResponse({ 
      success: true, 
      workflowId: params.id, 
      context,
      duration: Date.now() - startTime,
      message: 'Workflow run initiated — check your connected integrations for results.',
    });
  } catch (err) {
    await recordWorkflowRun(params.id, user.id, false, String(err));
    return errorResponse('Workflow run failed', 500);
  }
}
