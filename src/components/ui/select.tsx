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
        <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between bg-white border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-2",
            "font-body text-sm text-forest",
            "outline-none transition-colors",
            "hover:border-forest focus:border-forest",
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && "border-forest"
          )}
        >
          <span className={cn(!selectedOption && "text-grid/30")}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-grid/50 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-paper border border-forest shadow-lg">
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
                  "hover:bg-forest/5",
                  option.value === value && "bg-forest text-white hover:bg-forest"
                )}
              >
                <span className="block uppercase tracking-wide">{option.label}</span>
                {option.description && (
                  <span
                    className={cn(
                      "block text-[10px] mt-0.5 normal-case tracking-normal",
                      option.value === value ? "text-white/70" : "text-grid/50"
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
