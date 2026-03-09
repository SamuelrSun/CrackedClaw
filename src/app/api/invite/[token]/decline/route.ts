import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { declineInvitation, getInvitationByToken } from "@/lib/supabase/data";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/invite/[token]/decline
export async function POST(_request: Request, { params }: RouteParams) {
  const { user, error: authError } = await requireApiAuth();
  if (authError) return authError;

  const { token } = await params;

  try {
    // Optionally verify the invitation belongs to the authenticated user
    const { invitation } = await getInvitationByToken(token);
    if (invitation && invitation.email && user!.email && invitation.email.toLowerCase() !== user!.email.toLowerCase()) {
      return errorResponse("You are not authorized to decline this invitation", 403);
    }

    await declineInvitation(token);
    return jsonResponse({ message: "Invitation declined" });
  } catch (err) {
    console.error("Failed to decline invitation:", err);
    const message = err instanceof Error ? err.message : "Failed to decline invitation";
    return errorResponse(message, 400);
  }
}
