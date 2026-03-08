import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { getWorkflowMemory, updateWorkflowMemory, addWorkflowLearning } from '@/lib/workflows/memory';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireApiAuth();
  if (error) return error;
  const memory = await getWorkflowMemory(params.id);
  if (!memory) return errorResponse('Workflow memory not found', 404);
  return jsonResponse({ memory });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireApiAuth();
  if (error) return error;
  const body = await request.json();
  await updateWorkflowMemory(params.id, body);
  return jsonResponse({ message: 'Memory updated' });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireApiAuth();
  if (error) return error;
  const { note, type } = await request.json();
  if (!note) return errorResponse('note required', 400);
  await addWorkflowLearning(params.id, note, type || 'improvement');
  return jsonResponse({ message: 'Learning added' });
}
