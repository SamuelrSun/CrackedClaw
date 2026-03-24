/**
 * Resolve file attachments from a chat message.
 * When a message starts with "[Attached files:", look up the files in Supabase Storage,
 * extract text (for text/PDF/code), base64-encode images, and return Claude content blocks.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ResolvedFile {
  name: string;
  mimeType: string;
  size: number;
  textContent?: string;  // extracted text for text/PDF/code files
  base64?: string;       // '[included]' sentinel for images
  mediaType?: string;    // image/png, image/jpeg, etc.
  warning?: string;
}

export interface ResolvedMessage {
  textContent: string;          // the user's actual message (without file prefix), with file text injected
  files: ResolvedFile[];
  contentBlocks: Array<         // Claude API content blocks
    { type: 'text'; text: string } |
    { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  >;
}

const TEXT_CAP = 100_000;        // 100KB max text per file
const TOTAL_TEXT_CAP = 200_000;  // 200KB total text across all files
const IMAGE_CAP = 5 * 1024 * 1024; // 5MB max per image
const MAX_IMAGES = 3;

const PREFIX = '[Attached files:';
const FILE_IDS_PREFIX = '[Attached file_ids:';
const SEP = ']\nUser message: ';

/**
 * Strip the "[Attached file_ids: ...]\n[Attached files: ...]\nUser message: " prefix
 * from a stored message. Handles both old format (files only) and new format (ids + files).
 * Used when loading previous messages so stale file refs don't confuse the model.
 */
export function stripFilePrefix(content: string): string {
  let normalized = content;
  // Strip the optional [Attached file_ids:] line (new format)
  if (normalized.startsWith(FILE_IDS_PREFIX)) {
    const newlineIdx = normalized.indexOf('\n');
    if (newlineIdx === -1) return content;
    normalized = normalized.slice(newlineIdx + 1);
  }
  if (!normalized.startsWith(PREFIX)) return content;
  const idx = normalized.indexOf(SEP);
  return idx !== -1 ? normalized.slice(idx + SEP.length) : content;
}

/**
 * Parse "name (size, type, ...)" entries from the files portion of the prefix.
 */
function parseFileRefs(filesStr: string): Array<{ name: string; mimeType: string; size: number }> {
  // Split by "), " to separate file entries — commas INSIDE parens are fine
  const entries = filesStr.split(/\),\s*/).map(s => s.trim()).filter(Boolean);
  return entries.map(entry => {
    const parenOpen = entry.lastIndexOf('(');
    if (parenOpen === -1) return { name: entry.trim(), mimeType: 'application/octet-stream', size: 0 };
    const name = entry.slice(0, parenOpen).trim();
    const meta = entry.slice(parenOpen + 1).replace(/\)$/, '');
    const parts = meta.split(',').map(s => s.trim());
    const sizeStr = parts[0] || '0';
    const mimeType = parts[1] || 'application/octet-stream';
    const sizeNum = parseFloat(sizeStr);
    const size = sizeStr.includes('MB')
      ? sizeNum * 1024 * 1024
      : sizeStr.includes('KB')
      ? sizeNum * 1024
      : sizeNum;
    return { name, mimeType, size };
  });
}

/**
 * Resolve file attachments from a message string.
 * Returns textContent (with file text injected), and contentBlocks (for Claude API).
 * NEVER throws — all errors produce warning entries so chat continues.
 */
export async function resolveAttachments(
  userId: string,
  messageContent: string
): Promise<ResolvedMessage> {
  const fallback: ResolvedMessage = {
    textContent: messageContent,
    files: [],
    contentBlocks: [{ type: 'text', text: messageContent }],
  };

  try {
    // Normalize: strip optional [Attached file_ids:] line to find the [Attached files:] part
    let normalized = messageContent;
    let fileIds: string[] = [];

    if (messageContent.startsWith(FILE_IDS_PREFIX)) {
      // Extract IDs from the first line: [Attached file_ids: id1,id2,...]
      const idsLineEnd = messageContent.indexOf(']', FILE_IDS_PREFIX.length);
      if (idsLineEnd !== -1) {
        const idsStr = messageContent.slice(FILE_IDS_PREFIX.length, idsLineEnd);
        fileIds = idsStr.split(',').map(s => s.trim()).filter(Boolean);
      }
      const newlineIdx = messageContent.indexOf('\n');
      if (newlineIdx === -1) return fallback;
      normalized = messageContent.slice(newlineIdx + 1);
    }

    if (!normalized.startsWith(PREFIX)) return fallback;

    const closeIdx = normalized.indexOf(SEP);
    if (closeIdx === -1) return fallback;

    const userMessage = normalized.slice(closeIdx + SEP.length).trim();
    const filesStr = normalized.slice(PREFIX.length, closeIdx);
    const fileRefs = parseFileRefs(filesStr);

    if (fileRefs.length === 0) return fallback;

    const resolvedFiles: ResolvedFile[] = [];
    // Start empty; text block is unshifted at the end
    const imageBlocks: Array<{ type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> = [];
    let totalTextSize = 0;
    let imageCount = 0;

    for (let i = 0; i < fileRefs.length; i++) {
      const ref = fileRefs[i];
      try {
        // PRIMARY: look up by file ID if available (exact match, no ambiguity)
        // FALLBACK: look up by name (backward compat for messages without file_ids)
        let fileRecord: { id: string; name: string; type: string; mode: string; storage_path: string; size: number } | null = null;

        const fileId = fileIds[i];
        if (fileId) {
          const { data } = await supabase
            .from('files')
            .select('id, name, type, mode, storage_path, size')
            .eq('id', fileId)
            .eq('user_id', userId)
            .maybeSingle();
          fileRecord = data;
        }

        if (!fileRecord) {
          // Fallback: look up the most recently uploaded file with this name for this user
          const { data } = await supabase
            .from('files')
            .select('id, name, type, mode, storage_path, size')
            .eq('user_id', userId)
            .eq('name', ref.name)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          fileRecord = data;
        }

        if (!fileRecord) {
          resolvedFiles.push({ name: ref.name, mimeType: ref.mimeType, size: ref.size, warning: 'File not found in storage' });
          continue;
        }

        const bucket = fileRecord.mode === 'temp' ? 'temp-files' : 'memory-files';

        // ── Images: base64 encode for Claude vision ──────────────────────────
        if (fileRecord.type.startsWith('image/') && imageCount < MAX_IMAGES) {
          try {
            const { data: fileData, error } = await supabase.storage
              .from(bucket)
              .download(fileRecord.storage_path);

            if (!error && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              if (arrayBuffer.byteLength <= IMAGE_CAP) {
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                imageBlocks.push({
                  type: 'image',
                  source: { type: 'base64', media_type: fileRecord.type as string, data: base64 },
                });
                imageCount++;
                resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, base64: '[included]' });
                continue;
              } else {
                resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, warning: 'Image too large (>5MB)' });
                continue;
              }
            } else {
              resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, warning: 'Failed to download image' });
              continue;
            }
          } catch {
            resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, warning: 'Failed to load image' });
            continue;
          }
        }

        // ── Text-extractable files ─────────────────────────────────────────
        if (totalTextSize < TOTAL_TEXT_CAP) {
          try {
            const { data: fileData, error } = await supabase.storage
              .from(bucket)
              .download(fileRecord.storage_path);

            if (!error && fileData) {
              const buffer = Buffer.from(await fileData.arrayBuffer());
              // Dynamic import to avoid circular deps
              const { extractText } = await import('./extractor');
              const extraction = await extractText(buffer, fileRecord.type, fileRecord.name);

              if (extraction.extractable && extraction.text) {
                const cappedText = extraction.text.slice(0, TEXT_CAP);
                totalTextSize += cappedText.length;
                resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, textContent: cappedText });
              } else {
                resolvedFiles.push({
                  name: ref.name,
                  mimeType: fileRecord.type,
                  size: fileRecord.size,
                  warning: extraction.warning || 'Could not extract text',
                });
              }
            } else {
              resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, warning: 'Failed to download file' });
            }
          } catch {
            resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, warning: 'Failed to download file' });
          }
        } else {
          resolvedFiles.push({ name: ref.name, mimeType: fileRecord.type, size: fileRecord.size, warning: 'Skipped: total text limit reached' });
        }
      } catch {
        resolvedFiles.push({ name: ref.name, mimeType: ref.mimeType, size: ref.size, warning: 'Unexpected error resolving file' });
      }
    }

    // Build the combined text block (user message + inline file contents)
    const textParts: string[] = [];
    for (const f of resolvedFiles) {
      if (f.textContent) {
        textParts.push(`\n--- File: ${f.name} ---\n${f.textContent}\n--- End: ${f.name} ---`);
      } else if (f.warning) {
        textParts.push(`\n[File: ${f.name} — ${f.warning}]`);
      }
      // Images are already in imageBlocks
    }

    const fullText = userMessage + (textParts.length > 0 ? '\n' + textParts.join('\n') : '');

    // Text block always first, then images
    const contentBlocks: ResolvedMessage['contentBlocks'] = [
      { type: 'text', text: fullText },
      ...imageBlocks,
    ];

    return { textContent: fullText, files: resolvedFiles, contentBlocks };
  } catch {
    // resolveAttachments must NEVER break chat — fall back to original message
    return fallback;
  }
}
