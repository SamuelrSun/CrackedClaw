"use client";

import { useContext } from "react";
import { ToastContext } from "@/contexts/toast-context";

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const { addToast, removeToast, toasts } = context;

  return {
    toasts,
    removeToast,
    success: (title: string, message?: string) =>
      addToast({ variant: "success", title, message }),
    error: (title: string, message?: string) =>
      addToast({ variant: "error", title, message }),
    warning: (title: string, message?: string) =>
      addToast({ variant: "warning", title, message }),
    info: (title: string, message?: string) =>
      addToast({ variant: "info", title, message }),
  };
}
