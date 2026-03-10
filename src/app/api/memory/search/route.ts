import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { mem0Search } from "@/lib/memory/mem0-client";

// POST /api/memory/search - Search memory entries via semantic search
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { query, domain, limit = 20 } = await request.json();
    if (!query) return errorResponse("query required", 400);

    const results = await mem0Search(query, user.id, { limit, domain });

    return jsonResponse({
      results: results.map(m => ({
        id: m.id,
        content: m.memory || m.content,
        domain: m.domain,
        importance: m.importance,
        similarity: m.similarity,
        source: (m.metadata as Record<string, unknown>)?.source,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
      total: results.length,
      query,
    });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
