"use client";

import { useEffect } from "react";
import { useSearchContext } from "@/contexts/search-context";

export function KeyboardShortcuts() {
  const { toggleSearch } = useSearchContext();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K to toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleSearch();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleSearch]);

  // This component renders nothing, just handles keyboard events
  return null;
}
