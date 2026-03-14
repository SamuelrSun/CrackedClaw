"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Toggle({ checked, onChange, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center border border-white/[0.1] rounded-sm transition-colors",
        checked ? "bg-forest" : "bg-white/[0.08]",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-3 w-3 transform transition-transform rounded-none",
          checked ? "translate-x-[18px] bg-white" : "translate-x-[3px] bg-grid/40"
        )}
      />
    </button>
  );
}
