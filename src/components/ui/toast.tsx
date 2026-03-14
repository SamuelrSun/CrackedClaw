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
    bg: "bg-mint/10 backdrop-blur-md",
    border: "border-mint/30",
    icon: CheckCircle,
    iconColor: "text-mint",
  },
  error: {
    bg: "bg-coral/10 backdrop-blur-md",
    border: "border-coral/30",
    icon: AlertCircle,
    iconColor: "text-coral",
  },
  warning: {
    bg: "bg-gold/10 backdrop-blur-md",
    border: "border-gold/30",
    icon: AlertTriangle,
    iconColor: "text-gold",
  },
  info: {
    bg: "bg-white/[0.08] backdrop-blur-md",
    border: "border-white/[0.15]",
    icon: Info,
    iconColor: "text-white/60",
  },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const { variant, title, message, id } = toast;
  const styles = variantStyles[variant];
  const Icon = styles.icon;

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
        <p className="font-mono text-sm font-medium text-white/90">
          {title}
        </p>
        {message && (
          <p className="font-mono text-xs mt-1 text-white/50">
            {message}
          </p>
        )}
      </div>

      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 p-1 rounded-sm transition-colors hover:bg-white/[0.1] text-white/40 hover:text-white/80"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
