"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes, useEffect, useCallback } from "react";

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  ...props
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        className={cn(
          "relative bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] rounded-none",
          "w-full max-w-[500px] mx-4 p-6",
          "shadow-2xl shadow-black/50",
          className
        )}
        {...props}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.1]">
            <h2 className="font-header text-lg font-bold tracking-tight text-white/90">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4L12 12M12 4L4 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        {children}
      </div>
    </div>
  );
}
