import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getMemoryEntries, updateMemoryEntry, deleteMemoryEntry, logActivity } from "@/lib/supabase/data";

// GET /api/memory/[id] - Get a single memory entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  
  try {
    const entries = await getMemoryEntries();
    const memory = entries.find((m) => m.id === id);

    if (!memory) {
      return errorResponse("Memory entry not found", 404);
    }

    return jsonResponse({ memory });
  } catch (err) {
    console.error("Failed to fetch memory:", err);
    return errorResponse("Failed to fetch memory entry", 500);
  }
}

// PUT /api/memory/[id] - Update a memory entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    
    const updated = await updateMemoryEntry(id, {
      title: body.title,
      content: body.content,
      category: body.category,
    });

    // Log activity
    await logActivity(
      "Memory updated",
      body.title || body.content?.substring(0, 50) || "Memory entry",
      { memoryId: id, category: body.category }
    );

    return jsonResponse({ 
      message: "Memory entry updated", 
      memory: updated 
    });
  } catch (err) {
    console.error("Failed to update memory:", err);
    const message = err instanceof Error ? err.message : "Failed to update memory entry";
    const status = message.includes("not found") ? 404 : 500;
    return errorResponse(message, status);
  }
}

// PATCH /api/memory/[id] - Update a memory entry (partial)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    
    const updated = await updateMemoryEntry(id, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.category !== undefined && { category: body.category }),
    });

    // Log activity
    await logActivity(
      "Memory updated",
      body.title || "Memory entry",
      { memoryId: id }
    );

    return jsonResponse({ 
      message: "Memory entry updated", 
      memory: updated 
    });
  } catch (err) {
    console.error("Failed to update memory:", err);
    const message = err instanceof Error ? err.message : "Failed to update memory entry";
    const status = message.includes("not found") ? 404 : 500;
    return errorResponse(message, status);
  }
}

// DELETE /api/memory/[id] - Delete a memory entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await deleteMemoryEntry(id);

    // Log activity
    await logActivity(
      "Memory deleted",
      `Memory entry removed`,
      { memoryId: id }
    );

    return jsonResponse({ 
      message: "Memory entry deleted",
      id,
    });
  } catch (err) {
    console.error("Failed to delete memory:", err);
    const message = err instanceof Error ? err.message : "Failed to delete memory entry";
    const status = message.includes("not found") ? 404 : 500;
    return errorResponse(message, status);
  }
}
