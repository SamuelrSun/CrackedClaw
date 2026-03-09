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
      {files.map((file, idx) => (
        <div
          key={file.id || idx}
          className="border border-[rgba(58,58,56,0.2)] rounded bg-white overflow-hidden"
          style={{ maxWidth: 400 }}
        >
          {/* Image preview */}
          {file.mimeType.startsWith("image/") && (file.url || file.previewUrl) ? (
            <div className="w-full" style={{ maxWidth: 400 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url || file.previewUrl}
                alt={file.name}
                className="w-full rounded-t object-contain shadow-sm"
                style={{ maxWidth: 400 }}
              />
            </div>
          ) : null}

          {/* File metadata */}
          <div className="px-3 py-2">
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">
                {getFileIcon(file.mimeType, file.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-forest truncate">
                  {file.name}
                </div>
                <div className="text-[10px] text-grid/50 mt-0.5 font-mono">
                  {formatBytes(file.size)} · {formatMimeType(file.mimeType)}
                </div>
              </div>
            </div>

            {/* Actions */}
            {file.url && (
              <div className="flex gap-2 mt-2">
                <a
                  href={file.url}
                  download={file.name}
                  className="flex items-center gap-1 text-[10px] font-mono text-forest border border-forest/30 px-2 py-0.5 hover:bg-forest/5 transition-colors"
                >
                  📥 Download
                </a>
                {!file.mimeType.startsWith("image/") && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-mono text-grid/60 border border-grid/20 px-2 py-0.5 hover:bg-grid/5 transition-colors"
                  >
                    👁 Preview
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Attached message */}
      {message && (
        <p className="text-sm whitespace-pre-wrap text-white leading-relaxed">
          {message}
        </p>
      )}
    </div>
  );
}
