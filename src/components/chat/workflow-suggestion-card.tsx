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
  onCustom: () => void;
}

const DEFAULT_WORKFLOWS: WorkflowSuggestion[] = [
  {
    id: "job-tracker",
    title: "🔍 Find and track job listings",
    description:
      "I'll search for relevant jobs on LinkedIn, track them in Google Sheets, and alert you to new postings",
  },
  {
    id: "morning-briefing",
    title: "☀️ Morning briefing",
    description:
      "Get a daily summary of your emails, calendar events, and any updates that need your attention",
  },
  {
    id: "research-summarize",
    title: "📚 Research & summarize",
    description:
      "Give me a topic and I'll research it, compile findings, and create a summary document",
  },
];

export function WorkflowSuggestionCard({
  suggestions,
  onSelect,
}: WorkflowSuggestionCardProps) {
  const displaySuggestions =
    suggestions && suggestions.length > 0
      ? suggestions.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
        }))
      : DEFAULT_WORKFLOWS;

  return (
    <div className="border border-[rgba(58,58,56,0.2)] rounded-none bg-white p-4 max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-forest" />
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          Suggested Workflows
        </span>
      </div>

      <div className="space-y-2">
        {displaySuggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.title)}
            className={cn(
              "w-full text-left p-3 border border-[rgba(58,58,56,0.2)] rounded-none cursor-pointer",
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
    </div>
  );
}
