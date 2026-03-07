"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  OnboardingState,
  OnboardingPhase,
  OnboardingStep,
  GatheredContext,
  WorkflowSuggestion,
} from "@/types/onboarding";

interface UseOnboardingChatReturn {
  // State
  onboardingState: OnboardingState | null;
  isLoading: boolean;
  error: string | null;
  isInOnboarding: boolean;
  currentPhase: OnboardingPhase | null;

  // Actions
  updatePhase: (phase: OnboardingPhase) => Promise<void>;
  completeStep: (step: OnboardingStep) => Promise<void>;
  skipStep: (step: OnboardingStep) => Promise<void>;
  setUserName: (name: string) => Promise<void>;
  setAgentName: (name: string) => Promise<void>;
  updateContext: (context: Partial<GatheredContext>) => Promise<void>;
  setWorkflows: (workflows: WorkflowSuggestion[]) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  refreshState: () => Promise<void>;
}

export function useOnboardingChat(): UseOnboardingChatReturn {
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const res = await fetch("/api/onboarding/state");
      const data = await res.json();
      
      if (data.state) {
        setOnboardingState(data.state);
      } else {
        setOnboardingState(null);
      }
    } catch (err) {
      console.error("Failed to fetch onboarding state:", err);
      setError(err instanceof Error ? err.message : "Failed to load onboarding state");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Update onboarding state via API
  const updateState = useCallback(async (updates: Record<string, unknown>) => {
    try {
      setError(null);
      const res = await fetch("/api/onboarding/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to update onboarding state");
      }
      
      if (data.state) {
        setOnboardingState(data.state);
      }
    } catch (err) {
      console.error("Failed to update onboarding state:", err);
      setError(err instanceof Error ? err.message : "Failed to update");
      throw err;
    }
  }, []);

  // Update phase
  const updatePhase = useCallback(async (phase: OnboardingPhase) => {
    await updateState({ phase });
  }, [updateState]);

  // Complete a step
  const completeStep = useCallback(async (step: OnboardingStep) => {
    await updateState({ completed_step: step });
  }, [updateState]);

  // Skip a step
  const skipStep = useCallback(async (step: OnboardingStep) => {
    await updateState({ skipped_step: step });
  }, [updateState]);

  // Set user display name
  const setUserName = useCallback(async (name: string) => {
    await updateState({ user_display_name: name });
  }, [updateState]);

  // Set agent name
  const setAgentName = useCallback(async (name: string) => {
    await updateState({ agent_name: name });
  }, [updateState]);

  // Update gathered context
  const updateContext = useCallback(async (context: Partial<GatheredContext>) => {
    await updateState({ gathered_context: context });
  }, [updateState]);

  // Set suggested workflows
  const setWorkflows = useCallback(async (workflows: WorkflowSuggestion[]) => {
    await updateState({ suggested_workflows: workflows });
  }, [updateState]);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }
      
      // Refresh state
      await fetchState();
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      setError(err instanceof Error ? err.message : "Failed to complete");
      throw err;
    }
  }, [fetchState]);

  // Skip onboarding entirely
  const skipOnboarding = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/onboarding/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip_all: true }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to skip onboarding");
      }
      
      // Refresh state
      await fetchState();
    } catch (err) {
      console.error("Failed to skip onboarding:", err);
      setError(err instanceof Error ? err.message : "Failed to skip");
      throw err;
    }
  }, [fetchState]);

  // Derived state
  const isInOnboarding = onboardingState !== null && 
    onboardingState.phase !== "complete";
  
  const currentPhase = onboardingState?.phase || null;

  return {
    onboardingState,
    isLoading,
    error,
    isInOnboarding,
    currentPhase,
    updatePhase,
    completeStep,
    skipStep,
    setUserName,
    setAgentName,
    updateContext,
    setWorkflows,
    completeOnboarding,
    skipOnboarding,
    refreshState: fetchState,
  };
}
