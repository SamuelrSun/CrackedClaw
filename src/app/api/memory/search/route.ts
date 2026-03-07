import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { memoryEntries, MemoryEntry } from "@/lib/mock-data";

// In-memory store (would be Supabase in production)
let memoryStore = [...memoryEntries];

// POST /api/memory/search - Search memory entries
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    
    const query = (body.query || "").toLowerCase();
    const category = body.category?.toLowerCase();
    const limit = body.limit || 20;
    const offset = body.offset || 0;

    if (!query && !category) {
      return errorResponse("Query or category is required", 400);
    }

    // Simple text search (in production, would use Supabase full-text search or vector similarity)
    let results = memoryStore.filter((m) => {
      const matchesQuery = !query || m.content.toLowerCase().includes(query);
      const matchesCategory = !category || m.category.toLowerCase() === category;
      return matchesQuery && matchesCategory;
    });

    // Sort by relevance (simple: exact matches first)
    if (query) {
      results = results.sort((a, b) => {
        const aStartsWith = a.content.toLowerCase().startsWith(query) ? 0 : 1;
        const bStartsWith = b.content.toLowerCase().startsWith(query) ? 0 : 1;
        return aStartsWith - bStartsWith;
      });
    }

    const paginated = results.slice(offset, offset + limit);

    return jsonResponse({
      results: paginated,
      total: results.length,
      query,
      category: category || null,
      limit,
      offset,
      userId: user.id,
    });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
