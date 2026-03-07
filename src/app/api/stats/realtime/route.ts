import { NextResponse } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/stats/realtime - Get real-time activity stats for the current user
 */
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's message count
    const { count: messageCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString());

    // Get average response time from today's messages
    const { data: messages } = await supabase
      .from("messages")
      .select("created_at, role")
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: true });

    let avgResponseTime = 0;
    if (messages && messages.length > 1) {
      let totalResponseTime = 0;
      let responseCount = 0;
      
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].role === "assistant" && messages[i - 1].role === "user") {
          const userTime = new Date(messages[i - 1].created_at).getTime();
          const assistantTime = new Date(messages[i].created_at).getTime();
          totalResponseTime += assistantTime - userTime;
          responseCount++;
        }
      }
      
      if (responseCount > 0) {
        avgResponseTime = Math.round(totalResponseTime / responseCount);
      }
    }

    // Get active subagents (sessions that are currently running)
    const activeSubagents = 0;

    // Get last activity
    const { data: lastMessage } = await supabase
      .from("messages")
      .select("created_at, content")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let lastActivity = null;
    if (lastMessage) {
      const activityDate = new Date(lastMessage.created_at);
      const now = new Date();
      const diffMs = now.getTime() - activityDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        lastActivity = "just now";
      } else if (diffMins < 60) {
        lastActivity = `${diffMins}m ago`;
      } else if (diffMins < 1440) {
        lastActivity = `${Math.floor(diffMins / 60)}h ago`;
      } else {
        lastActivity = activityDate.toLocaleDateString();
      }
    }

    return jsonResponse({
      messageCount: messageCount || 0,
      avgResponseTime,
      activeSubagents,
      lastActivity,
    });
  } catch (err) {
    console.error("Failed to fetch realtime stats:", err);
    return errorResponse("Failed to fetch stats", 500);
  }
}
