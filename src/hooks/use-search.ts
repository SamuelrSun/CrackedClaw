"use client";

import { useState, useCallback, useEffect } from "react";

export interface SearchResult {
  id: string;
  type: "conversation" | "memory" | "workflow" | "integration";
  title: string;
  subtitle?: string;
  snippet?: string;
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

const RECENT_SEARCHES_KEY = "openclaw-recent-searches";
const MAX_RECENT_SEARCHES = 5;

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        try {
          setRecentSearches(JSON.parse(stored));
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== searchQuery.toLowerCase());
      const updated = [searchQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      
      if (typeof window !== "undefined") {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      }
      
      return updated;
    });
  }, []);

  // Clear recent searches
  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    }
  }, []);

  // Perform search
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      
      if (res.ok) {
        const data: SearchResponse = await res.json();
        setResults(data.results);
        saveRecentSearch(searchQuery);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [saveRecentSearch]);

  // Update query and trigger search
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  // Reset search state
  const reset = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsLoading(false);
  }, []);

  return {
    query,
    setQuery: updateQuery,
    results,
    isLoading,
    recentSearches,
    clearRecent,
    search,
    reset,
  };
}
