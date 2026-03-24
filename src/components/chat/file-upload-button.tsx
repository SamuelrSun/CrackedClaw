"use client";

import { useRef, useCallback } from "react";

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string; // MIME
  previewUrl?: string; // for images
  uploadProgress?: number;
  uploadedUrl?: string;
  fileId?: string; // server-assigned file ID (from upload response)
  status: "pending" | "uploading" | "uploaded" | "error";
}

export interface FileUploadButtonProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  currentFiles: UploadedFile[];
  maxFiles?: number; // default 5
  maxSizeMB?: number; // default 25
  disabled?: boolean;
}

const ACCEPTED_EXT = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.js,.ts,.tsx,.jsx,.py,.go,.rs,.java,.c,.cpp,.h,.rb,.php,.sh,.sql,.r,.swift,.kt,.yaml,.yml,.toml,.xml,.env,.ini,.conf,.log,.jsonl,.tsv,.scss,.less,.svg,.css,.html,.zip,.json,.ndjson";

export function FileUploadButton({
  onFilesSelected,
  currentFiles,
  maxFiles = 5,
  maxSizeMB = 25,
  disabled = false,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (fileList: FileList) => {
      const newFiles: UploadedFile[] = [];
      const remaining = maxFiles - currentFiles.length;
      const maxBytes = maxSizeMB * 1024 * 1024;

      for (const f of Array.from(fileList)) {
        if (newFiles.length >= remaining) break;
        if (f.size > maxBytes) continue;

        const uploadedFile: UploadedFile = {
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: f,
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
          status: "pending",
        };

        // Generate preview URL for images
        if (f.type.startsWith("image/")) {
          uploadedFile.previewUrl = URL.createObjectURL(f);
        }

        newFiles.push(uploadedFile);
      }

      if (newFiles.length > 0) {
        onFilesSelected([...currentFiles, ...newFiles]);
      }
    },
    [currentFiles, maxFiles, maxSizeMB, onFilesSelected]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || currentFiles.length >= maxFiles}
        className="p-2 text-grid/40 hover:text-grid/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
        onChange={(e) => {
          if (e.target.files) {
            addFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />
    </>
  );
}

export { ACCEPTED_EXT };

/**
 * Upload attached files to the server.
 * Returns updated files with progress tracking.
 */
export async function uploadFiles(
  files: UploadedFile[],
  conversationId?: string,
  onProgress?: (id: string, progress: number) => void
): Promise<UploadedFile[]> {
  const results: UploadedFile[] = [];

  for (const uf of files) {
    if (uf.status === "uploaded") {
      results.push(uf);
      continue;
    }

    const formData = new FormData();
    formData.append("file", uf.file);
    formData.append("mode", "temp");
    if (conversationId) formData.append("conversation_id", conversationId);

    onProgress?.(uf.id, 10);

    try {
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok && data.file) {
        onProgress?.(uf.id, 100);
        results.push({
          ...uf,
          status: "uploaded",
          uploadProgress: 100,
          uploadedUrl: data.file.url,
          fileId: data.file.id ?? undefined,
        });
      } else {
        results.push({ ...uf, status: "error" });
      }
    } catch {
      results.push({ ...uf, status: "error" });
    }
  }

  return results;
}
