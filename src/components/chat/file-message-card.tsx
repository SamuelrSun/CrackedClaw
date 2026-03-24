"use client";

import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatMimeType(mime: string): string {
  if (!mime) return "File";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return mime.replace("image/", "").toUpperCase();
  if (mime.includes("spreadsheet") || mime.includes("csv")) return "Spreadsheet";
  if (mime.includes("word")) return "Document";
  if (mime.includes("zip")) return "Archive";
  const parts = mime.split("/");
  return parts[parts.length - 1].toUpperCase();
}

function getFileIcon(mime: string, name: string): string {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "📄";
  if (
    mime.includes("spreadsheet") ||
    name.endsWith(".csv") ||
    name.endsWith(".xlsx")
  )
    return "📊";
  if (mime.includes("word") || name.endsWith(".docx")) return "📝";
  if (name.endsWith(".zip")) return "🗜️";
  return "📎";
}

export interface FileAttachment {
  id?: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  previewUrl?: string;
}

interface FileMessageCardProps {
  files: FileAttachment[];
  message?: string;
  className?: string;
}

export function FileMessageCard({ files, message, className }: FileMessageCardProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {files.map((file, idx) => {
        const isImage = file.mimeType.startsWith("image/");
        const hasPreview = isImage && (file.url || file.previewUrl);

        // Image files: tall card with inline preview
        if (hasPreview) {
          return (
            <div
              key={file.id || idx}
              className="border border-white/[0.1] rounded-lg bg-white/[0.06] backdrop-blur-sm overflow-hidden"
              style={{ maxWidth: 300 }}
            >
              {/* Image preview */}
              <div className="w-full rounded-t overflow-hidden border-b border-white/[0.08]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.url || file.previewUrl}
                  alt={file.name}
                  className="w-full object-contain"
                  style={{ maxWidth: 300 }}
                />
              </div>

              {/* File metadata */}
              <div className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <span className="text-base mt-0.5">
                    {getFileIcon(file.mimeType, file.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white/85 truncate">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5 font-mono">
                      {formatBytes(file.size)} · {formatMimeType(file.mimeType)}
                    </div>
                  </div>
                </div>

                {/* Download action */}
                {file.url && (
                  <div className="flex gap-2 mt-2">
                    <a
                      href={file.url}
                      download={file.name}
                      className="flex items-center gap-1 text-[10px] font-mono text-white/70 border border-white/[0.15] rounded px-2 py-0.5 hover:bg-white/[0.08] transition-colors"
                    >
                      📥 Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Non-image files: compact horizontal pill
        return (
          <div
            key={file.id || idx}
            className="inline-flex items-center gap-2 border border-white/[0.1] rounded-full bg-white/[0.06] backdrop-blur-sm px-3 py-1.5 max-w-full"
          >
            <span className="text-sm shrink-0">
              {getFileIcon(file.mimeType, file.name)}
            </span>
            <span className="text-sm font-medium text-white/85 truncate max-w-[180px]">
              {file.name}
            </span>
            <span className="text-[10px] text-white/40 font-mono whitespace-nowrap shrink-0">
              {formatBytes(file.size)} · {formatMimeType(file.mimeType)}
            </span>
            {file.url && (
              <>
                <span className="text-white/20 text-xs shrink-0">·</span>
                <a
                  href={file.url}
                  download={file.name}
                  className="text-[10px] font-mono text-white/50 hover:text-white/70 transition-colors shrink-0"
                  title="Download"
                >
                  📥
                </a>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-white/50 hover:text-white/70 transition-colors shrink-0"
                  title="Preview"
                >
                  👁
                </a>
              </>
            )}
          </div>
        );
      })}

      {/* Attached message */}
      {message && (
        <p className="text-sm whitespace-pre-wrap text-white leading-relaxed">
          {message}
        </p>
      )}
    </div>
  );
}
