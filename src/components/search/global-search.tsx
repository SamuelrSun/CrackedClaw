"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, X, Clock, Command } from "lucide-react";
import { useSearchContext } from "@/contexts/search-context";
import { useSearch, SearchResult } from "@/hooks/use-search";
import { SearchResults } from "./search-results";

export function GlobalSearch() {
  const router = useRouter();
  const { isOpen, closeSearch } = useSearchContext();
  const { 
    query, 
    setQuery, 
    results, 
    isLoading, 
    recentSearches, 
    clearRecent,
    search,
    reset,
  } = useSearch();
  
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      reset();
      setSelectedIndex(-1);
    }
  }, [isOpen, reset]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      debounceRef.current = setTimeout(() => {
        search(query);
      }, 300);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  // Handle result selection
  const handleSelect = useCallback((result: SearchResult) => {
    closeSearch();
    router.push(result.url);
  }, [closeSearch, router]);

  // Handle recent search click
  const handleRecentClick = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
  }, [setQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalResults = results.length;

    switch (e.key) {
      case "Escape":
        closeSearch();
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < totalResults - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : totalResults - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < totalResults) {
          handleSelect(results[selectedIndex]);
        }
        break;
    }
  }, [closeSearch, results, selectedIndex, handleSelect]);

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeSearch();
    }
  }, [closeSearch]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className="w-full max-w-[600px] mx-4 bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.1]">
          <Search className={cn(
            "w-5 h-5 flex-shrink-0",
            isLoading ? "text-mint animate-pulse" : "text-white/40"
          )} />
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations, memory, workflows..."
            className="flex-1 bg-transparent font-mono text-sm text-white/80 placeholder:text-white/30 outline-none"
          />
          
          {query && (
            <button 
              onClick={() => setQuery("")}
              className="p-1 hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4 text-white/40" />
            </button>
          )}
          
          <div className="flex items-center gap-1 text-white/30">
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.1]">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results or Recent Searches */}
        <div className="max-h-[400px] overflow-y-auto">
          {query ? (
            isLoading ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-mint/30 border-t-mint animate-spin" />
                <p className="font-mono text-xs text-white/40 mt-2">Searching...</p>
              </div>
            ) : (
              <SearchResults
                results={results}
                selectedIndex={selectedIndex}
                onSelect={handleSelect}
                query={query}
              />
            )
          ) : (
            // Recent Searches
            <div className="py-2">
              {recentSearches.length > 0 ? (
                <>
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
                      Recent Searches
                    </span>
                    <button 
                      onClick={clearRecent}
                      className="font-mono text-[10px] text-white/30 hover:text-white/80 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  
                  {recentSearches.map((recent, i) => (
                    <button
                      key={i}
                      onClick={() => handleRecentClick(recent)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.08] transition-colors"
                    >
                      <Clock className="w-4 h-4 text-white/30" />
                      <span className="font-mono text-sm text-white/60">{recent}</span>
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="font-mono text-sm text-white/40">
                    Start typing to search
                  </p>
                  <p className="font-mono text-xs text-white/30 mt-1">
                    Search across conversations, memory, workflows, and integrations
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-[9px] px-1 py-0.5 bg-white/[0.06] border border-white/[0.1]">↑</kbd>
              <kbd className="font-mono text-[9px] px-1 py-0.5 bg-white/[0.06] border border-white/[0.1]">↓</kbd>
              <span className="font-mono text-[9px] text-white/30">to navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-[9px] px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.1]">↵</kbd>
              <span className="font-mono text-[9px] text-white/30">to select</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Command className="w-3 h-3 text-white/30" />
            <span className="font-mono text-[9px] text-white/30">K to toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
