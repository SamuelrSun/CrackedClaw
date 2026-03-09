import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/files/[id] — download/serve file (auth required, verify ownership)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const { data: file, error: dbError } = await supabase
    .from('files')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (dbError || !file) return errorResponse('File not found', 404);

  // Generate a fresh signed URL
  const bucket = file.mode === 'temp' ? 'temp-files' : 'memory-files';
  const { data: signedData, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(file.storage_path, 3600); // 1h

  if (signErr || !signedData) return errorResponse('Could not generate download URL', 500);

  return jsonResponse({
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.type,
    url: signedData.signedUrl,
    created_at: file.created_at,
  });
}

// DELETE /api/files/[id] — remove a file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();

  // Verify ownership and get storage path
  const { data: file, error: dbError } = await supabase
    .from('files')
    .select('storage_path, mode')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (dbError || !file) return errorResponse('File not found', 404);

  // Remove from storage
  const bucket = file.mode === 'temp' ? 'temp-files' : 'memory-files';
  await supabase.storage.from(bucket).remove([file.storage_path]);

  // Remove DB record (chunks cascade)
  await supabase.from('files').delete().eq('id', params.id).eq('user_id', user.id);

  return jsonResponse({ message: 'File deleted' });
}
