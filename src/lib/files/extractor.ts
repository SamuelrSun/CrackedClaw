/**
 * Text extraction from uploaded files.
 * Handles text-based formats directly, PDFs via pdf-parse, DOCX via mammoth.
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
export async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<ExtractionResult> {
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

  // PDF — extract with pdf-parse
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      const text = data.text?.trim() || '';
      if (text.length > 0) {
        return {
          text,
          chunks: chunkText(text),
          extractable: true,
        };
      }
      return {
        text: '',
        chunks: [],
        extractable: false,
        warning: 'PDF appears to be image-based (no extractable text).',
      };
    } catch (err) {
      return {
        text: '',
        chunks: [],
        extractable: false,
        warning: `PDF extraction failed: ${(err as Error).message}`,
      };
    }
  }

  // DOCX / Office formats — extract with mammoth
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    fileName.endsWith('.docx') ||
    fileName.endsWith('.doc')
  ) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() || '';
      if (text.length > 0) {
        return { text, chunks: chunkText(text), extractable: true };
      }
      return { text: '', chunks: [], extractable: false, warning: 'DOCX appears empty.' };
    } catch (err) {
      return {
        text: '',
        chunks: [],
        extractable: false,
        warning: `DOCX extraction failed: ${(err as Error).message}`,
      };
    }
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

  // Code and config files — all UTF-8 text
  const codeExts = [
    'js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'rb', 'php', 'sh', 'bash', 'sql', 'r', 'swift', 'kt', 'yaml', 'yml',
    'toml', 'xml', 'env', 'ini', 'conf', 'dockerfile', 'gitignore',
    'scss', 'less', 'svg', 'log', 'jsonl', 'ndjson', 'tsv', 'css',
  ];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (codeExts.includes(ext)) {
    const text = buffer.toString('utf-8').trim();
    return { text, chunks: chunkText(text), extractable: true };
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
    // Code / script MIME types
    'text/javascript', 'application/javascript', 'text/typescript',
    'text/x-python', 'application/x-python',
    'text/x-java', 'text/x-c', 'text/x-go', 'text/x-rust', 'text/x-ruby',
    'text/x-shellscript', 'text/x-sh', 'text/x-sql',
    'text/yaml', 'application/x-yaml',
    'text/xml', 'application/xml',
    'text/css', 'text/x-scss', 'text/x-less',
    'image/svg+xml',
    'application/zip', 'application/x-zip-compressed',
  ];

  const allowedExt = [
    'txt', 'md', 'csv', 'json', 'pdf', 'docx', 'doc', 'xlsx',
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'html',
    'js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'rb', 'php', 'sh', 'bash', 'sql', 'r', 'swift', 'kt',
    'yaml', 'yml', 'toml', 'xml', 'env', 'ini', 'conf',
    'log', 'jsonl', 'ndjson', 'tsv', 'scss', 'less', 'svg', 'css', 'zip',
  ];

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!allowed.includes(mimeType) && !allowedExt.includes(ext || '')) {
    return { valid: false, error: `File type not supported: ${mimeType}` };
  }

  return { valid: true };
}
