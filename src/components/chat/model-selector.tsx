"use client";

import { cn } from "@/lib/utils";

export type ModelLevel = "haiku" | "sonnet" | "opus";

interface ModelSelectorProps {
  value: ModelLevel | string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const MODEL_OPTIONS: { value: ModelLevel; label: string; description: string }[] = [
  { value: "haiku", label: "Haiku", description: "Fast & efficient" },
  { value: "sonnet", label: "Sonnet", description: "Balanced" },
  { value: "opus", label: "Opus", description: "Most capable" },
];

export function ModelSelector({ value, onChange, disabled, className }: ModelSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        if (typeof window !== "undefined") {
          localStorage.setItem("dopl-model-level", e.target.value);
        }
      }}
      disabled={disabled}
      title="Select model"
      className={cn(
        "font-mono text-[10px] uppercase tracking-wide text-white/50 bg-transparent border border-white/[0.1]",
        "px-1.5 py-1 outline-none cursor-pointer hover:border-white/[0.3] hover:text-white/80 transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed appearance-none rounded-none",
        className
      )}
    >
      {MODEL_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#0a0a0f] text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
