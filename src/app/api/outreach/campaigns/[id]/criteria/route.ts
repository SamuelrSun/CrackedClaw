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
  request: NextRequest,
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

    // Accept description and dataset context directly from the request body
    let description: string | undefined;
    try {
      const body = await request.json();
      description = body.description;
    } catch { /* no body — that's fine, we'll use conversation */ }

    // Load conversation messages if available
    const config = (campaign.config as Record<string, unknown>) || {};
    const conversationId = config.conversation_id as string | undefined;
    let messages: Array<{ role: string; content: string }> = [];

    if (conversationId) {
      const { data: messageRows } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      messages = (messageRows ?? []) as Array<{ role: string; content: string }>;
    }

    // Need at least a description or conversation messages
    if (!description && messages.length < 2) {
      return NextResponse.json(
        { error: "Provide a description or start a conversation first." },
        { status: 400 }
      );
    }

    // Build dataset summary if dataset is connected
    let datasetSummary: string | undefined;
    const { data: datasetRow } = await supabase
      .from("campaign_datasets")
      .select("*")
      .eq("campaign_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (datasetRow) {
      const rows = (datasetRow.rows || []) as Array<Record<string, string>>;
      const cols = (datasetRow.columns || []) as string[];
      const sampleRows = rows.slice(0, 5).map((r, i) =>
        `Row ${i + 1}: ${JSON.stringify(r)}`
      ).join('\n');
      datasetSummary = `Source: ${datasetRow.source_type} (${datasetRow.source_name || datasetRow.source_url || 'unknown'})\nColumns: ${cols.join(', ')}\nTotal rows: ${datasetRow.row_count || rows.length}\nSample rows:\n${sampleRows}`;
    }

    // Extract criteria from ALL available context
    const model = await extractCriteriaFromConversation(
      messages,
      campaign.slug,
      { description, datasetSummary }
    );

    // Save to memory
    await saveCriteria(user.id, campaign.slug, model);

    return NextResponse.json({ criteria: model });
  } catch (err) {
    console.error("Criteria POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
