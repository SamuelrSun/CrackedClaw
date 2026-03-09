import type { IntegrationProvider } from "@/components/chat/integration-connect-card";
import type { WorkflowDef } from "@/components/workflows/workflow-visualizer";

export interface FileAttachmentMeta {
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  id?: string;
}

export type ParsedSegment =
  | { type: "text"; content: string }
  | { type: "file-attachment"; files: FileAttachmentMeta[]; message?: string }
  | { type: "integration-connect"; provider: IntegrationProvider }
  | { type: "scan-trigger"; provider: string }
  | { type: "integration-status"; provider: string; status: "connected" | "error"; accountName?: string }
  | { type: "subagent-progress"; agents: Array<{ name: string; status: "scanning" | "complete" | "error"; source: string }> }
  | { type: "workflow-suggest"; suggestions: Array<{ id: string; title: string; description: string }> }
  | { type: "context-summary"; insights: Array<{ icon: string; text: string }>; source: string; rawInsights?: Record<string, unknown> }
  | { type: "welcome"; userName: string; agentName: string }
  | { type: "integrations-resolve"; services: string[] }
  | { type: "skill-suggest"; skillId: string; reason: string }
  | { type: "inline-task"; taskName: string; status: "running" | "complete" | "failed"; details?: string }
  | { type: "workflow-preview"; workflow: WorkflowDef }
  | { type: "browser-preview"; url: string; status: "browsing" | "waiting-login" | "complete" | "error"; message?: string }
  | { type: "email-composer"; to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; integration: 'google' | 'microsoft' };

const PATTERNS = {
  inlineTask: /\[\[task:([^:]+):([^:]+)(?::([^\]]+))?\]\]/g,
  integrationsResolve: /\[\[integrations:resolve:([^\]]+)\]\]/g,
  skillSuggest: /\[\[skill:suggest:([^,\]]+)(?:,([^\]]+))?\]\]/g,
  integrationConnect: /\[\[integration:(google|slack|notion)\]\]/g,
  scanTrigger: /\[\[scan:(google|slack|notion)\]\]/g,
  integrationStatus: /\[\[integration-status:(\w+):(connected|error)(?::([^\]]+))?\]\]/g,
  subagentProgress: /\[\[subagent:progress:(\{.*?\})\]\]/g,
  workflowSuggest: /\[\[workflow:suggest:/g,
  contextSummary: /\[\[context:summary:(\{.*?\})\]\]/g,
  welcome: /\[\[welcome:([^,\]]+),([^\]]+)\]\]/g,
  browserPreview: /\[\[browser:([^:]+):([^:]+)(?::([^\]]+))?\]\]/g,
  emailComposer: /\[\[email:(\{[^\]]*\})\]\]/g,
  fileAttachment: /\[Attached files:([^\]]+)\]/g,
};

interface MatchInfo {
  index: number;
  length: number;
  segment: ParsedSegment;
}

const WORKFLOW_PLACEHOLDER = "[[__WORKFLOW_SUGGEST__]]";
const WORKFLOW_PREVIEW_PLACEHOLDER = "[[__WORKFLOW_PREVIEW__]]";

/** Extract [[workflow:{...}]] builder preview tags */
function extractWorkflowPreviews(content: string): {
  content: string;
  previews: Array<{ workflow: import("@/components/workflows/workflow-visualizer").WorkflowDef }>;
} {
  const TAG_START = "[[workflow:";
  const previews: Array<{ workflow: import("@/components/workflows/workflow-visualizer").WorkflowDef }> = [];
  const allMatches: Array<{ index: number; length: number; payload: string }> = [];
  let searchFrom = 0;
  while (true) {
    const start = content.indexOf(TAG_START, searchFrom);
    if (start === -1) break;
    const payloadStart = start + TAG_START.length;
    // Only handle [[workflow:{...}]] (not [[workflow:suggest:...]])
    if (content[payloadStart] !== "{") { searchFrom = payloadStart; continue; }
    let depth = 2;
    let pos = payloadStart;
    while (pos < content.length && depth > 0) {
      if (content[pos] === "[") depth++;
      else if (content[pos] === "]") depth--;
      if (depth > 0) pos++;
    }
    if (depth === 0) {
      const payload = content.slice(payloadStart, pos - 1);
      allMatches.push({ index: start, length: pos + 1 - start, payload });
    }
    searchFrom = pos + 1;
  }

  if (allMatches.length === 0) return { content, previews };

  for (const m of allMatches) {
    try {
      const wf = JSON.parse(m.payload);
      if (wf && wf.name && wf.trigger && wf.steps) {
        previews.push({ workflow: wf });
      }
    } catch { /* skip invalid */ }
  }

  if (previews.length === 0) return { content, previews };

  let result = content;
  for (let i = allMatches.length - 1; i >= 0; i--) {
    const m = allMatches[i];
    const replacement = i === 0 ? WORKFLOW_PREVIEW_PLACEHOLDER : "";
    result = result.slice(0, m.index) + replacement + result.slice(m.index + m.length);
  }
  return { content: result, previews };
}



/** Strip [[action:...]] tags from content — these are internal directives, not for display */
function stripActionTags(content: string): string {
  return content.replace(/\[\[action:[^\]]+\]\]/g, "").trim();
}

/**
 * Pre-process content: collect all [[workflow:suggest:...]] tags (any format),
 * replace first occurrence with a placeholder, remove the rest.
 */
function extractWorkflowSuggestions(content: string): {
  content: string;
  suggestions: Array<{ id: string; title: string; description: string }>;
} {
  const suggestions: Array<{ id: string; title: string; description: string }> = [];
  
  // Custom bracket-aware extraction to handle JSON with nested [] inside [[workflow:suggest:...]]
  const TAG_START = "[[workflow:suggest:";
  const allMatches: Array<{ index: number; length: number; payload: string }> = [];
  let searchFrom = 0;
  while (true) {
    const start = content.indexOf(TAG_START, searchFrom);
    if (start === -1) break;
    const payloadStart = start + TAG_START.length;
    // Find matching ]] — skip nested brackets
    let depth = 2; // we're inside [[
    let pos = payloadStart;
    while (pos < content.length && depth > 0) {
      if (content[pos] === "[") depth++;
      else if (content[pos] === "]") depth--;
      if (depth > 0) pos++;
    }
    if (depth === 0) {
      const payload = content.slice(payloadStart, pos - 1); // -1 because pos is at last ]
      allMatches.push({ index: start, length: pos + 1 - start, payload });
    }
    searchFrom = pos + 1;
  }

  if (allMatches.length === 0) return { content, suggestions };

  for (let i = 0; i < allMatches.length; i++) {
    const payload = allMatches[i].payload;
    if (!payload.startsWith("{")) {
      // New format: TITLE:DESCRIPTION
      const colonIdx = payload.indexOf(":");
      if (colonIdx !== -1) {
        const title = payload.slice(0, colonIdx).trim();
        const description = payload.slice(colonIdx + 1).trim();
        if (title) suggestions.push({ id: `workflow-${i}`, title, description });
      }
    } else {
      // Old JSON format
      try {
        const data = JSON.parse(payload);
        if (data.suggestions) {
          for (let j = 0; j < data.suggestions.length; j++) {
            const s = data.suggestions[j];
            suggestions.push({ id: s.id || `workflow-${i}-${j}`, title: s.name || s.title || "", description: s.description || "" });
          }
        } else if (data.name || data.title) {
          suggestions.push({ id: data.id || `workflow-${i}`, title: data.name || data.title, description: data.description || "" });
        }
      } catch { /* skip */ }
    }
  }

  if (suggestions.length === 0) return { content, suggestions };

  // Replace tags working backwards to preserve indices
  let result = content;
  for (let i = allMatches.length - 1; i >= 0; i--) {
    const m = allMatches[i];
    const replacement = i === 0 ? WORKFLOW_PLACEHOLDER : "";
    result = result.slice(0, m.index) + replacement + result.slice(m.index + m.length);
  }

  return { content: result, suggestions };
}

export function parseMessageContent(content: string): ParsedSegment[] {
  const cleanContent = stripActionTags(content);
  const { content: afterPreviews, previews: workflowPreviews } = extractWorkflowPreviews(cleanContent);
  const { content: processedContent, suggestions: workflowSuggestions } = extractWorkflowSuggestions(afterPreviews);

  const matches: MatchInfo[] = [];

  // Workflow preview placeholder (builder)
  if (workflowPreviews.length > 0) {
    const idx = processedContent.indexOf(WORKFLOW_PREVIEW_PLACEHOLDER);
    if (idx !== -1) {
      matches.push({
        index: idx,
        length: WORKFLOW_PREVIEW_PLACEHOLDER.length,
        segment: { type: "workflow-preview", workflow: workflowPreviews[0].workflow },
      });
    }
  }

  // Workflow suggestions placeholder
  if (workflowSuggestions.length > 0) {
    const idx = processedContent.indexOf(WORKFLOW_PLACEHOLDER);
    if (idx !== -1) {
      matches.push({
        index: idx,
        length: WORKFLOW_PLACEHOLDER.length,
        segment: { type: "workflow-suggest", suggestions: workflowSuggestions },
      });
    }
  }

  let match: RegExpExecArray | null;

  // Integration connect

  // Parse [[scan:provider]] triggers
  PATTERNS.scanTrigger.lastIndex = 0;
  while ((match = PATTERNS.scanTrigger.exec(processedContent)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      segment: { type: "scan-trigger", provider: match[1] },
    });
  }

  // Deduplicate integration connect cards — one per provider
  const seenProviders = new Set<string>();
  PATTERNS.integrationConnect.lastIndex = 0;
  while ((match = PATTERNS.integrationConnect.exec(processedContent)) !== null) {
    if (!seenProviders.has(match[1])) {
      seenProviders.add(match[1]);
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: { type: "integration-connect", provider: match[1] as IntegrationProvider },
      });
    } else {
      // Still need to remove the duplicate tag from content
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: { type: "text", content: "" },
      });
    }
  }

  // Integration status
  PATTERNS.integrationStatus.lastIndex = 0;
  while ((match = PATTERNS.integrationStatus.exec(processedContent)) !== null) {
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

  // Subagent progress
  PATTERNS.subagentProgress.lastIndex = 0;
  while ((match = PATTERNS.subagentProgress.exec(processedContent)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: { type: "subagent-progress", agents: data.agents || [] },
      });
    } catch { /* skip */ }
  }

  // Context summary
  PATTERNS.contextSummary.lastIndex = 0;
  while ((match = PATTERNS.contextSummary.exec(processedContent)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: {
          type: "context-summary",
          insights: data.insights || [],
          source: data.source || "your data",
          rawInsights: data.rawInsights,
        },
      });
    } catch { /* skip */ }
  }

  // Integrations resolve
  PATTERNS.integrationsResolve.lastIndex = 0;
  while ((match = PATTERNS.integrationsResolve.exec(processedContent)) !== null) {
    const services = match[1].split(",").map(s => s.trim()).filter(Boolean);
    if (services.length > 0) {
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: { type: "integrations-resolve", services },
      });
    }
  }

  // Skill suggest
  PATTERNS.skillSuggest.lastIndex = 0;
  while ((match = PATTERNS.skillSuggest.exec(processedContent)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      segment: {
        type: "skill-suggest",
        skillId: match[1].trim(),
        reason: match[2]?.trim() || "This skill would enhance my capabilities for this task",
      },
    });
  }

  // Inline task cards
  PATTERNS.inlineTask.lastIndex = 0;
  while ((match = PATTERNS.inlineTask.exec(processedContent)) !== null) {
    const taskStatus = match[2].trim() as "running" | "complete" | "failed";
    if (["running", "complete", "failed"].includes(taskStatus)) {
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: {
          type: "inline-task",
          taskName: match[1].trim(),
          status: taskStatus,
          details: match[3]?.trim(),
        },
      });
    }
  }

  // Browser preview
  PATTERNS.browserPreview.lastIndex = 0;
  while ((match = PATTERNS.browserPreview.exec(processedContent)) !== null) {
    const bStatus = match[2].trim() as "browsing" | "waiting-login" | "complete" | "error";
    const validStatuses = ["browsing", "waiting-login", "complete", "error"];
    if (validStatuses.includes(bStatus)) {
      matches.push({
        index: match.index,
        length: match[0].length,
        segment: {
          type: "browser-preview",
          url: match[1].trim(),
          status: bStatus,
          message: match[3]?.trim(),
        },
      });
    }
  }


  // Email composer - bracket-aware extraction for [[email:{...}]]
  {
    const EMAIL_TAG = "[[email:";
    let eSearch = 0;
    while (true) {
      const eStart = processedContent.indexOf(EMAIL_TAG, eSearch);
      if (eStart === -1) break;
      const payloadStart = eStart + EMAIL_TAG.length;
      if (processedContent[payloadStart] !== "{") { eSearch = payloadStart; continue; }
      let depth = 1;
      let pos = payloadStart + 1;
      while (pos < processedContent.length && depth > 0) {
        if (processedContent[pos] === "{") depth++;
        else if (processedContent[pos] === "}") depth--;
        pos++;
      }
      // now pos points after the closing }
      if (depth === 0 && processedContent[pos] === "]" && processedContent[pos + 1] === "]") {
        const payload = processedContent.slice(payloadStart, pos);
        const totalLen = pos + 2 - eStart;
        try {
          const data = JSON.parse(payload);
          if (data.to && data.subject && data.integration) {
            matches.push({
              index: eStart,
              length: totalLen,
              segment: {
                type: "email-composer",
                to: Array.isArray(data.to) ? data.to : [data.to],
                cc: data.cc,
                bcc: data.bcc,
                subject: data.subject,
                body: data.body || "",
                integration: data.integration,
              },
            });
          }
        } catch { /* skip */ }
        eSearch = eStart + totalLen;
      } else {
        eSearch = payloadStart;
      }
    }
  }

  // File attachments - parse [Attached files: name (size, type)\nUser message: ...]
  // This is prepended to user messages when files are attached
  const fileAttachPattern = /^\[Attached files:([^\]]+)\]\nUser message: ([\s\S]*)/;
  const fileAttachMatch = processedContent.match(fileAttachPattern);
  if (fileAttachMatch) {
    const filesStr = fileAttachMatch[1];
    const userMsg = fileAttachMatch[2].trim();
    const fileLines = filesStr.split(/,(?=[^)]*\()/).map((s: string) => s.trim()).filter(Boolean);
    const parsedFiles = fileLines.map((line: string) => {
      const m2 = line.match(/^(.+?)\s+\(([\d.]+\s*[KMGB]+),\s*([^)]+)\)$/);
      if (m2) {
        const sizeStr = m2[2].trim();
        let sizeBytes = 0;
        const sizeNum = parseFloat(sizeStr);
        if (sizeStr.includes('MB')) sizeBytes = sizeNum * 1024 * 1024;
        else if (sizeStr.includes('KB')) sizeBytes = sizeNum * 1024;
        else sizeBytes = sizeNum;
        return { name: m2[1].trim(), size: sizeBytes, mimeType: m2[3].trim() };
      }
      return { name: line.trim(), size: 0, mimeType: 'application/octet-stream' };
    });
    if (parsedFiles.length > 0) {
      matches.push({
        index: 0,
        length: fileAttachMatch[0].length,
        segment: { type: 'file-attachment' as const, files: parsedFiles, message: userMsg || undefined },
      });
    }
  }

  // Welcome
  PATTERNS.welcome.lastIndex = 0;
  while ((match = PATTERNS.welcome.exec(processedContent)) !== null) {
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

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  const result: ParsedSegment[] = [];
  let lastIndex = 0;

  for (const m of matches) {
    if (m.index > lastIndex) {
      const textContent = processedContent.slice(lastIndex, m.index).trim();
      if (textContent) result.push({ type: "text", content: textContent });
    }
    result.push(m.segment);
    lastIndex = m.index + m.length;
  }

  if (lastIndex < processedContent.length) {
    const textContent = processedContent.slice(lastIndex).trim();
    if (textContent) result.push({ type: "text", content: textContent });
  }

  if (result.length === 0 && content.trim()) {
    result.push({ type: "text", content: content.trim() });
  }

  return result;
}

export function hasRichContent(content: string): boolean {
  PATTERNS.integrationConnect.lastIndex = 0;
  PATTERNS.integrationStatus.lastIndex = 0;
  PATTERNS.subagentProgress.lastIndex = 0;
  PATTERNS.workflowSuggest.lastIndex = 0;
  PATTERNS.contextSummary.lastIndex = 0;
  PATTERNS.welcome.lastIndex = 0;
  PATTERNS.integrationsResolve.lastIndex = 0;
  PATTERNS.skillSuggest.lastIndex = 0;
  PATTERNS.inlineTask.lastIndex = 0;
  PATTERNS.browserPreview.lastIndex = 0;

  return (
    PATTERNS.integrationConnect.test(content) ||
    PATTERNS.integrationStatus.test(content) ||
    PATTERNS.subagentProgress.test(content) ||
    PATTERNS.workflowSuggest.test(content) ||
    PATTERNS.contextSummary.test(content) ||
    PATTERNS.welcome.test(content) ||
    PATTERNS.integrationsResolve.test(content) ||
    PATTERNS.skillSuggest.test(content) ||
    PATTERNS.inlineTask.test(content) ||
    PATTERNS.browserPreview.test(content) ||
    /\[\[email:\{/.test(content)
  );
}
