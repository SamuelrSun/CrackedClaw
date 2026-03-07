/**
 * Onboarding Types for OpenClaw Cloud
 * Manages the user onboarding flow through phases with state tracking
 */

// Onboarding phases in order
export type OnboardingPhase = 
  | 'welcome' 
  | 'integrations' 
  | 'context_gathering' 
  | 'workflow_setup' 
  | 'complete' 
  | 'derailed';

// Steps within each phase that can be completed or skipped
export type OnboardingStep = 
  // Welcome phase
  | 'user_name_provided'
  | 'agent_name_provided'
  // Integrations phase
  | 'integration_google'
  | 'integration_slack'
  | 'integration_notion'
  | 'integrations_skipped'
  // Context gathering phase
  | 'context_scan_started'
  | 'context_scan_completed'
  | 'context_skipped'
  // Workflow setup phase
  | 'workflow_suggested'
  | 'workflow_created'
  | 'workflow_skipped';

// Workflow suggestion from context analysis
export interface WorkflowSuggestion {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  requiredIntegrations: string[];
  confidence: number; // 0-1 how confident we are this is useful
}

// Context gathered from integrations
export interface GatheredContext {
  email?: {
    commonContacts: string[];
    frequentTopics: string[];
    meetingPatterns: string[];
  };
  calendar?: {
    workingHours: string;
    meetingFrequency: string;
    commonMeetingTypes: string[];
  };
  drive?: {
    recentProjects: string[];
    fileTypes: string[];
  };
  summary?: string;
  scannedAt?: string;
}

// Main onboarding state interface
export interface OnboardingState {
  id: string;
  user_id: string;
  phase: OnboardingPhase;
  completed_steps: OnboardingStep[];
  skipped_steps: OnboardingStep[];
  gathered_context: GatheredContext;
  suggested_workflows: WorkflowSuggestion[];
  agent_name: string | null;
  user_display_name: string | null;
  created_at: string;
  updated_at: string;
}

// Database row type (as stored in Supabase)
export interface OnboardingStateRow {
  id: string;
  user_id: string;
  phase: OnboardingPhase;
  completed_steps: string[];
  skipped_steps: string[];
  gathered_context: Record<string, unknown>;
  suggested_workflows: Record<string, unknown>[];
  agent_name: string | null;
  user_display_name: string | null;
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface StartOnboardingRequest {
  user_id?: string; // Optional, will use authenticated user if not provided
}

export interface StartOnboardingResponse {
  success: boolean;
  state: OnboardingState;
  isNew: boolean;
}

export interface UpdateOnboardingRequest {
  phase?: OnboardingPhase;
  completed_step?: OnboardingStep;
  skipped_step?: OnboardingStep;
  agent_name?: string;
  user_display_name?: string;
  gathered_context?: Partial<GatheredContext>;
  suggested_workflows?: WorkflowSuggestion[];
}

export interface SkipOnboardingRequest {
  skip_to?: OnboardingPhase; // Skip to a specific phase
  skip_all?: boolean;        // Skip to complete
}

// Special syntax output types for the frontend to parse
export interface OnboardingAction {
  type: 'integration' | 'welcome' | 'subagent' | 'context' | 'workflow' | 'action';
  payload: string;
}

// Convert DB row to OnboardingState
export function toOnboardingState(row: OnboardingStateRow): OnboardingState {
  return {
    id: row.id,
    user_id: row.user_id,
    phase: row.phase,
    completed_steps: row.completed_steps as OnboardingStep[],
    skipped_steps: row.skipped_steps as OnboardingStep[],
    gathered_context: row.gathered_context as GatheredContext,
    suggested_workflows: (row.suggested_workflows || []) as unknown as WorkflowSuggestion[],
    agent_name: row.agent_name,
    user_display_name: row.user_display_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Helper to check if a step is completed
export function isStepCompleted(state: OnboardingState, step: OnboardingStep): boolean {
  return state.completed_steps.includes(step);
}

// Helper to check if a step was skipped
export function isStepSkipped(state: OnboardingState, step: OnboardingStep): boolean {
  return state.skipped_steps.includes(step);
}

// Phase display info
export const phaseInfo: Record<OnboardingPhase, { label: string; description: string; icon: string }> = {
  welcome: { 
    label: 'Welcome', 
    description: 'Get to know each other',
    icon: '👋'
  },
  integrations: { 
    label: 'Integrations', 
    description: 'Connect your tools',
    icon: '🔗'
  },
  context_gathering: { 
    label: 'Context', 
    description: 'Learn about your work',
    icon: '🔍'
  },
  workflow_setup: { 
    label: 'Workflows', 
    description: 'Set up automations',
    icon: '⚡'
  },
  complete: { 
    label: 'Complete', 
    description: 'Ready to go!',
    icon: '✅'
  },
  derailed: { 
    label: 'Paused', 
    description: 'Onboarding paused',
    icon: '⏸️'
  },
};

// Phase order for progression
export const phaseOrder: OnboardingPhase[] = [
  'welcome',
  'integrations',
  'context_gathering',
  'workflow_setup',
  'complete',
];
