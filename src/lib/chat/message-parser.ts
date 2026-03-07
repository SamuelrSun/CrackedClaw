import type { IntegrationProvider } from "@/components/chat/integration-connect-card";

export type ParsedSegment =
  | { type: "text"; content: string }
  | { type: "integration-connect"; provider: IntegrationProvider }
  | { type: "integration-status"; provider: string; status: "connected" | "error"; accountName?: string }
  | { type: "subagent-progress"; agents: Array<{ name: string; status: "scanning" | "complete" | "error"; source: string }> }
  | { type: "workflow-suggest"; suggestions: Array<{ id: string; title: string; description: string }> }
  | { type: "context-summary"; insights: Array<{ icon: string; text: string }>; source: string }
  | { type: "welcome"; userName: string; agentName: string };

const PATTERNS = {
  integrationConnect: /\[\[integration:(google|slack|notion)\]\]/g,
  integrationStatus: /\[\[integration-status:(\w+):(connected|error)(?::([^\]]+))?\]\]/g,
  subagentProgress: /\[\[subagent:progress:(\{.*?\})\]\]/g,
  workflowSuggest: /\[\[workflow:suggest:(\{.*?\})\]\]/g,
  contextSummary: /\[\[context:summary:(\{.*?\})\]\]/g,
  welcome: /\[\[welcome:([^,\]]+),([^\]]+)\]\]/g,
};

interface MatchInfo {
  index: number;
  length: number;
  segment: ParsedSegment;
}

export function parseMessageContent(content: string): ParsedSegment[] {
  const matches: MatchInfo[] = [];

  // Find all integration connect patterns
  let match: RegExpExecArray | null;
  
  while ((match = PATTERNS.integrationConnect.exec(content)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      segment: {
        type: "integration-connect",
        provider: match[1] as IntegrationProvider,
      },
    });
  }

  // Find all integration status patterns
  PATTERNS.integrationStatus.lastIndex = 0;
  while ((match = PATTERNS.integrationStatus.exec(content)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      segment: {
        type: "integration-status",
        provider: match[1],
        status: match[2] as "connected" | "error",
        accountName: match[3],
      },
    });
  }

  // Find all subagent progress patterns
  PATTERNS.subagentProgress.lastIndex = 0;
  while ((match = PATTERNS.subagentProgress.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: {
          type: "subagent-progress",
          agents: data.agents || [],
        },
      });
    } catch {
      // Invalid JSON, skip
    }
  }

  // Find all workflow suggest patterns
  PATTERNS.workflowSuggest.lastIndex = 0;
  while ((match = PATTERNS.workflowSuggest.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: {
          type: "workflow-suggest",
          suggestions: data.suggestions || [],
        },
      });
    } catch {
      // Invalid JSON, skip
    }
  }

  // Find all context summary patterns
  PATTERNS.contextSummary.lastIndex = 0;
  while ((match = PATTERNS.contextSummary.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: {
          type: "context-summary",
          insights: data.insights || [],
          source: data.source || "your data",
        },
      });
    } catch {
      // Invalid JSON, skip
    }
  }

  // Find all welcome patterns
  PATTERNS.welcome.lastIndex = 0;
  while ((match = PATTERNS.welcome.exec(content)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      segment: {
        type: "welcome",
        userName: match[1].trim(),
        agentName: match[2].trim(),
      },
    });
  }

  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);

  // Build result array with text segments between matches
  const result: ParsedSegment[] = [];
  let lastIndex = 0;

  for (const m of matches) {
    // Add text before this match
    if (m.index > lastIndex) {
      const textContent = content.slice(lastIndex, m.index).trim();
      if (textContent) {
        result.push({ type: "text", content: textContent });
      }
    }
    
    // Add the matched segment
    result.push(m.segment);
    lastIndex = m.index + m.length;
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      result.push({ type: "text", content: textContent });
    }
  }

  // If no matches found, return entire content as text
  if (result.length === 0 && content.trim()) {
    result.push({ type: "text", content: content.trim() });
  }

  return result;
}

export function hasRichContent(content: string): boolean {
  return (
    PATTERNS.integrationConnect.test(content) ||
    PATTERNS.integrationStatus.test(content) ||
    PATTERNS.subagentProgress.test(content) ||
    PATTERNS.workflowSuggest.test(content) ||
    PATTERNS.contextSummary.test(content) ||
    PATTERNS.welcome.test(content)
  );
}
