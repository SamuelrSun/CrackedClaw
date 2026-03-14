"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  label,
  placeholder = "Select...",
  disabled = false,
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="font-mono text-[10px] uppercase tracking-wide text-white/40">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between bg-white/[0.07] backdrop-blur-sm border border-white/[0.15] rounded-none px-3 py-2",
            "font-body text-sm text-white/80",
            "outline-none transition-colors",
            "hover:border-white/[0.3] focus:border-white/[0.4]",
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && "border-white/[0.3]"
          )}
        >
          <span className={cn(!selectedOption && "text-white/25")}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-white/40 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] shadow-2xl shadow-black/50">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 font-mono text-[11px] transition-colors",
                  "hover:bg-white/[0.08]",
                  option.value === value && "bg-white/[0.12] text-white hover:bg-white/[0.15]"
                )}
              >
                <span className="block uppercase tracking-wide text-white/80">{option.label}</span>
                {option.description && (
                  <span
                    className={cn(
                      "block text-[10px] mt-0.5 normal-case tracking-normal",
                      option.value === value ? "text-white/60" : "text-white/40"
                    )}
                  >
                    {option.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
