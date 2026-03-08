import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { getUserFiles, deleteFile } from '@/lib/files/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const mode = request.nextUrl.searchParams.get('mode') as 'temp' | 'memory' | undefined;
  const files = await getUserFiles(user.id, mode || undefined);
  return jsonResponse({ files, count: files.length });
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return errorResponse('id required', 400);
  await deleteFile(id, user.id);
  return jsonResponse({ message: 'File deleted' });
}
