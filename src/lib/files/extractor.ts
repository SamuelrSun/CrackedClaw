/**
 * Text extraction from uploaded files.
 * Handles text-based formats directly.
 * Binary formats (PDF, DOCX) are stored but not extracted server-side —
 * the AI can read them via browser tool or we note the limitation.
 */

export interface ExtractionResult {
  text: string;
  chunks: string[];
  extractable: boolean;
  warning?: string;
}

const CHUNK_SIZE = 1500;   // characters per chunk (roughly 375 tokens)
const CHUNK_OVERLAP = 200; // overlap between chunks

/**
 * Split text into overlapping chunks for storage/retrieval.
 */
export function chunkText(text: string): string[] {
  if (!text || text.length < CHUNK_SIZE) {
    return text ? [text.trim()] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    // Try to break at a sentence or paragraph boundary
    if (end < text.length) {
      const breakAt = text.lastIndexOf('\n', end);
      if (breakAt > start + CHUNK_SIZE * 0.5) {
        end = breakAt;
      } else {
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + CHUNK_SIZE * 0.5) {
          end = sentenceBreak + 1;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }

    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Extract text from a file buffer based on its MIME type.
 * Returns extracted text + chunks. Binary formats return a placeholder.
 */
export function extractText(buffer: Buffer, mimeType: string, fileName: string): ExtractionResult {
  // Plain text formats — read directly
  if (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/csv' ||
    mimeType === 'application/json' ||
    mimeType === 'text/html' ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.json')
  ) {
    const text = buffer.toString('utf-8').trim();
    return {
      text,
      chunks: chunkText(text),
      extractable: true,
    };
  }

  // PDF — not extractable server-side without native deps
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return {
      text: `[PDF: ${fileName}]`,
      chunks: [`[PDF file: ${fileName}. Content not extracted — AI can read this via browser tool if needed.]`],
      extractable: false,
      warning: 'PDF text extraction requires additional setup. The file is stored and accessible.',
    };
  }

  // DOCX / Office formats
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    fileName.endsWith('.docx') ||
    fileName.endsWith('.doc')
  ) {
    return {
      text: `[Word Document: ${fileName}]`,
      chunks: [`[Word document: ${fileName}. Stored for reference.]`],
      extractable: false,
      warning: 'Word document extraction not yet supported. File is stored and can be referenced.',
    };
  }

  // XLSX / CSV-ish
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName.endsWith('.xlsx')
  ) {
    return {
      text: `[Excel Spreadsheet: ${fileName}]`,
      chunks: [`[Excel file: ${fileName}. Stored for reference.]`],
      extractable: false,
      warning: 'Excel extraction not yet supported. File is stored.',
    };
  }

  // Images
  if (mimeType.startsWith('image/')) {
    return {
      text: `[Image: ${fileName}]`,
      chunks: [`[Image file: ${fileName}. Stored — AI can view via browser tool.]`],
      extractable: false,
    };
  }

  // Unknown
  return {
    text: `[File: ${fileName}]`,
    chunks: [`[File: ${fileName} (${mimeType})]`],
    extractable: false,
    warning: `File type ${mimeType} not supported for text extraction.`,
  };
}

/**
 * Validate a file before upload.
 */
export function validateFile(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  mode: 'temp' | 'memory'
): { valid: boolean; error?: string } {
  const maxSize = mode === 'temp' ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB temp, 50MB memory

  if (sizeBytes > maxSize) {
    return { valid: false, error: `File too large. Max ${mode === 'temp' ? '10MB' : '50MB'} for ${mode} files.` };
  }

  const allowed = [
    'text/plain', 'text/markdown', 'text/csv', 'text/html',
    'application/json', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  ];

  const ext = fileName.split('.').pop()?.toLowerCase();
  const allowedExt = ['txt', 'md', 'csv', 'json', 'pdf', 'docx', 'doc', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'html'];

  if (!allowed.includes(mimeType) && !allowedExt.includes(ext || '')) {
    return { valid: false, error: `File type not supported: ${mimeType}` };
  }

  return { valid: true };
}
