"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface WorkflowSuggestion {
  id: string;
  title: string;
  description: string;
}

interface WorkflowSuggestionCardProps {
  suggestions: WorkflowSuggestion[];
  onSelect: (title: string) => void;
  onCustom?: () => void;
}

export function WorkflowSuggestionCard({
  suggestions,
  onSelect,
}: WorkflowSuggestionCardProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="border border-white/[0.1] rounded-none bg-white p-4 max-w-md">
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
            onClick={() => onSelect(suggestion.title)}
            className={cn(
              "w-full text-left p-3 border border-white/[0.1] rounded-none cursor-pointer",
              "hover:border-forest hover:bg-forest/[0.02] transition-colors",
              "group"
            )}
          >
            <h4 className="text-sm font-medium text-forest group-hover:text-forest">
              {suggestion.title}
            </h4>
            {suggestion.description && (
              <p className="text-xs text-grid/60 mt-0.5">{suggestion.description}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
