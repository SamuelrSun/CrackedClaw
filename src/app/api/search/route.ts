import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { 
  conversations, 
  memoryEntries, 
  workflows, 
  integrations,
  type Conversation,
  type MemoryEntry,
  type Workflow,
  type Integration,
} from "@/lib/mock-data";

interface SearchResult {
  id: string;
  type: "conversation" | "memory" | "workflow" | "integration";
  title: string;
  subtitle?: string;
  snippet?: string;
  url: string;
}

const RESULTS_PER_CATEGORY = 5;

function searchConversations(query: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();
  
  return conversations
    .filter((c: Conversation) => 
      c.title.toLowerCase().includes(lowerQuery) ||
      c.lastMessage.toLowerCase().includes(lowerQuery)
    )
    .slice(0, RESULTS_PER_CATEGORY)
    .map((c: Conversation) => ({
      id: c.id,
      type: "conversation" as const,
      title: c.title,
      snippet: c.lastMessage,
      url: `/chat?conversation=${c.id}`,
    }));
}

function searchMemory(query: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();
  
  return memoryEntries
    .filter((m: MemoryEntry) => 
      m.content.toLowerCase().includes(lowerQuery) ||
      m.category.toLowerCase().includes(lowerQuery)
    )
    .slice(0, RESULTS_PER_CATEGORY)
    .map((m: MemoryEntry) => ({
      id: m.id,
      type: "memory" as const,
      title: m.content.slice(0, 50) + (m.content.length > 50 ? "..." : ""),
      subtitle: m.category,
      snippet: m.content.slice(0, 100),
      url: `/memory?entry=${m.id}`,
    }));
}

function searchWorkflows(query: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();
  
  return workflows
    .filter((w: Workflow) => 
      w.name.toLowerCase().includes(lowerQuery) ||
      w.description.toLowerCase().includes(lowerQuery)
    )
    .slice(0, RESULTS_PER_CATEGORY)
    .map((w: Workflow) => ({
      id: w.id,
      type: "workflow" as const,
      title: w.name,
      subtitle: w.status,
      snippet: w.description,
      url: `/workflows/${w.id}`,
    }));
}

function searchIntegrations(query: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();
  
  return integrations
    .filter((i: Integration) => 
      i.name.toLowerCase().includes(lowerQuery) ||
      i.slug.toLowerCase().includes(lowerQuery) ||
      i.type.toLowerCase().includes(lowerQuery)
    )
    .slice(0, RESULTS_PER_CATEGORY)
    .map((i: Integration) => ({
      id: i.id,
      type: "integration" as const,
      title: i.name,
      subtitle: i.type,
      snippet: `${i.name} (${i.status})`,
      url: `/integrations?id=${i.id}`,
    }));
}

// GET /api/search?q=query
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return jsonResponse({ results: [], total: 0 });
    }

    // Search across all categories in parallel
    const [
      conversationResults,
      memoryResults,
      workflowResults,
      integrationResults,
    ] = await Promise.all([
      Promise.resolve(searchConversations(query)),
      Promise.resolve(searchMemory(query)),
      Promise.resolve(searchWorkflows(query)),
      Promise.resolve(searchIntegrations(query)),
    ]);

    // Combine results (grouped by type due to order)
    const results: SearchResult[] = [
      ...conversationResults,
      ...memoryResults,
      ...workflowResults,
      ...integrationResults,
    ];

    return jsonResponse({
      results,
      total: results.length,
      query,
      userId: user.id,
    });
  } catch (err) {
    console.error("Search error:", err);
    return errorResponse("Search failed", 500);
  }
}
