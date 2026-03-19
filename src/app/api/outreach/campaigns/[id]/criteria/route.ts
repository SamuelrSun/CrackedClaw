/**
 * Criteria CRUD endpoint for a campaign.
 * POST — trigger extraction from conversation messages
 * GET  — load current criteria
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractCriteriaFromConversation } from "@/lib/outreach/criteria-extractor";
import { saveCriteria, loadCriteria } from "@/lib/outreach/criteria-store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const model = await loadCriteria(user.id, campaign.slug);
    return NextResponse.json({ criteria: model });
  } catch (err) {
    console.error("Criteria GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Find conversation_id from campaign config
    const config = (campaign.config as Record<string, unknown>) || {};
    const conversationId = config.conversation_id as string | undefined;

    if (!conversationId) {
      return NextResponse.json(
        { error: "No conversation found for this campaign. Start chatting first." },
        { status: 400 }
      );
    }

    // Load messages
    const { data: messageRows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const messages = (messageRows ?? []) as Array<{ role: string; content: string }>;

    if (messages.length < 2) {
      return NextResponse.json(
        { error: "Not enough conversation to extract criteria. Keep chatting." },
        { status: 400 }
      );
    }

    // Extract criteria
    const model = await extractCriteriaFromConversation(messages, campaign.slug);

    // Save to memory
    await saveCriteria(user.id, campaign.slug, model);

    return NextResponse.json({ criteria: model });
  } catch (err) {
    console.error("Criteria POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
