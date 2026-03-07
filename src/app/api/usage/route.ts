import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getTokenUsage, incrementTokenUsage, getUsageHistory } from "@/lib/supabase/data";

// GET /api/usage - Fetch current usage and history
export async function GET(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7", 10);

    const [usage, history] = await Promise.all([
      getTokenUsage(),
      getUsageHistory(days),
    ]);

    // Calculate days until reset
    let daysUntilReset = 0;
    if (usage.resetDate && usage.resetDate !== "—") {
      const resetDate = new Date(usage.resetDate);
      const now = new Date();
      const diffTime = resetDate.getTime() - now.getTime();
      daysUntilReset = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return jsonResponse({
      usage: {
        used: usage.used,
        limit: usage.limit,
        resetDate: usage.resetDate,
        percentage: Math.round((usage.used / usage.limit) * 100),
        daysUntilReset,
      },
      history,
    });
  } catch (err) {
    console.error("Usage fetch error:", err);
    return errorResponse("Failed to fetch usage", 500);
  }
}

// POST /api/usage - Increment usage (called after gateway chat)
export async function POST(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { tokens } = body;

    if (typeof tokens !== "number" || tokens < 0) {
      return errorResponse("Invalid token count", 400);
    }

    await incrementTokenUsage(tokens);

    return jsonResponse({
      success: true,
      tokens_added: tokens,
    });
  } catch (err) {
    console.error("Usage increment error:", err);
    return errorResponse("Failed to increment usage", 500);
  }
}
