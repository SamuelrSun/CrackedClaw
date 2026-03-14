"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface UseSystemPromptReturn {
  systemPrompt: string | null;
  refreshPrompt: () => void;
  isLoading: boolean;
}

export function useSystemPrompt(): UseSystemPromptReturn {
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const promptRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const fetchPrompt = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/gateway/system-prompt");
      if (!res.ok) {
        console.warn("[useSystemPrompt] Failed to fetch system prompt:", res.status);
        return;
      }
      const data = await res.json() as { prompt: string; timestamp: number };
      if (mountedRef.current) {
        promptRef.current = data.prompt;
        setSystemPrompt(data.prompt);
      }
    } catch (err) {
      console.warn("[useSystemPrompt] Error fetching system prompt:", err);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  // Fetch on mount + auto-refresh every 5 minutes
  useEffect(() => {
    mountedRef.current = true;
    fetchPrompt();

    const interval = setInterval(() => {
      if (mountedRef.current) fetchPrompt();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchPrompt]);

  return { systemPrompt, refreshPrompt: fetchPrompt, isLoading };
}
