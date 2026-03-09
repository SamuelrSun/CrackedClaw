"use client";

import { cn } from "@/lib/utils";
import type { UploadedFile } from "./file-upload-button";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(type: string, name: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "📄";
  if (
    type.includes("spreadsheet") ||
    name.endsWith(".csv") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  )
    return "📊";
  if (
    type.includes("word") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  )
    return "📝";
  if (name.endsWith(".zip")) return "🗜️";
  if (
    name.endsWith(".js") ||
    name.endsWith(".ts") ||
    name.endsWith(".py") ||
    name.endsWith(".json") ||
    name.endsWith(".html") ||
    name.endsWith(".css")
  )
    return "💻";
  return "📎";
}

interface FilePreviewProps {
  files: UploadedFile[];
  onRemove: (id: string) => void;
}

export function FilePreview({ files, onRemove }: FilePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 px-1 mb-2 scrollbar-thin scrollbar-thumb-grid/20">
      {files.map((uf) => (
        <div
          key={uf.id}
          className={cn(
            "relative flex-shrink-0 rounded border bg-white overflow-hidden",
            uf.status === "error"
              ? "border-red-300"
              : "border-[rgba(58,58,56,0.2)]"
          )}
          style={{ maxWidth: 160 }}
        >
          {/* Image thumbnail */}
          {uf.type.startsWith("image/") && uf.previewUrl ? (
            <div className="w-full" style={{ maxHeight: 80, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uf.previewUrl}
                alt={uf.name}
                className="w-full object-cover"
                style={{ maxHeight: 80 }}
              />
            </div>
          ) : null}

          {/* File info */}
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-1">
              <span className="text-xs">{getFileIcon(uf.type, uf.name)}</span>
              <span className="text-[10px] font-mono text-forest truncate max-w-[100px]">
                {uf.name}
              </span>
            </div>
            <div className="text-[9px] text-grid/40 mt-0.5">
              {formatBytes(uf.size)}
              {uf.status === "uploading" && " · uploading..."}
              {uf.status === "uploaded" && " · ✓"}
              {uf.status === "error" && " · error"}
            </div>

            {/* Upload progress bar */}
            {uf.status === "uploading" && (
              <div className="mt-1 h-0.5 bg-grid/10 rounded">
                <div
                  className="h-full bg-green-500 rounded transition-all duration-200"
                  style={{ width: `${uf.uploadProgress ?? 0}%` }}
                />
              </div>
            )}
          </div>

          {/* Remove button */}
          {uf.status !== "uploading" && (
            <button
              onClick={() => onRemove(uf.id)}
              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-grid/20 hover:bg-grid/40 flex items-center justify-center text-[9px] text-grid/60 hover:text-grid/90 transition-colors"
              title="Remove file"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
