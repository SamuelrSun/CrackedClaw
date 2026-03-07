import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import {
  startContextGathering,
  runContextGathering,
  getAvailableScanners,
} from "@/lib/context-scanners";

/**
 * POST /api/context/gather
 * Start context gathering job
 * 
 * Body:
 * - integrations: string[] - List of integrations to scan (e.g., ['gmail', 'calendar'])
 * - async: boolean - If true, returns jobId immediately (default: false)
 * - daysBack: number - Days of history to scan (default: 20)
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { 
      integrations = ['gmail', 'calendar'], 
      async = false,
      daysBack = 20,
      maxItems = 500,
    } = body;

    // Validate integrations
    const available = getAvailableScanners();
    const availableIds = new Set(available.map(s => s.id));
    
    const validIntegrations = integrations.filter((i: string) => 
      availableIds.has(i.toLowerCase()) || 
      i.toLowerCase() === 'google' // Google OAuth covers gmail + calendar
    );

    if (validIntegrations.length === 0) {
      return errorResponse(
        `No valid integrations provided. Available: ${available.map(s => s.id).join(', ')}`,
        400
      );
    }

    const options = { daysBack, maxItems };

    if (async) {
      // Start async job and return immediately
      const jobId = await startContextGathering(user.id, validIntegrations, options);
      
      return jsonResponse({
        success: true,
        jobId,
        status: 'started',
        message: `Context gathering started. Poll /api/context/status?jobId=${jobId} for progress.`,
      });
    } else {
      // Run synchronously and wait for results
      const result = await runContextGathering(user.id, validIntegrations, options);
      
      return jsonResponse({
        success: true,
        ...result,
        message: `Scanned ${result.results.length} integrations in ${result.timeMs}ms`,
      });
    }
  } catch (err) {
    console.error("Context gather error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Failed to start context gathering",
      500
    );
  }
}

/**
 * GET /api/context/gather
 * Get available scanners
 */
export async function GET() {
  const { error } = await requireApiAuth();
  if (error) return error;

  const scanners = getAvailableScanners();
  
  return jsonResponse({
    success: true,
    scanners,
    message: "Available context scanners",
  });
}
