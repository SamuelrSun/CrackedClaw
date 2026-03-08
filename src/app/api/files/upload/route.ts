import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { uploadFile } from '@/lib/files/storage';

export const dynamic = 'force-dynamic';

// POST /api/files/upload
// Multipart form: file + mode (temp|memory) + conversation_id?
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) || 'temp';
    const conversationId = formData.get('conversation_id') as string | undefined;

    if (!file) return errorResponse('No file provided', 400);
    if (mode !== 'temp' && mode !== 'memory') return errorResponse('mode must be temp or memory', 400);

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadFile({
      userId: user.id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      buffer,
      mode: mode as 'temp' | 'memory',
      conversationId: conversationId || undefined,
    });

    if (result.error) return errorResponse(result.error, 400);

    return jsonResponse({
      file: result.file,
      message: mode === 'memory'
        ? `${file.name} saved to memory — I'll reference it in future conversations`
        : `${file.name} attached to this conversation`,
    }, 201);
  } catch (err) {
    console.error('File upload error:', err);
    return errorResponse('Upload failed', 500);
  }
}
