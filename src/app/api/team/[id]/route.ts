import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { updateMemberRole, removeMember, cancelInvitation } from "@/lib/supabase/data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/team/[id] - Update member role
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    
    if (!body.role) {
      return errorResponse("Role is required", 400);
    }

    if (!["admin", "member"].includes(body.role)) {
      return errorResponse("Invalid role. Must be admin or member", 400);
    }

    await updateMemberRole(user.id, id, body.role);
    
    return jsonResponse({
      message: "Role updated",
      memberId: id,
      role: body.role,
    });
  } catch (err) {
    console.error("Failed to update role:", err);
    const message = err instanceof Error ? err.message : "Failed to update role";
    return errorResponse(message, 500);
  }
}

// DELETE /api/team/[id] - Remove member or cancel invitation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type"); // "member" or "invitation"

  try {
    if (type === "invitation") {
      await cancelInvitation(user.id, id);
      return jsonResponse({
        message: "Invitation cancelled",
        invitationId: id,
      });
    } else {
      await removeMember(user.id, id);
      return jsonResponse({
        message: "Member removed",
        memberId: id,
      });
    }
  } catch (err) {
    console.error("Failed to remove:", err);
    const message = err instanceof Error ? err.message : "Failed to remove";
    return errorResponse(message, 500);
  }
}
