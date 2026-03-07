"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { 
  MessageSquare, 
  Brain, 
  GitBranch, 
  Plug,
  ChevronRight 
} from "lucide-react";
import type { SearchResult } from "@/hooks/use-search";

interface SearchResultsProps {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  query: string;
}

const typeConfig = {
  conversation: {
    icon: MessageSquare,
    label: "Conversations",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  memory: {
    icon: Brain,
    label: "Memory",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  workflow: {
    icon: GitBranch,
    label: "Workflows",
    color: "text-mint",
    bgColor: "bg-mint/10",
  },
  integration: {
    icon: Plug,
    label: "Integrations",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
};

// Highlight matching text
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <span>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-mint/30 text-forest px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// Group results by type
function groupResults(results: SearchResult[]) {
  const groups: Record<string, SearchResult[]> = {};
  
  results.forEach((result) => {
    if (!groups[result.type]) {
      groups[result.type] = [];
    }
    groups[result.type].push(result);
  });
  
  return groups;
}

function ResultItem({ 
  result, 
  isSelected, 
  onClick, 
  query,
  itemIndex,
}: { 
  result: SearchResult; 
  isSelected: boolean; 
  onClick: () => void;
  query: string;
  itemIndex: number;
}) {
  const config = typeConfig[result.type];
  const Icon = config.icon;
  
  return (
    <button
      onClick={onClick}
      data-index={itemIndex}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
        "hover:bg-forest/5",
        isSelected && "bg-forest/10"
      )}
    >
      <div className={cn("p-2 rounded-none", config.bgColor)}>
        <Icon className={cn("w-4 h-4", config.color)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-forest truncate">
            <HighlightedText text={result.title} query={query} />
          </span>
          <span className={cn(
            "font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5",
            config.bgColor,
            config.color
          )}>
            {result.type}
          </span>
        </div>
        
        {(result.subtitle || result.snippet) && (
          <p className="font-mono text-xs text-grid/60 truncate mt-0.5">
            <HighlightedText 
              text={result.snippet || result.subtitle || ""} 
              query={query} 
            />
          </p>
        )}
      </div>
      
      <ChevronRight className={cn(
        "w-4 h-4 text-grid/30 transition-colors",
        isSelected && "text-forest"
      )} />
    </button>
  );
}

export const SearchResults = memo(function SearchResults({ 
  results, 
  selectedIndex, 
  onSelect,
  query,
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="font-mono text-sm text-grid/50">
          No results found for &quot;{query}&quot;
        </p>
        <p className="font-mono text-xs text-grid/40 mt-1">
          Try searching for conversations, memory, workflows, or integrations
        </p>
      </div>
    );
  }

  const groups = groupResults(results);
  let globalIndex = 0;
  
  return (
    <div className="py-2">
      {Object.entries(groups).map(([type, items]) => {
        const config = typeConfig[type as keyof typeof typeConfig];
        
        return (
          <div key={type} className="mb-2 last:mb-0">
            <div className="px-4 py-2 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                {config.label}
              </span>
              <span className="font-mono text-[10px] text-grid/40">
                ({items.length})
              </span>
            </div>
            
            {items.map((result) => {
              const itemIndex = globalIndex++;
              return (
                <ResultItem
                  key={result.id}
                  result={result}
                  isSelected={selectedIndex === itemIndex}
                  onClick={() => onSelect(result)}
                  query={query}
                  itemIndex={itemIndex}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});
