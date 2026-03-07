import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { 
  getConversations, 
  getMessages, 
  getMemoryEntries, 
  getWorkflows 
} from "@/lib/supabase/data";
import {
  exportToJson,
  exportToMarkdown,
  exportMemoryToMarkdown,
  createZipExport,
  filterByDateRange,
  type ConversationWithMessages,
  type ExportData,
} from "@/lib/export";

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";
  const format = searchParams.get("format") || "json";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  try {
    const exportData: ExportData = {
      exportedAt: new Date().toISOString(),
    };

    // Fetch requested data
    if (type === "conversations" || type === "all") {
      const conversations = await getConversations();
      const filtered = filterByDateRange(conversations, from, to);
      
      // Get messages for each conversation
      const conversationsWithMessages: ConversationWithMessages[] = await Promise.all(
        filtered.map(async (conv) => {
          const messages = await getMessages(conv.id);
          return {
            ...conv,
            messages,
          };
        })
      );
      
      exportData.conversations = conversationsWithMessages;
    }

    if (type === "memory" || type === "all") {
      const memory = await getMemoryEntries();
      exportData.memory = filterByDateRange(memory, from, to);
    }

    if (type === "workflows" || type === "all") {
      const workflows = await getWorkflows();
      exportData.workflows = workflows;
    }

    // Generate export based on format
    let content: string;
    let contentType: string;
    let filename: string;
    const timestamp = new Date().toISOString().split("T")[0];

    if (type === "all") {
      // Always return ZIP bundle for "all"
      content = await createZipExport(exportData);
      contentType = "application/json";
      filename = `openclaw-export-${timestamp}.json`;
    } else if (format === "markdown") {
      if (type === "conversations" && exportData.conversations) {
        content = exportToMarkdown(exportData.conversations);
        filename = `conversations-${timestamp}.md`;
      } else if (type === "memory" && exportData.memory) {
        content = exportMemoryToMarkdown(exportData.memory);
        filename = `memory-${timestamp}.md`;
      } else {
        // Workflows don't have markdown format
        content = exportToJson(exportData.workflows || []);
        filename = `workflows-${timestamp}.json`;
      }
      contentType = type === "workflows" ? "application/json" : "text/markdown";
    } else {
      // JSON format
      let data;
      if (type === "conversations") {
        data = exportData.conversations;
        filename = `conversations-${timestamp}.json`;
      } else if (type === "memory") {
        data = exportData.memory;
        filename = `memory-${timestamp}.json`;
      } else if (type === "workflows") {
        data = exportData.workflows;
        filename = `workflows-${timestamp}.json`;
      } else {
        data = exportData;
        filename = `openclaw-export-${timestamp}.json`;
      }
      content = exportToJson(data);
      contentType = "application/json";
    }

    // Return as downloadable file
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-User-Id": user.id,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return errorResponse("Failed to export data", 500);
  }
}

// POST endpoint to get export metadata (counts, estimated size)
export async function POST(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { types = ["conversations", "memory", "workflows"], from, to } = body;

    const counts: Record<string, number> = {};
    let estimatedSize = 0;

    if (types.includes("conversations")) {
      const conversations = await getConversations();
      const filtered = filterByDateRange(conversations, from, to);
      counts.conversations = filtered.length;
      
      // Estimate message count
      let messageCount = 0;
      for (const conv of filtered.slice(0, 10)) {
        const messages = await getMessages(conv.id);
        messageCount += messages.length;
      }
      const avgMessages = filtered.length > 0 ? messageCount / Math.min(10, filtered.length) : 0;
      estimatedSize += filtered.length * avgMessages * 500; // ~500 bytes per message
    }

    if (types.includes("memory")) {
      const memory = await getMemoryEntries();
      const filtered = filterByDateRange(memory, from, to);
      counts.memory = filtered.length;
      estimatedSize += filtered.length * 200; // ~200 bytes per entry
    }

    if (types.includes("workflows")) {
      const workflows = await getWorkflows();
      counts.workflows = workflows.length;
      estimatedSize += workflows.length * 500; // ~500 bytes per workflow
    }

    return jsonResponse({
      counts,
      estimatedSize: Math.round(estimatedSize * 1.2), // Add 20% overhead
    });
  } catch (err) {
    console.error("Export metadata error:", err);
    return errorResponse("Failed to get export metadata", 500);
  }
}
