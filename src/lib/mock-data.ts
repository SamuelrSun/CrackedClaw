import type { Integration, IntegrationAccount } from "@/types/integration";

// ============================================
// TYPE DEFINITIONS (keep these)
// ============================================

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "pending";
  lastRun: string;
  icon: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
}

export interface TokenUsage {
  used: number;
  limit: number;
  resetDate: string;
}

export interface UsageStats {
  totalWorkflowRuns: number;
  totalMessages: number;
  tokensUsedToday: number;
  activeIntegrations: number;
}

// ============================================
// DEFAULT EMPTY DATA (no more hardcoded mock)
// ============================================

export const workflows: Workflow[] = [];
export const integrations: Integration[] = [];
export const conversations: Conversation[] = [];
export const messages: Message[] = [];
export const memoryEntries: MemoryEntry[] = [];
export const activityLog: ActivityItem[] = [];
export const teamMembers: TeamMember[] = [];

export const tokenUsage: TokenUsage = {
  used: 0,
  limit: 1_000_000,
  resetDate: "—",
};

export const usageStats: UsageStats = {
  totalWorkflowRuns: 0,
  totalMessages: 0,
  tokensUsedToday: 0,
  activeIntegrations: 0,
};

// Re-export the Integration types for backwards compatibility
export type { Integration, IntegrationAccount };
