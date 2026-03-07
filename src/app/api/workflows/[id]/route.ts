import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { workflows, Workflow } from "@/lib/mock-data";

// In-memory store (would be Supabase in production)
let workflowsStore = [...workflows];

// GET /api/workflows/[id] - Get a single workflow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const workflow = workflowsStore.find((w) => w.id === id);

  if (!workflow) {
    return errorResponse("Workflow not found", 404);
  }

  return jsonResponse({ workflow });
}

// PUT /api/workflows/[id] - Full update of a workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const index = workflowsStore.findIndex((w) => w.id === id);

  if (index === -1) {
    return errorResponse("Workflow not found", 404);
  }

  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return errorResponse("Name is required", 400);
    }
    if (!body.description) {
      return errorResponse("Description is required", 400);
    }
    
    const updated: Workflow = {
      id: workflowsStore[index].id,
      name: body.name,
      description: body.description,
      status: body.status || workflowsStore[index].status,
      lastRun: workflowsStore[index].lastRun,
      icon: body.icon || workflowsStore[index].icon,
    };

    workflowsStore[index] = updated;

    return jsonResponse({ 
      message: "Workflow updated", 
      workflow: updated 
    });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}

// PATCH /api/workflows/[id] - Partial update of a workflow
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const index = workflowsStore.findIndex((w) => w.id === id);

  if (index === -1) {
    return errorResponse("Workflow not found", 404);
  }

  try {
    const body = await request.json();
    
    // Update only provided fields
    const updated: Workflow = {
      ...workflowsStore[index],
      ...(body.name && { name: body.name }),
      ...(body.description && { description: body.description }),
      ...(body.status && { status: body.status }),
      ...(body.icon && { icon: body.icon }),
      ...(body.lastRun && { lastRun: body.lastRun }),
    };

    workflowsStore[index] = updated;

    return jsonResponse({ 
      message: "Workflow updated", 
      workflow: updated 
    });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}

// DELETE /api/workflows/[id] - Delete a workflow
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const index = workflowsStore.findIndex((w) => w.id === id);

  if (index === -1) {
    return errorResponse("Workflow not found", 404);
  }

  const deleted = workflowsStore.splice(index, 1)[0];

  return jsonResponse({ 
    message: "Workflow deleted", 
    workflow: deleted 
  });
}
