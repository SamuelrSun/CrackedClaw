/**
 * Onboarding Module
 * 
 * Exports all onboarding-related functions for guiding new users through
 * OpenClaw setup.
 */

// State machine functions
export {
  createInitialState,
  isValidTransition,
  getNextPhase,
  transitionPhase,
  advancePhase,
  completeStep,
  skipStep,
  setAgentName,
  setUserDisplayName,
  isWelcomeComplete,
  isIntegrationsComplete,
  isContextGatheringComplete,
  isWorkflowSetupComplete,
  updateGatheredContext,
  setSuggestedWorkflows,
  getRequiredStepsForPhase,
  canAdvanceFromPhase,
  completeOnboarding,
  derailOnboarding,
  getProgressPercentage,
  getConnectedIntegrations,
  generateDefaultWorkflowSuggestions,
  type TransitionResult,
} from './state-machine';

// Agent prompt functions
export {
  getOnboardingPrompt,
  parseOnboardingActions,
  stripOnboardingActions,
  detectSkipIntent,
  detectCompleteIntent,
  extractUserName,
  extractAgentName,
} from './agent-prompt';
