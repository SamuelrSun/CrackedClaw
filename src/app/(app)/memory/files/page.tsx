"use client";

import { useState, useEffect, useCallback } from "react";

interface FileRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  mode: string;
  embedding_status: string;
  chunk_count: number;
  created_at: string;
  warning?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileIcon(type: string, name: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return '📄';
  if (name.endsWith('.csv')) return '📊';
  if (name.endsWith('.md') || name.endsWith('.txt')) return '📝';
  if (name.endsWith('.json')) return '{}';
  return '📎';
}

export default function MemoryFilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files?mode=memory');
      const data = await res.json();
      setFiles(data.files || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const deleteFile = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/files?id=${id}`, { method: 'DELETE' });
      setFiles(prev => prev.filter(f => f.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'memory');
    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (res.ok) fetchFiles();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-header text-3xl font-bold tracking-tight mb-1">Memory Files</h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
            Documents saved to long-term AI memory
          </p>
        </div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={handleUpload}
            accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.png,.jpg,.jpeg" />
          <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-wide bg-grid text-paper hover:bg-grid/80 transition-colors">
            {uploading ? 'Uploading...' : '+ Add File'}
          </div>
        </label>
      </div>

      <div className="mb-4 p-3 border border-blue-200 bg-blue-50">
        <p className="font-mono text-[10px] text-blue-700">
          Files saved here are chunked and indexed — your AI searches them automatically when relevant, across all conversations.
          Text files (TXT, MD, CSV, JSON) are fully indexed. PDFs and DOCX are stored but not yet text-extracted.
        </p>
      </div>

      {loading ? (
        <p className="font-mono text-xs text-grid/40">Loading...</p>
      ) : files.length === 0 ? (
        <div className="border border-[rgba(58,58,56,0.15)] bg-paper p-12 text-center">
          <div className="text-4xl mb-3">📁</div>
          <h2 className="font-header text-xl font-bold mb-2">No memory files yet</h2>
          <p className="font-mono text-xs text-grid/50 max-w-sm mx-auto">
            Upload documents, notes, or specs. Your AI will reference them automatically in future chats.
            You can also toggle any chat attachment to &quot;Memory&quot; mode.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="border border-[rgba(58,58,56,0.15)] bg-paper p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">{fileIcon(file.type, file.name)}</span>
                <div className="min-w-0">
                  <p className="font-mono text-xs text-grid font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[9px] text-grid/40">{formatBytes(file.size)}</span>
                    <span className="font-mono text-[9px] text-grid/30">·</span>
                    <span className={`font-mono text-[9px] uppercase ${
                      file.embedding_status === 'complete' ? 'text-forest' :
                      file.embedding_status === 'skipped' ? 'text-grid/40' : 'text-amber-600'
                    }`}>
                      {file.embedding_status === 'complete' ? `✓ ${file.chunk_count} chunks indexed` :
                       file.embedding_status === 'skipped' ? 'stored (not indexed)' :
                       file.embedding_status}
                    </span>
                    {file.warning && (
                      <span className="font-mono text-[9px] text-amber-500" title={file.warning}>⚠</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteFile(file.id)}
                disabled={deleting === file.id}
                className="font-mono text-[10px] uppercase text-coral/60 hover:text-coral transition-colors ml-4 flex-shrink-0 disabled:opacity-50"
              >
                {deleting === file.id ? 'Deleting...' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
