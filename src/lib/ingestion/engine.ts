/**
 * Generic Data Ingestion Engine
 *
 * Orchestrates scanning across ANY integration. Native adapters exist for
 * high-value providers (Google, Slack, Notion, GitHub). For messaging providers
 * (WhatsApp, Telegram, iMessage), returns node-based scan instructions.
 * For everything else, the OpenClaw agent is the scanner.
 */

import { INTEGRATIONS } from '@/lib/integrations/registry';

// ── Generic result type ───────────────────────────────────────────────────────

export interface IngestResult {
  provider: string;
  scannedAt: string;
  scope: 'quick' | 'full';
  insights: {
    contacts?: { name: string; frequency: number }[];
    topics?: string[];
    writingStyle?: { tone: string; patterns: string[] };
    schedulePatterns?: {
      busiestDays?: string[];
      avgMeetingsPerWeek?: number;
      commonAttendees?: { email: string; frequency: number }[];
      recurringMeetings?: string[];
    };
    automationOpportunities?: string[];
    /** Free-form context the agent (or native adapter) extracted */
    rawContext?: string;
  };
  metadata: {
    itemsScanned: number;
    timeMs: number;
  };
}

/**
 * Returned when no native adapter exists.
 * The API route passes this to the frontend, which asks the agent to scan.
 */
export interface AgentScanNeeded {
  needsAgentScan: true;
  provider: string;
  capabilities: string[];
  authType: string;
}

/**
 * Returned for messaging providers that require a connected Mac node.
 */
export interface NodeScanNeeded {
  needsNode: true;
  provider: string;
  instructions: string;
  capabilities: string[];
}

// ── Messaging providers that need a node ─────────────────────────────────────

const MESSAGING_PROVIDERS = new Set(['whatsapp', 'telegram', 'imessage']);

// ── Native adapter registry ───────────────────────────────────────────────────

type NativeAdapter = (userId: string, scope: 'quick' | 'full') => Promise<IngestResult>;

const NATIVE_ADAPTERS: Record<string, NativeAdapter> = {};

/** Lazy-load native adapters to avoid circular deps at module init */
async function getNativeAdapter(provider: string): Promise<NativeAdapter | null> {
  if (provider in NATIVE_ADAPTERS) return NATIVE_ADAPTERS[provider];

  try {
    if (provider === 'google') {
      const mod = await import('./providers/google');
      NATIVE_ADAPTERS['google'] = mod.scanGoogle;
      return mod.scanGoogle;
    }
    if (provider === 'slack') {
      const mod = await import('./providers/slack');
      NATIVE_ADAPTERS['slack'] = mod.scanSlack;
      return mod.scanSlack;
    }
    if (provider === 'notion') {
      const mod = await import('./providers/notion');
      NATIVE_ADAPTERS['notion'] = mod.scanNotion;
      return mod.scanNotion;
    }
    if (provider === 'github') {
      const mod = await import('./providers/github');
      NATIVE_ADAPTERS['github'] = mod.scanGitHub;
      return mod.scanGitHub;
    }
  } catch {
    // adapter file missing — fall through
  }

  return null;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run a scoped scan for the given provider.
 *
 * Returns one of:
 *   - IngestResult      — native scan completed successfully
 *   - NodeScanNeeded    — messaging provider that needs a Mac node connection
 *   - AgentScanNeeded   — no native adapter; the agent should scan via browser/exec
 */
export async function runScopedScan(
  userId: string,
  provider: string,
  scope: 'quick' | 'full' = 'full',
): Promise<IngestResult | AgentScanNeeded | NodeScanNeeded> {
  const registration = INTEGRATIONS.find(i => i.id === provider);

  // ── 1. Messaging providers — return node instructions ─────────────────────
  if (MESSAGING_PROVIDERS.has(provider)) {
    const { getMessagingScanInstructions } = await import('./providers/messaging');
    return getMessagingScanInstructions(provider);
  }

  // ── 2. Try native adapter ─────────────────────────────────────────────────
  const nativeAdapter = await getNativeAdapter(provider);
  if (nativeAdapter) {
    return nativeAdapter(userId, scope);
  }

  // ── 3. Maton API — future ─────────────────────────────────────────────────
  if (registration?.hasApi && registration.apiProvider === 'maton') {
    // TODO: route through Maton API when available
    // For now, fall through to agent scan
  }

  // ── 4. No native adapter — signal the agent to scan ───────────────────────
  return {
    needsAgentScan: true,
    provider,
    capabilities: registration?.capabilities ?? [],
    authType: registration?.authType ?? 'unknown',
  };
}

/** Type guards */
export function isAgentScanNeeded(result: IngestResult | AgentScanNeeded | NodeScanNeeded): result is AgentScanNeeded {
  return (result as AgentScanNeeded).needsAgentScan === true;
}

export function isNodeScanNeeded(result: IngestResult | AgentScanNeeded | NodeScanNeeded): result is NodeScanNeeded {
  return (result as NodeScanNeeded).needsNode === true;
}

// ── Legacy export — keep backward compat ─────────────────────────────────────

/** @deprecated Use IngestResult instead */
export interface ScanInsights {
  topics: string[];
  contacts: { name: string; email: string; frequency: number }[];
  writingStyle: {
    tone: string;
    avgLength: number;
    openingPatterns: string[];
    closingPatterns: string[];
  };
  schedulePatterns: {
    busiestDays: string[];
    avgMeetingsPerWeek: number;
    commonAttendees: { email: string; frequency: number }[];
    recurringMeetings: string[];
  };
  automationOpportunities: string[];
  meta: {
    emailsScanned: number;
    eventsScanned: number;
    driveFilesFound: number;
    scannedAt: string;
  };
}
