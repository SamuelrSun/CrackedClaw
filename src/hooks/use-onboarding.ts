"use client";

import { useState, useEffect, useCallback } from "react";

export type OnboardingStep = "welcome" | "connect" | "integrations" | "complete";

interface OnboardingState {
  currentStep: OnboardingStep;
  gatewayConnected: boolean;
  selectedIntegrations: string[];
  completedAt: string | null;
}

const STORAGE_KEY = "openclaw_onboarding_state";

const DEFAULT_STATE: OnboardingState = {
  currentStep: "welcome",
  gatewayConnected: false,
  selectedIntegrations: [],
  completedAt: null,
};

const STEPS: OnboardingStep[] = ["welcome", "connect", "integrations", "complete"];

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingState;
        setState(parsed);
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  // Persist state to localStorage
  const persistState = useCallback((newState: OnboardingState) => {
    setState(newState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Get current step index
  const currentStepIndex = STEPS.indexOf(state.currentStep);

  // Navigation helpers
  const goToStep = useCallback(
    (step: OnboardingStep) => {
      persistState({ ...state, currentStep: step });
    },
    [state, persistState]
  );

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      // Skip integrations step if gateway not connected
      const nextStepName = STEPS[nextIndex];
      if (nextStepName === "integrations" && !state.gatewayConnected) {
        goToStep("complete");
      } else {
        goToStep(STEPS[nextIndex]);
      }
    }
  }, [currentStepIndex, state.gatewayConnected, goToStep]);

  const prevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(STEPS[prevIndex]);
    }
  }, [currentStepIndex, goToStep]);

  // Set gateway connection status
  const setGatewayConnected = useCallback(
    (connected: boolean) => {
      persistState({ ...state, gatewayConnected: connected });
    },
    [state, persistState]
  );

  // Set selected integrations
  const setSelectedIntegrations = useCallback(
    (integrations: string[]) => {
      persistState({ ...state, selectedIntegrations: integrations });
    },
    [state, persistState]
  );

  // Toggle an integration
  const toggleIntegration = useCallback(
    (integrationId: string) => {
      const newSelected = state.selectedIntegrations.includes(integrationId)
        ? state.selectedIntegrations.filter((id) => id !== integrationId)
        : [...state.selectedIntegrations, integrationId];
      persistState({ ...state, selectedIntegrations: newSelected });
    },
    [state, persistState]
  );

  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    const completedAt = new Date().toISOString();
    persistState({ ...state, completedAt });
    return completedAt;
  }, [state, persistState]);

  // Check if onboarding is complete
  const isComplete = state.completedAt !== null;

  // Reset onboarding (for testing)
  const reset = useCallback(() => {
    persistState(DEFAULT_STATE);
  }, [persistState]);

  return {
    // State
    currentStep: state.currentStep,
    currentStepIndex,
    totalSteps: STEPS.length,
    gatewayConnected: state.gatewayConnected,
    selectedIntegrations: state.selectedIntegrations,
    isComplete,
    isLoaded,

    // Actions
    goToStep,
    nextStep,
    prevStep,
    setGatewayConnected,
    setSelectedIntegrations,
    toggleIntegration,
    completeOnboarding,
    reset,
  };
}
