import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getJobStatus } from "@/lib/context-scanners";

/**
 * GET /api/context/status?jobId=xxx
 * Get context gathering job status and progress
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return errorResponse("jobId query parameter required", 400);
  }

  const job = getJobStatus(jobId);

  if (!job) {
    return errorResponse("Job not found", 404);
  }

  // Verify user owns this job
  if (job.userId !== user.id) {
    return errorResponse("Job not found", 404);
  }

  // Return different data based on status
  if (job.status === 'completed') {
    return jsonResponse({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      results: job.results,
      combinedInsights: job.combinedInsights,
      suggestedWorkflows: job.suggestedWorkflows,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      timeMs: job.completedAt 
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : undefined,
    });
  } else if (job.status === 'failed') {
    return jsonResponse({
      success: false,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } else {
    // pending or running
    return jsonResponse({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      startedAt: job.startedAt,
      message: job.progress.message,
    });
  }
}
