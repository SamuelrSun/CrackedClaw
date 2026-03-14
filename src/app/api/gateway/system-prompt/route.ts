import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { buildSystemPromptForUser } from "@/lib/gateway/system-prompt";

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const prompt = await buildSystemPromptForUser(user.id);
    return jsonResponse({ prompt, timestamp: Date.now() });
  } catch (err) {
    console.error("[system-prompt] Failed to build system prompt:", err);
    return errorResponse("Failed to build system prompt", 500);
  }
}
