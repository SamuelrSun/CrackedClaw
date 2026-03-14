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
          "w-7 h-7 flex items-center justify-center text-white/40 hover:text-white/80",
          "border border-transparent hover:border-white/[0.1] transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed rounded-none bg-transparent"
        )}
      >
        <span className="text-sm">📎</span>
      </button>
    </div>
  );
}
