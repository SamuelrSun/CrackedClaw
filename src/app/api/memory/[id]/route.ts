import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { mem0GetAll, mem0Update, mem0Delete } from "@/lib/memory/mem0-client";

// GET /api/memory/[id] - Get a single memory entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    // Fetch all and find by id (no single-record RPC needed)
    const all = await mem0GetAll(user.id);
    const memory = all.find((m) => m.id === id);

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

    await mem0Update(id, {
      content: body.content || body.title,
      domain: body.category,
    });

    return jsonResponse({
      message: "Memory entry updated",
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

    await mem0Update(id, {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.category !== undefined && { domain: body.category }),
      ...(body.importance !== undefined && { importance: body.importance }),
    });

    return jsonResponse({
      message: "Memory entry updated",
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
    await mem0Delete(id);

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
