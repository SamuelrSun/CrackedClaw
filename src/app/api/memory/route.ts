import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getMemoryEntries, createMemoryEntry, logActivity } from "@/lib/supabase/data";

// GET /api/memory - List all memory entries
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const entries = await getMemoryEntries();
    
    // Optional filtering by category
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let filtered = entries;
    
    if (category) {
      filtered = filtered.filter((m) => 
        m.category.toLowerCase() === category.toLowerCase()
      );
    }

    const paginated = filtered.slice(offset, offset + limit);

    return jsonResponse({
      memories: paginated,
      total: filtered.length,
      limit,
      offset,
      userId: user.id,
    });
  } catch (err) {
    console.error("Failed to fetch memories:", err);
    return errorResponse("Failed to fetch memories", 500);
  }
}

// POST /api/memory - Create a new memory entry
export async function POST(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.content) {
      return errorResponse("Content is required", 400);
    }

    const newMemory = await createMemoryEntry({
      title: body.title,
      content: body.content,
      category: body.category || "Other",
    });

    // Log activity
    await logActivity(
      "Memory created",
      body.title || body.content.substring(0, 50) + (body.content.length > 50 ? "..." : ""),
      { memoryId: newMemory.id, category: body.category || "Other" }
    );

    return jsonResponse(
      { 
        message: "Memory entry created", 
        memory: newMemory 
      }, 
      201
    );
  } catch (err) {
    console.error("Failed to create memory:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Failed to create memory entry",
      500
    );
  }
}
