/**
 * Onboarding State Machine
 * Manages phase transitions and step tracking for the onboarding flow
 */

import type {
  OnboardingState,
  OnboardingPhase,
  OnboardingStep,
  GatheredContext,
  WorkflowSuggestion,
} from '@/types/onboarding';
import { phaseOrder } from '@/types/onboarding';

// Transition result
export interface TransitionResult {
  success: boolean;
  newState: OnboardingState;
  error?: string;
}

// Create initial onboarding state
export function createInitialState(userId: string): Omit<OnboardingState, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    phase: 'welcome',
    completed_steps: [],
    skipped_steps: [],
    gathered_context: {},
    suggested_workflows: [],
    agent_name: null,
    user_display_name: null,
  };
}

// Check if a phase transition is valid
export function isValidTransition(from: OnboardingPhase, to: OnboardingPhase): boolean {
  // Allow transition to same phase (no-op)
  if (from === to) return true;
  
  // Always allow transition to 'complete' or 'derailed'
  if (to === 'complete' || to === 'derailed') return true;
  
  // Check sequential order for normal phases
  const fromIndex = phaseOrder.indexOf(from);
  const toIndex = phaseOrder.indexOf(to);
  
  // Allow forward progression
  if (toIndex > fromIndex) return true;
  
  // Allow going back (e.g., from derailed back to a phase)
  if (from === 'derailed') return true;
  
  return false;
}

// Get the next phase in the sequence
export function getNextPhase(current: OnboardingPhase): OnboardingPhase | null {
  const currentIndex = phaseOrder.indexOf(current);
  if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
    return null;
  }
  return phaseOrder[currentIndex + 1];
}

// Transition to a new phase
export function transitionPhase(
  state: OnboardingState,
  targetPhase: OnboardingPhase
): TransitionResult {
  if (!isValidTransition(state.phase, targetPhase)) {
    return {
      success: false,
      newState: state,
      error: `Invalid transition from ${state.phase} to ${targetPhase}`,
    };
  }

  return {
    success: true,
    newState: {
      ...state,
      phase: targetPhase,
      updated_at: new Date().toISOString(),
    },
  };
}

// Advance to the next phase
export function advancePhase(state: OnboardingState): TransitionResult {
  const nextPhase = getNextPhase(state.phase);
  
  if (!nextPhase) {
    return {
      success: false,
      newState: state,
      error: 'Already at final phase',
    };
  }

  return transitionPhase(state, nextPhase);
}

// Mark a step as completed
export function completeStep(
  state: OnboardingState,
  step: OnboardingStep
): OnboardingState {
  if (state.completed_steps.includes(step)) {
    return state;
  }

  return {
    ...state,
    completed_steps: [...state.completed_steps, step],
    // Remove from skipped if it was previously skipped
    skipped_steps: state.skipped_steps.filter((s) => s !== step),
    updated_at: new Date().toISOString(),
  };
}

// Mark a step as skipped
export function skipStep(
  state: OnboardingState,
  step: OnboardingStep
): OnboardingState {
  if (state.skipped_steps.includes(step)) {
    return state;
  }

  return {
    ...state,
    skipped_steps: [...state.skipped_steps, step],
    // Remove from completed if it was previously completed
    completed_steps: state.completed_steps.filter((s) => s !== step),
    updated_at: new Date().toISOString(),
  };
}

// Update agent name
export function setAgentName(
  state: OnboardingState,
  agentName: string
): OnboardingState {
  return {
    ...completeStep(state, 'agent_name_provided'),
    agent_name: agentName,
  };
}

// Update user display name
export function setUserDisplayName(
  state: OnboardingState,
  displayName: string
): OnboardingState {
  return {
    ...completeStep(state, 'user_name_provided'),
    user_display_name: displayName,
  };
}

// Check if welcome phase is complete
export function isWelcomeComplete(state: OnboardingState): boolean {
  return (
    state.completed_steps.includes('user_name_provided') &&
    state.completed_steps.includes('agent_name_provided')
  );
}

// Check if integrations phase is complete (or skipped)
export function isIntegrationsComplete(state: OnboardingState): boolean {
  // Complete if skipped OR at least one integration connected
  if (state.skipped_steps.includes('integrations_skipped')) {
    return true;
  }
  return (
    state.completed_steps.includes('integration_google') ||
    state.completed_steps.includes('integration_slack') ||
    state.completed_steps.includes('integration_notion')
  );
}

// Check if context gathering is complete (or skipped)
export function isContextGatheringComplete(state: OnboardingState): boolean {
  return (
    state.skipped_steps.includes('context_skipped') ||
    state.completed_steps.includes('context_scan_completed')
  );
}

// Check if workflow setup is complete (or skipped)
export function isWorkflowSetupComplete(state: OnboardingState): boolean {
  return (
    state.skipped_steps.includes('workflow_skipped') ||
    state.completed_steps.includes('workflow_created')
  );
}

// Update gathered context
export function updateGatheredContext(
  state: OnboardingState,
  context: Partial<GatheredContext>
): OnboardingState {
  return {
    ...state,
    gathered_context: {
      ...state.gathered_context,
      ...context,
    },
    updated_at: new Date().toISOString(),
  };
}

// Set suggested workflows
export function setSuggestedWorkflows(
  state: OnboardingState,
  workflows: WorkflowSuggestion[]
): OnboardingState {
  return {
    ...completeStep(state, 'workflow_suggested'),
    suggested_workflows: workflows,
  };
}

// Get steps required to complete current phase
export function getRequiredStepsForPhase(phase: OnboardingPhase): OnboardingStep[] {
  switch (phase) {
    case 'welcome':
      return ['user_name_provided', 'agent_name_provided'];
    case 'integrations':
      return []; // No required steps, can skip
    case 'context_gathering':
      return []; // No required steps, can skip
    case 'workflow_setup':
      return []; // No required steps, can skip
    default:
      return [];
  }
}

// Check if current phase can be completed
export function canAdvanceFromPhase(state: OnboardingState): boolean {
  switch (state.phase) {
    case 'welcome':
      return isWelcomeComplete(state);
    case 'integrations':
      return true; // Can always advance (skip or connect)
    case 'context_gathering':
      return true; // Can always advance (skip or complete scan)
    case 'workflow_setup':
      return true; // Can always advance (skip or create workflow)
    case 'complete':
      return false; // Already done
    case 'derailed':
      return true; // Can resume
    default:
      return false;
  }
}

// Mark onboarding as complete
export function completeOnboarding(state: OnboardingState): OnboardingState {
  return {
    ...state,
    phase: 'complete',
    updated_at: new Date().toISOString(),
  };
}

// Mark onboarding as derailed (user went off-track)
export function derailOnboarding(state: OnboardingState): OnboardingState {
  return {
    ...state,
    phase: 'derailed',
    updated_at: new Date().toISOString(),
  };
}

// Get progress percentage
export function getProgressPercentage(state: OnboardingState): number {
  const currentIndex = phaseOrder.indexOf(state.phase);
  if (currentIndex === -1) return 0;
  if (state.phase === 'complete') return 100;
  
  // Each phase is roughly 25%
  const phaseProgress = (currentIndex / (phaseOrder.length - 1)) * 100;
  return Math.round(phaseProgress);
}

// Determine which integrations are connected
export function getConnectedIntegrations(state: OnboardingState): string[] {
  const integrations: string[] = [];
  if (state.completed_steps.includes('integration_google')) integrations.push('google');
  if (state.completed_steps.includes('integration_slack')) integrations.push('slack');
  if (state.completed_steps.includes('integration_notion')) integrations.push('notion');
  return integrations;
}

// Generate workflow suggestions based on connected integrations
export function generateDefaultWorkflowSuggestions(
  connectedIntegrations: string[],
  context: GatheredContext
): WorkflowSuggestion[] {
  const suggestions: WorkflowSuggestion[] = [];

  if (connectedIntegrations.includes('google')) {
    suggestions.push({
      id: 'email-summary',
      name: 'Daily Email Summary',
      description: 'Get a morning digest of important emails',
      trigger: 'Every morning at 9 AM',
      actions: ['Scan recent emails', 'Summarize key messages', 'Send digest'],
      requiredIntegrations: ['google'],
      confidence: 0.9,
    });

    suggestions.push({
      id: 'meeting-prep',
      name: 'Meeting Preparation',
      description: 'Get context before meetings',
      trigger: '15 minutes before calendar events',
      actions: ['Find related emails', 'Summarize context', 'Send briefing'],
      requiredIntegrations: ['google'],
      confidence: 0.85,
    });
  }

  if (connectedIntegrations.includes('slack')) {
    suggestions.push({
      id: 'slack-summary',
      name: 'Slack Catch-up',
      description: 'Summarize missed messages',
      trigger: 'On demand or morning',
      actions: ['Scan channels', 'Identify important threads', 'Create summary'],
      requiredIntegrations: ['slack'],
      confidence: 0.8,
    });
  }

  if (connectedIntegrations.includes('notion')) {
    suggestions.push({
      id: 'note-organizer',
      name: 'Note Organization',
      description: 'Automatically organize and tag notes',
      trigger: 'When new notes are created',
      actions: ['Analyze content', 'Add tags', 'Suggest connections'],
      requiredIntegrations: ['notion'],
      confidence: 0.75,
    });
  }

  // Add context-based suggestions
  if (context.calendar?.meetingFrequency === 'high') {
    suggestions.push({
      id: 'focus-time',
      name: 'Focus Time Protector',
      description: 'Block time for deep work between meetings',
      trigger: 'Weekly on Sunday',
      actions: ['Analyze calendar', 'Find gaps', 'Block focus time'],
      requiredIntegrations: ['google'],
      confidence: 0.7,
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
