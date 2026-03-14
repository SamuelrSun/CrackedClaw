"use client";

import { useState, useRef, useCallback } from "react";

export interface AttachedFile {
  file: File;
  mode: 'temp' | 'memory';
  preview?: string;
  uploading?: boolean;
  uploaded?: boolean;
  fileId?: string;
  error?: string;
}

interface FileUploadProps {
  onFilesChange: (files: AttachedFile[]) => void;
  files: AttachedFile[];
}

const ACCEPTED_TYPES = [
  'text/plain', 'text/markdown', 'text/csv', 'application/json',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
];

const ACCEPTED_EXT = '.txt,.md,.csv,.json,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.gif,.webp';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function FileUploadButton({ onFilesChange, files }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList) => {
    const toAdd: AttachedFile[] = [];
    for (const f of Array.from(newFiles)) {
      if (!ACCEPTED_TYPES.includes(f.type) && !ACCEPTED_EXT.split(',').some(ext => f.name.endsWith(ext.slice(1)))) continue;
      toAdd.push({ file: f, mode: 'temp' });
    }
    if (toAdd.length) onFilesChange([...files, ...toAdd]);
  }, [files, onFilesChange]);

  const toggleMode = (index: number) => {
    const updated = files.map((f, i) =>
      i === index ? { ...f, mode: f.mode === 'temp' ? 'memory' as const : 'temp' as const } : f
    );
    onFilesChange(updated);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      {/* File chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 px-1">
          {files.map((af, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 pl-2 pr-1 py-0.5 border text-[10px] font-mono rounded-full ${
                af.mode === 'memory'
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-white/[0.1] bg-paper text-grid/60'
              }`}
            >
              <span className="text-xs">{af.file.name.endsWith('.pdf') ? '📄' : af.file.type.startsWith('image') ? '🖼️' : '📎'}</span>
              <span className="max-w-[120px] truncate">{af.file.name}</span>
              <span className="text-[9px] opacity-60">({formatBytes(af.file.size)})</span>

              {/* Mode toggle */}
              <button
                onClick={() => toggleMode(i)}
                title={af.mode === 'memory' ? 'Saved to memory — click for temp only' : 'Temporary — click to save to memory'}
                className={`px-1.5 py-0 rounded-full text-[8px] uppercase font-mono border transition-colors ${
                  af.mode === 'memory'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-transparent text-grid/40 border-grid/20 hover:border-grid/40'
                }`}
              >
                {af.mode === 'memory' ? '💾 Memory' : 'Temp'}
              </button>

              {/* Remove */}
              {!af.uploading && (
                <button
                  onClick={() => removeFile(i)}
                  className="text-grid/30 hover:text-grid/70 px-0.5"
                >
                  ×
                </button>
              )}
              {af.uploading && <span className="text-[9px] animate-pulse">↑</span>}
            </div>
          ))}
        </div>
      )}

      {/* Paperclip button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="p-1.5 text-grid/40 hover:text-grid/70 transition-colors"
        title="Attach file"
      >
        📎
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXT}
        className="hidden"
        onChange={e => e.target.files && addFiles(e.target.files)}
      />
    </div>
  );
}

/**
 * Upload attached files to the server.
 * Returns updated files with fileIds and upload status.
 */
export async function uploadAttachedFiles(
  files: AttachedFile[],
  conversationId?: string
): Promise<AttachedFile[]> {
  const results: AttachedFile[] = [];

  for (const af of files) {
    const formData = new FormData();
    formData.append('file', af.file);
    formData.append('mode', af.mode);
    if (conversationId) formData.append('conversation_id', conversationId);

    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok && data.file) {
        results.push({ ...af, uploaded: true, fileId: data.file.id, uploading: false });
      } else {
        results.push({ ...af, error: data.error || 'Upload failed', uploading: false });
      }
    } catch {
      results.push({ ...af, error: 'Network error', uploading: false });
    }
  }

  return results;
}
