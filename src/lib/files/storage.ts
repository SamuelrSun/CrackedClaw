/**
 * File Storage Service
 * Handles upload/download from Supabase Storage and chunk storage in DB.
 * 
 * Storage buckets needed (create in Supabase dashboard):
 *   - temp-files   (private, 10MB limit)
 *   - memory-files (private, 50MB limit)
 */

import { createClient } from '@/lib/supabase/server';
import { extractText, validateFile } from './extractor';

export interface FileRecord {
  id: string;
  user_id: string;
  name: string;
  size: number;
  type: string;
  mode: 'temp' | 'memory';
  storage_path: string;
  url?: string;
  conversation_id?: string;
  embedding_status: 'pending' | 'processing' | 'complete' | 'failed' | 'skipped';
  chunk_count: number;
  created_at: string;
  expires_at?: string;
  warning?: string;
}

/**
 * Upload a file to Supabase Storage and create a DB record.
 * For 'memory' files, also chunks and stores the text.
 */
export async function uploadFile(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  mode: 'temp' | 'memory';
  conversationId?: string;
}): Promise<{ file: FileRecord | null; error?: string }> {
  const { userId, fileName, mimeType, buffer, mode, conversationId } = params;

  // Validate
  const validation = validateFile(fileName, mimeType, buffer.length, mode);
  if (!validation.valid) {
    return { file: null, error: validation.error };
  }

  const supabase = await createClient();
  const bucket = mode === 'temp' ? 'temp-files' : 'memory-files';
  const storagePath = `${userId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    // Bucket may not exist yet — return helpful error
    return {
      file: null,
      error: `Storage upload failed: ${uploadError.message}. Ensure the '${bucket}' bucket exists in Supabase Storage.`,
    };
  }

  // Get signed URL for temp files (24h), public URL for memory
  let url: string | undefined;
  if (mode === 'temp') {
    const { data: signedData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 86400); // 24h
    url = signedData?.signedUrl;
  }

  // Extract text for chunking
  const extraction = await extractText(buffer, mimeType, fileName);

  // Insert file record
  const { data: fileRow, error: dbError } = await supabase
    .from('files')
    .insert({
      user_id: userId,
      name: fileName,
      size: buffer.length,
      type: mimeType,
      mode,
      storage_path: storagePath,
      url,
      conversation_id: conversationId,
      embedding_status: extraction.extractable ? 'pending' : 'skipped',
      chunk_count: 0,
      expires_at: mode === 'temp' ? new Date(Date.now() + 86400000).toISOString() : null,
    })
    .select()
    .single();

  if (dbError) {
    return { file: null, error: `DB error: ${dbError.message}` };
  }

  // For memory files with extractable text, store chunks immediately
  if (mode === 'memory' && extraction.extractable && extraction.chunks.length > 0) {
    await storeChunks(fileRow.id, userId, extraction.chunks, supabase);
    await supabase.from('files')
      .update({ embedding_status: 'complete', chunk_count: extraction.chunks.length })
      .eq('id', fileRow.id);
    fileRow.embedding_status = 'complete';
    fileRow.chunk_count = extraction.chunks.length;
  }

  return {
    file: { ...fileRow, warning: extraction.warning } as FileRecord,
  };
}

async function storeChunks(
  fileId: string,
  userId: string,
  chunks: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<void> {
  const rows = chunks.map((content, index) => ({
    file_id: fileId,
    user_id: userId,
    content,
    chunk_index: index,
    metadata: { index, total: chunks.length },
  }));

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from('file_chunks').insert(rows.slice(i, i + 50));
  }
}

/**
 * Search file chunks using Postgres full-text search.
 * No vector embeddings needed — works out of the box with Supabase.
 */
export async function searchFileChunks(
  userId: string,
  query: string,
  limit = 5
): Promise<Array<{ content: string; fileName: string; fileId: string }>> {
  const supabase = await createClient();

  // Keyword search across chunks - use ilike for broad compatibility
  // For each significant word in the query, search and merge results
  const words = query.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  if (!words.length) return [];

  // Search with the first meaningful word (simple but effective)
  const searchTerm = words[0];
  const { data: chunkData } = await supabase
    .from('file_chunks')
    .select('content, file_id')
    .eq('user_id', userId)
    .ilike('content', `%${searchTerm}%`)
    .limit(limit);

  if (!chunkData || !chunkData.length) return [];

  // Fetch file names separately
  const fileIds = Array.from(new Set(chunkData.map((c: { file_id: string }) => c.file_id)));
  const { data: fileData } = await supabase
    .from('files')
    .select('id, name')
    .in('id', fileIds);

  const fileMap = new Map((fileData || []).map((f: { id: string; name: string }) => [f.id, f.name]));

  return chunkData.map((row: { content: string; file_id: string }) => ({
    content: row.content,
    fileId: row.file_id,
    fileName: fileMap.get(row.file_id) || 'Unknown file',
  }));
}

/**
 * Get all memory files for a user.
 */
export async function getUserFiles(userId: string, mode?: 'temp' | 'memory'): Promise<FileRecord[]> {
  const supabase = await createClient();
  let query = supabase.from('files').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (mode) query = query.eq('mode', mode);
  const { data } = await query;
  return (data || []) as FileRecord[];
}

/**
 * Delete a file and all its chunks.
 */
export async function deleteFile(fileId: string, userId: string): Promise<void> {
  const supabase = await createClient();
  const { data: file } = await supabase.from('files').select('storage_path, mode').eq('id', fileId).eq('user_id', userId).single();
  if (file) {
    const bucket = file.mode === 'temp' ? 'temp-files' : 'memory-files';
    await supabase.storage.from(bucket).remove([file.storage_path]);
  }
  await supabase.from('files').delete().eq('id', fileId).eq('user_id', userId);
  // Chunks cascade delete via FK
}
