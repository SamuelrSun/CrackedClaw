"use client";

import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { Toast as ToastType } from "@/contexts/toast-context";

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const variantStyles = {
  success: {
    bg: "bg-mint",
    border: "border-[#7AD9A0]",
    icon: CheckCircle,
    iconColor: "text-forest",
  },
  error: {
    bg: "bg-coral",
    border: "border-[#E67854]",
    icon: AlertCircle,
    iconColor: "text-white",
  },
  warning: {
    bg: "bg-gold",
    border: "border-[#D4B44E]",
    icon: AlertTriangle,
    iconColor: "text-forest",
  },
  info: {
    bg: "bg-paper",
    border: "border-forest/30",
    icon: Info,
    iconColor: "text-forest",
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const { variant, title, message, id } = toast;
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  const textColor = variant === "error" ? "text-white" : "text-forest";
  const messageColor = variant === "error" ? "text-white/80" : "text-forest/70";
  const buttonHover = variant === "error" ? "hover:bg-white/10" : "hover:bg-forest/10";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-sm border",
        "animate-slide-in-right",
        "toast-shadow",
        styles.bg,
        styles.border
      )}
      role="alert"
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", styles.iconColor)} />
      
      <div className="flex-1 min-w-0">
        <p className={cn("font-mono text-sm font-medium", textColor)}>
          {title}
        </p>
        {message && (
          <p className={cn("font-mono text-xs mt-1", messageColor)}>
            {message}
          </p>
        )}
      </div>

      <button
        onClick={() => onDismiss(id)}
        className={cn(
          "flex-shrink-0 p-1 rounded-sm transition-colors",
          buttonHover,
          textColor
        )}
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
