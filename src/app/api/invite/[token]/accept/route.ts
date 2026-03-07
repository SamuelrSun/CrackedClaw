import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { acceptInvitation } from "@/lib/supabase/data";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/invite/[token]/accept
export async function POST(_request: Request, { params }: RouteParams) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { token } = await params;

  try {
    await acceptInvitation(token, user.id);
    return jsonResponse({ message: "Invitation accepted" });
  } catch (err) {
    console.error("Failed to accept invitation:", err);
    const message = err instanceof Error ? err.message : "Failed to accept invitation";
    return errorResponse(message, 400);
  }
}
