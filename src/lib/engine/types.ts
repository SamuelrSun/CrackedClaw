// Raw data from integrations
export interface RawEmailData {
  id: string;
  to: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  labels: string[];
  threadId: string;
  isReply: boolean;
  direction: 'sent' | 'received';
}

export interface RawCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: Array<{ email: string; name?: string; responseStatus?: string }>;
  recurring: boolean;
  description?: string;
  location?: string;
  status: string;
}

export interface RawLabelData {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface IntegrationData {
  provider: string;
  accountEmail: string;
  emails: {
    sent: RawEmailData[];
    received: RawEmailData[];
    totalSent: number;
    totalReceived: number;
  };
  calendar: {
    pastEvents: RawCalendarEvent[];
    futureEvents: RawCalendarEvent[];
  };
  labels: RawLabelData[];
  fetchedAt: string;
}

// Entity extracted from analysis
export interface ExtractedEntity {
  name: string;
  type: 'project' | 'person' | 'company' | 'url' | 'product' | 'tool' | 'event';
  source: string;
  context: string;
  confidence: number;
  attributes: Record<string, string>;
}

// Analysis pass output
export interface AnalysisPassResult {
  passName: string;
  memories: Array<{
    content: string;
    page_path: string;
    importance: number;
    temporal: 'permanent' | 'monthly' | 'weekly' | 'ephemeral';
  }>;
  entities: ExtractedEntity[];
}

// Correlation output
export interface UnifiedEntity {
  name: string;
  type: string;
  sources: string[];
  attributes: Record<string, string>;
  relationships: Array<{ entity: string; relation: string }>;
  description: string;
}

// Progress callback
export type ProgressCallback = (event: EngineProgressEvent) => void;

export interface EngineProgressEvent {
  phase: 'fetching' | 'analyzing' | 'correlating' | 'storing';
  pass?: string;
  progress: number;
  message: string;
  detail?: string;
}

// Full engine result
export interface EngineResult {
  provider: string;
  accountEmail: string;
  passResults: AnalysisPassResult[];
  unifiedEntities: UnifiedEntity[];
  totalMemoriesCreated: number;
  totalEntities: number;
  durationMs: number;
  summary: string;
  workflowSuggestions?: import("./workflow-intelligence").AutomationSuggestion[];
  topPainPoints?: string[];
}
