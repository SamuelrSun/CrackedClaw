import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getTeamMembersWithInvitations, inviteTeamMember } from "@/lib/supabase/data";

// GET /api/team - List team members and pending invitations
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const data = await getTeamMembersWithInvitations(user.id);
    return jsonResponse(data);
  } catch (err) {
    console.error("Failed to fetch team:", err);
    return errorResponse("Failed to fetch team members", 500);
  }
}

// POST /api/team - Invite a new team member
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    
    if (!body.email) {
      return errorResponse("Email is required", 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return errorResponse("Invalid email address", 400);
    }

    const role = body.role || "member";
    if (!["admin", "member"].includes(role)) {
      return errorResponse("Invalid role. Must be admin or member", 400);
    }

    const invitation = await inviteTeamMember(user.id, body.email, role);
    
    return jsonResponse({
      message: "Invitation sent",
      invitation,
    }, 201);
  } catch (err) {
    console.error("Failed to invite member:", err);
    const message = err instanceof Error ? err.message : "Failed to send invitation";
    return errorResponse(message, 500);
  }
}
