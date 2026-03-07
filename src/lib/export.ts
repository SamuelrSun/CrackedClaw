import type { Conversation, Message, MemoryEntry, Workflow } from "./mock-data";

// Export data types
export interface ExportData {
  conversations?: ConversationWithMessages[];
  memory?: MemoryEntry[];
  workflows?: Workflow[];
  exportedAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

/**
 * Export data to JSON string
 */
export function exportToJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export conversations to Markdown format
 */
export function exportToMarkdown(conversations: ConversationWithMessages[]): string {
  const lines: string[] = [];
  
  lines.push("# Conversations Export");
  lines.push(`Exported: ${new Date().toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  })}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const conversation of conversations) {
    lines.push(`# Conversation: ${conversation.title}`);
    lines.push(`Date: ${formatDate(conversation.timestamp)}`);
    lines.push("");

    for (const message of conversation.messages) {
      const role = message.role === "user" ? "User" : "Assistant";
      lines.push(`## ${role}`);
      lines.push(message.content);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export memory entries to Markdown format
 */
export function exportMemoryToMarkdown(entries: MemoryEntry[]): string {
  const lines: string[] = [];
  
  lines.push("# Memory Export");
  lines.push(`Exported: ${new Date().toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  })}`);
  lines.push("");

  // Group by category
  const byCategory = entries.reduce((acc, entry) => {
    const category = entry.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(entry);
    return acc;
  }, {} as Record<string, MemoryEntry[]>);

  for (const [category, categoryEntries] of Object.entries(byCategory)) {
    lines.push(`## ${category}`);
    for (const entry of categoryEntries) {
      lines.push(`- ${entry.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Create a ZIP export with all data
 * Returns a base64 encoded ZIP file
 */
export async function createZipExport(data: ExportData): Promise<string> {
  // Using a simple file concatenation format since we're server-side
  // For a real ZIP file, you'd use a library like JSZip
  const files: { name: string; content: string }[] = [];

  if (data.conversations && data.conversations.length > 0) {
    files.push({
      name: "conversations.json",
      content: exportToJson(data.conversations),
    });
    files.push({
      name: "conversations.md",
      content: exportToMarkdown(data.conversations),
    });
  }

  if (data.memory && data.memory.length > 0) {
    files.push({
      name: "memory.json",
      content: exportToJson(data.memory),
    });
    files.push({
      name: "memory.md",
      content: exportMemoryToMarkdown(data.memory),
    });
  }

  if (data.workflows && data.workflows.length > 0) {
    files.push({
      name: "workflows.json",
      content: exportToJson(data.workflows),
    });
  }

  // Add metadata
  files.push({
    name: "metadata.json",
    content: exportToJson({
      exportedAt: data.exportedAt,
      filesIncluded: files.map((f) => f.name),
      counts: {
        conversations: data.conversations?.length || 0,
        memory: data.memory?.length || 0,
        workflows: data.workflows?.length || 0,
      },
    }),
  });

  // Return as a JSON bundle (for simplicity)
  // In production, you'd use a proper ZIP library
  return JSON.stringify({
    type: "openclaw-export",
    version: "1.0",
    exportedAt: data.exportedAt,
    files,
  });
}

/**
 * Estimate export file size in bytes
 */
export function estimateExportSize(data: {
  conversations?: ConversationWithMessages[];
  memory?: MemoryEntry[];
  workflows?: Workflow[];
}): number {
  let size = 0;

  if (data.conversations) {
    size += JSON.stringify(data.conversations).length;
  }

  if (data.memory) {
    size += JSON.stringify(data.memory).length;
  }

  if (data.workflows) {
    size += JSON.stringify(data.workflows).length;
  }

  // Add overhead for formatting
  return Math.round(size * 1.2);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format date string
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Filter data by date range
 */
export function filterByDateRange<T extends { createdAt?: string; timestamp?: string }>(
  items: T[],
  from?: string,
  to?: string
): T[] {
  if (!from && !to) return items;

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  // Set toDate to end of day
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  return items.filter((item) => {
    const dateStr = item.createdAt || item.timestamp;
    if (!dateStr) return true;

    try {
      const itemDate = new Date(dateStr);
      if (fromDate && itemDate < fromDate) return false;
      if (toDate && itemDate > toDate) return false;
      return true;
    } catch {
      return true;
    }
  });
}
