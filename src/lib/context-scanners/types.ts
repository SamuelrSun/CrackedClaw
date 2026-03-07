/**
 * Context Scanner Types
 * Generic interfaces for all context scanners
 */

// ============================================
// Generic Scanner Types
// ============================================

export type InsightType = 'pattern' | 'contact' | 'task' | 'preference';

export interface Insight {
  type: InsightType;
  content: string;
  confidence: number; // 0-1
  metadata?: Record<string, unknown>;
}

export interface ScannerResult {
  source: string;
  scannedAt: Date;
  summary: string;
  insights: Insight[];
  suggestedAutomations: string[];
  rawData?: unknown; // For debugging
  stats?: {
    itemsScanned: number;
    timeMs: number;
  };
}

export interface ScanOptions {
  daysBack?: number; // Default 20
  maxItems?: number; // Limit API calls
  includeRawData?: boolean; // For debugging
}

export interface Scanner {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requiredScopes?: string[];
  scan(userId: string, accessToken: string, options?: ScanOptions): Promise<ScannerResult>;
}

// ============================================
// Gmail Scanner Types
// ============================================

export interface FrequentContact {
  email: string;
  name: string;
  count: number;
  lastContact: string;
  isRecipient: boolean; // true = you email them, false = they email you
}

export interface EmailPattern {
  type: 'newsletter' | 'receipt' | 'notification' | 'social' | 'promotional' | 'travel' | 'other';
  description: string;
  examples: string[];
  count: number;
  senderDomains: string[];
}

export interface PendingThread {
  threadId: string;
  subject: string;
  from: string;
  lastMessageDate: string;
  waitingFor: 'me' | 'them';
}

export interface GmailScanResult extends ScannerResult {
  source: 'gmail';
  data: {
    frequentContacts: FrequentContact[];
    patterns: EmailPattern[];
    pendingThreads: PendingThread[];
    totalEmails: number;
    unreadCount: number;
  };
}

// ============================================
// Calendar Scanner Types
// ============================================

export interface MeetingType {
  type: string;
  count: number;
  averageDuration: number; // minutes
  examples: string[];
}

export interface RecurringMeeting {
  title: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: string;
  time?: string;
  attendees: string[];
}

export interface FrequentAttendee {
  email: string;
  name: string;
  meetingCount: number;
  lastMeeting: string;
}

export interface BusyTimeAnalysis {
  busiestDay: string;
  busiestHour: number;
  averageMeetingsPerDay: number;
  averageMeetingDuration: number;
  freeTimeBlocks: Array<{
    day: string;
    start: string;
    end: string;
  }>;
}

export interface CalendarScanResult extends ScannerResult {
  source: 'calendar';
  data: {
    meetingTypes: MeetingType[];
    recurringMeetings: RecurringMeeting[];
    frequentAttendees: FrequentAttendee[];
    busyTimeAnalysis: BusyTimeAnalysis;
    upcomingCount: number;
    totalMeetings: number;
  };
}

// ============================================
// Orchestrator Types
// ============================================

export interface WorkflowSuggestion {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  requiredIntegrations: string[];
  confidence: number;
  basedOn: string; // Which insight led to this suggestion
}

export interface ContextGatheringJob {
  id: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  integrations: string[];
  progress: {
    current: number;
    total: number;
    currentScanner?: string;
    message?: string;
  };
  results: ScannerResult[];
  combinedInsights: string[];
  suggestedWorkflows: WorkflowSuggestion[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ContextGatheringResult {
  results: ScannerResult[];
  combinedInsights: string[];
  suggestedWorkflows: WorkflowSuggestion[];
  timeMs: number;
}

// ============================================
// Database Types
// ============================================

export interface UserContextRow {
  id: string;
  user_id: string;
  scan_type: string;
  scan_result: Record<string, unknown>;
  insights: Insight[];
  suggested_automations: string[];
  scanned_at: string;
  created_at: string;
  updated_at: string;
}

export interface ContextJobRow {
  id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  integrations: string[];
  progress: Record<string, unknown>;
  results: Record<string, unknown>[];
  combined_insights: string[];
  suggested_workflows: Record<string, unknown>[];
  started_at: string;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
