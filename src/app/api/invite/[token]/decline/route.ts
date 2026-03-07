import { jsonResponse, errorResponse } from "@/lib/api-auth";
import { declineInvitation } from "@/lib/supabase/data";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/invite/[token]/decline
export async function POST(_request: Request, { params }: RouteParams) {
  const { token } = await params;

  try {
    await declineInvitation(token);
    return jsonResponse({ message: "Invitation declined" });
  } catch (err) {
    console.error("Failed to decline invitation:", err);
    const message = err instanceof Error ? err.message : "Failed to decline invitation";
    return errorResponse(message, 400);
  }
}
