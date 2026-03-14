"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "flex-shrink-0 w-5 h-5 border rounded-none transition-colors mt-0.5",
          "flex items-center justify-center",
          checked
            ? "bg-forest border-forest"
            : "bg-white border-white/[0.15] hover:border-forest/50",
          disabled && "cursor-not-allowed"
        )}
      >
        {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </button>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <span className="font-mono text-[11px] uppercase tracking-wide text-forest">
              {label}
            </span>
          )}
          {description && (
            <span className="font-mono text-[10px] text-grid/50">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
}
