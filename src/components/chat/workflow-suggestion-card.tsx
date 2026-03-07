"use client";

import { cn } from "@/lib/utils";
import { Sparkles, PenLine } from "lucide-react";

interface WorkflowSuggestion {
  id: string;
  title: string;
  description: string;
}

interface WorkflowSuggestionCardProps {
  suggestions: WorkflowSuggestion[];
  onSelect: (id: string) => void;
  onCustom: () => void;
}

export function WorkflowSuggestionCard({
  suggestions,
  onSelect,
  onCustom,
}: WorkflowSuggestionCardProps) {
  return (
    <div className="border border-[rgba(58,58,56,0.2)] rounded-none bg-white p-4 max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-forest" />
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          Suggested Workflows
        </span>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.id)}
            className={cn(
              "w-full text-left p-3 border border-[rgba(58,58,56,0.2)] rounded-none",
              "hover:border-forest hover:bg-forest/[0.02] transition-colors",
              "group"
            )}
          >
            <h4 className="text-sm font-medium text-forest group-hover:text-forest">
              {suggestion.title}
            </h4>
            <p className="text-xs text-grid/60 mt-0.5">{suggestion.description}</p>
          </button>
        ))}
      </div>

      <button
        onClick={onCustom}
        className={cn(
          "w-full mt-3 py-2 px-3 flex items-center justify-center gap-2",
          "border border-dashed border-[rgba(58,58,56,0.3)] rounded-none",
          "text-grid/60 hover:text-forest hover:border-forest transition-colors",
          "font-mono text-[10px] uppercase tracking-wide"
        )}
      >
        <PenLine className="w-3 h-3" />
        Or describe your own...
      </button>
    </div>
  );
}
