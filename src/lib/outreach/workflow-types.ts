export type WorkflowType = 'discovery' | 'enrichment' | 'outreach' | 'custom';

export interface WorkflowStep {
  order: number;
  description: string;        // "Search Google Maps for property managers"
  tool: string;               // "google_maps" | "linkedin" | "email" | "web_search" | "manual" | "other"
  parameters: Record<string, string>;  // e.g. { query: "property managers SF", filter: "rating > 4" }
}

export interface Workflow {
  id: string;
  campaign_id: string;
  name: string;               // "Lead Discovery" | "Enrichment" | "Initial Outreach"
  type: WorkflowType;
  steps: WorkflowStep[];
  linked_criteria: string[];  // criterion names linked to this workflow
  source: 'user_stated' | 'agent_inferred';
  created_at: string;
  updated_at: string;
}

export interface WorkflowsResponse {
  workflows: Workflow[];
}
