import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getContextFindings } from "@/lib/context-scanners";

/**
 * GET /api/context/findings
 * Get completed scan results for the authenticated user
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const findings = await getContextFindings(user.id);

    if (!findings) {
      return jsonResponse({
        success: true,
        hasScanned: false,
        message: "No context scans found. Start one with POST /api/context/gather",
        results: [],
        combinedInsights: [],
        suggestedWorkflows: [],
      });
    }

    return jsonResponse({
      success: true,
      hasScanned: true,
      lastScanned: findings.lastScanned,
      results: findings.results,
      combinedInsights: findings.combinedInsights,
      suggestedWorkflows: findings.suggestedWorkflows,
      message: `Found ${findings.results.length} scan results`,
    });
  } catch (err) {
    console.error("Context findings error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Failed to get context findings",
      500
    );
  }
}
