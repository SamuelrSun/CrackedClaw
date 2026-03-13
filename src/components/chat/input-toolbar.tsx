"use client";

import { cn } from "@/lib/utils";

interface InputToolbarProps {
  onFileUpload?: () => void;
  disabled?: boolean;
  className?: string;
}

export function InputToolbar({ onFileUpload, disabled, className }: InputToolbarProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* File attachment button */}
      <button
        type="button"
        onClick={onFileUpload}
        disabled={disabled}
        title="Attach file"
        className={cn(
          "w-7 h-7 flex items-center justify-center text-grid/40 hover:text-forest",
          "border border-transparent hover:border-[rgba(58,58,56,0.15)] transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed rounded-none bg-transparent"
        )}
      >
        <span className="text-sm">📎</span>
      </button>
    </div>
  );
}
