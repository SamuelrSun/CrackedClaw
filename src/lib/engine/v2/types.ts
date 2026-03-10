/**
 * Scan Engine v2 — Types
 * Single-prompt per integration, parallel subagents, synthesis layer
 */

// Generic raw data from any integration
export interface IntegrationRawData {
  provider: string;
  accountLabel: string; // e.g. "srwang@usc.edu" or "Sam Wang's Slack"
  sections: DataSection[];
  fetchedAt: string;
}

export interface DataSection {
  name: string; // e.g. "sent_emails", "calendar_events", "drive_files", "channels"
  description: string;
  items: DataItem[];
  totalAvailable: number; // how many existed vs how many we fetched
}

export interface DataItem {
  title: string;
  subtitle?: string;
  date?: string;
  body?: string; // optional full text (trimmed)
  metadata?: Record<string, unknown>;
}

// What Claude returns from a scan
export interface ScanMemory {
  content: string;
  page_path: string; // Claude decides: "google-workspace/gmail/contacts/john-smith"
  importance: number; // 0-1
  category: string; // "contact", "project", "pattern", "preference", "insight"
}

// Progress events streamed to UI
export interface ScanProgressEvent {
  phase: 'fetching' | 'analyzing' | 'synthesizing' | 'storing' | 'complete' | 'error';
  provider?: string;
  progress: number; // 0-100
  message: string; // Short status
  log?: string; // Rich markdown for activity panel
}

export type ScanProgressCallback = (event: ScanProgressEvent) => void;

// Per-integration scan result
export interface IntegrationScanResult {
  provider: string;
  accountLabel: string;
  memoriesCreated: number;
  memories: ScanMemory[];
  durationMs: number;
  error?: string;
}

// Synthesis result (cross-integration)
export interface SynthesisResult {
  crossIntegrationInsights: ScanMemory[];
  workflowSuggestions: WorkflowSuggestion[];
  userProfile: string; // markdown summary
  memoriesCreated: number;
}

export interface WorkflowSuggestion {
  name: string;
  description: string;
  trigger: string;
  integrations: string[]; // which integrations are involved
  estimatedTimeSaved: string;
  priority: 'high' | 'medium' | 'low';
}

// Full scan result
export interface ScanResult {
  integrationResults: IntegrationScanResult[];
  synthesis?: SynthesisResult;
  totalMemories: number;
  totalDurationMs: number;
  scanId: string;
}

// Scan mode
export type ScanMode = 'quick' | 'deep';

// Fetcher interface — each integration implements this
export interface IntegrationFetcher {
  provider: string;
  fetch(userId: string, mode: ScanMode, onProgress?: ScanProgressCallback): Promise<IntegrationRawData>;
}
