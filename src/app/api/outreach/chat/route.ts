/**
 * Outreach-specific chat streaming route.
 * Wraps the gateway chat stream with campaign context and criteria injection.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { buildDynamicContext, buildSystemPromptForUser } from "@/lib/gateway/system-prompt";
import { getUserInstance } from "@/lib/gateway/openclaw-proxy";
import { mem0Search } from "@/lib/memory/mem0-client";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

type StreamEvent = Record<string, unknown>;

function encode(chunk: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

function buildOutreachSystemPrompt(
  campaignName: string,
  status: string,
  criteria: string,
  scoringContext?: { scored: number; high: number; medium: number; low: number; pending: number; topCriteria: string },
  datasetContext?: string
): string {
  const phaseMap: Record<string, { description: string; instructions: string }> = {
    setup: {
      description: "Info Dump — gathering lead criteria",
      instructions: `- Listen carefully as the user describes who they're looking for
- Ask clarifying questions to understand nuances (industry, seniority, company size, signals, etc.)
- When you have a clear picture, summarize your understanding and ask for confirmation
- Do NOT start scanning or listing leads yet — focus on understanding the criteria first`,
    },
    scanning: {
      description: "Scanning — finding leads based on criteria",
      instructions: `- The criteria have been extracted. Now help find and qualify leads.
- Discuss potential lead sources and strategies
- Help the user refine and prioritize their list`,
    },
    active: {
      description: "Active — outreach in progress",
      instructions: `- Campaign is live. Help track progress and refine messaging.
- Answer questions about lead status and next steps.
- You can help find more leads, explain rankings, adjust criteria, or re-score leads.`,
    },
    paused: {
      description: "Paused",
      instructions: `- Campaign is paused. Help plan next steps.`,
    },
  };

  const phase = phaseMap[status] ?? phaseMap.setup;

  return `

## OUTREACH MODE — Campaign: ${campaignName}
Status: ${status}

You are helping the user find and qualify leads for this campaign.

### Current Phase: ${phase.description}
${phase.instructions}

### Current Criteria Model
${criteria || "(No criteria extracted yet — continue the info dump conversation)"}
${scoringContext ? `
### Lead Pipeline
${scoringContext.scored > 0
    ? `Scored: ${scoringContext.scored} leads — ${scoringContext.high} High / ${scoringContext.medium} Medium / ${scoringContext.low} Low`
    : 'No leads scored yet.'}${scoringContext.pending > 0 ? `\nPending enrichment: ${scoringContext.pending} leads imported but not yet scored` : ''}${scoringContext.scored > 0 ? `\nTop criteria driving scores: ${scoringContext.topCriteria}\n\nThe user can ask you to:\n- Find more leads matching the criteria (use web search + browser tools)\n- Explain why a specific lead was ranked a certain way\n- Adjust criteria based on feedback\n- Re-score leads after criteria changes` : ''}` : ''}

### Connected Dataset
${datasetContext ?? "No dataset connected yet."}

### Your Role
- Listen to the user describe who they're looking for
- Ask clarifying questions to understand nuances
- When you have enough info, summarize the criteria and suggest extracting them
- Present your understanding back to the user for confirmation
- Refine based on their corrections
- When the user refers to "the sheet", "the data", "the list", or similar, reference the Connected Dataset above`;
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { message, campaign_id, conversation_id } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Load campaign
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("user_id", user!.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Load existing criteria from mem0
    let criteriaText = "";
    try {
      const criteriaMemories = await mem0Search("criteria", user!.id, {
        domain: `outreach:${campaign.slug}`,
        limit: 20,
      });
      if (criteriaMemories.length > 0) {
        const criterionLines: string[] = [];
        const antiPatternLines: string[] = [];
        const interactionLines: string[] = [];
        const otherLines: string[] = [];

        for (const m of criteriaMemories) {
          const meta = (m.metadata as Record<string, unknown>) || {};
          const raw = m.memory ?? m.content ?? "";

          if (meta.type === "criterion") {
            try {
              const c = JSON.parse(raw);
              const importance = typeof c.importance === "number" ? c.importance.toFixed(2) : "?";
              const source = c.source ?? "unknown";
              const sourceLabel =
                source === "user_stated" ? "stated"
                : source === "agent_discovered" ? "discovered"
                : source === "refined" ? "refined"
                : source;
              criterionLines.push(
                `  - [${c.category?.toUpperCase() ?? "GENERAL"}] ${c.description} (weight: ${importance}, source: ${sourceLabel})`
              );
            } catch {
              criterionLines.push(`  - ${raw}`);
            }
          } else if (meta.type === "anti_pattern") {
            antiPatternLines.push(`  - ${raw}`);
          } else if (meta.type === "interaction_effect") {
            interactionLines.push(`  - ${raw}`);
          } else if (raw) {
            otherLines.push(`  - ${raw}`);
          }
        }

        const sections: string[] = [];
        if (criterionLines.length > 0) {
          sections.push(`Criteria (with weights):\n${criterionLines.join("\n")}`);
        }
        if (antiPatternLines.length > 0) {
          sections.push(`Exclusion patterns (auto-disqualify):\n${antiPatternLines.join("\n")}`);
        }
        if (interactionLines.length > 0) {
          sections.push(`Interaction effects (combined signal boosts):\n${interactionLines.join("\n")}`);
        }
        if (otherLines.length > 0) {
          sections.push(`Additional notes:\n${otherLines.join("\n")}`);
        }
        criteriaText = sections.join("\n\n");
      }
    } catch {
      // criteria section stays empty
    }

    // Manage conversation
    let activeConversationId = conversation_id;
    if (!activeConversationId) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({
          user_id: user!.id,
          title: `[Outreach] ${campaign.name}`,
        })
        .select()
        .single();
      if (newConvo) activeConversationId = newConvo.id;
    }

    // Save user message
    if (activeConversationId) {
      try {
        await supabase.from("messages").insert({
          conversation_id: activeConversationId,
          role: "user",
          content: message,
        });
      } catch (e) {
        console.error("Failed to save user message:", e);
      }
    }

    // Load message history
    let previousMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (activeConversationId) {
      try {
        const { data: historyRows } = await supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: false })
          .limit(51);
        if (historyRows && historyRows.length > 0) {
          previousMessages = historyRows
            .slice(1)
            .reverse() as Array<{ role: "user" | "assistant"; content: string }>;
        }
      } catch {
        // ignore
      }
    }

    // Build system prompt
    const instance = await getUserInstance(user!.id);
    if (!instance) {
      return NextResponse.json(
        { error: "No OpenClaw instance configured." },
        { status: 503 }
      );
    }

    let systemPrompt: string;
    try {
      systemPrompt = await buildDynamicContext(
        user!.id,
        message,
        activeConversationId || undefined
      );
    } catch {
      systemPrompt = await buildSystemPromptForUser(user!.id, message);
    }

    // Load lead pipeline context (all statuses)
    let scoringContext: { scored: number; high: number; medium: number; low: number; pending: number; topCriteria: string } | undefined;
    try {
      const { data: allLeads } = await supabase
        .from('campaign_leads')
        .select('rank')
        .eq('campaign_id', campaign_id);
      if (allLeads && allLeads.length > 0) {
        const high = allLeads.filter((l) => l.rank === 'high').length;
        const medium = allLeads.filter((l) => l.rank === 'medium').length;
        const low = allLeads.filter((l) => l.rank === 'low').length;
        const pending = allLeads.filter((l) => !l.rank).length;
        // Build top criteria summary from first criterion lines
        const criteriaFirstSection = criteriaText.split('\n\n')[0] ?? '';
        const criteriaLines = criteriaFirstSection.split('\n').slice(1, 4); // skip section header
        scoringContext = {
          scored: high + medium + low,
          high,
          medium,
          low,
          pending,
          topCriteria: criteriaLines.join('; ').slice(0, 200),
        };
      }
    } catch {
      // ignore scoring context errors
    }

    // Load dataset context + enrichment status
    let datasetContext: string | undefined;
    let enrichmentContext: string | undefined;
    try {
      const { data: dataset } = await supabase
        .from("campaign_datasets")
        .select("source_type, source_url, source_name, columns, rows, row_count, enriched_rows, url_columns")
        .eq("campaign_id", campaign_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (dataset) {
        const sourceLabel = dataset.source_type === "google_sheet"
          ? "Google Sheet"
          : dataset.source_type ?? "File";
        const sourceRef = dataset.source_url
          ? `${sourceLabel} (${dataset.source_url})`
          : dataset.source_name
          ? `${sourceLabel}: ${dataset.source_name}`
          : sourceLabel;

        const columns: string[] = Array.isArray(dataset.columns) ? dataset.columns : [];
        const rows: Record<string, unknown>[] = Array.isArray(dataset.rows) ? dataset.rows : [];
        const enrichedRows: unknown[] = Array.isArray(dataset.enriched_rows) ? dataset.enriched_rows : [];
        const dbUrlColumns: string[] = Array.isArray(dataset.url_columns) ? dataset.url_columns : [];
        const sampleRows = rows.slice(0, 5);

        // Auto-detect url_columns if not stored
        const urlPattern = /url|link|linkedin|website|profile|href/i;
        const urlColumns = dbUrlColumns.length > 0
          ? dbUrlColumns
          : columns.filter((c) => urlPattern.test(c));

        const sampleLines = sampleRows
          .map((row, i) => `- Row ${i + 1}: ${JSON.stringify(row)}`)
          .join("\n");

        datasetContext = `Source: ${sourceRef}
Columns: [${columns.join(", ")}]
Rows: ${dataset.row_count ?? rows.length}
Sample rows:
${sampleLines || "(no rows available)"}

The user connected this data source to this campaign. Reference it when they ask about "the sheet" or "the data".`;

        // Build enrichment context
        const totalRows = dataset.row_count ?? rows.length;
        const enrichedCount = enrichedRows.length;
        const urlColsStr = urlColumns.length > 0 ? urlColumns.join(", ") : "none detected";
        enrichmentContext = `### Enrichment Status
${enrichedCount} / ${totalRows} enriched
URL columns: ${urlColsStr}
To enrich: visit the URL column for each row, extract profile data, then POST /api/outreach/campaigns/${campaign_id}/enrich with row_index and data.`;
      }
    } catch {
      // no dataset — leave datasetContext and enrichmentContext undefined
    }

    // Inject outreach context
    const outreachContext = buildOutreachSystemPrompt(
      campaign.name,
      campaign.status,
      criteriaText,
      scoringContext,
      datasetContext
    );
    systemPrompt += outreachContext;

    // Append enrichment context after the Connected Dataset section
    if (enrichmentContext) {
      systemPrompt += `\n\n${enrichmentContext}`;
    }

    // Append workflow context
    try {
      const { data: workflowRows } = await supabase
        .from('campaign_workflows')
        .select('*')
        .eq('campaign_id', campaign_id)
        .order('created_at', { ascending: true });

      const wfLines: string[] = [];
      if (workflowRows && workflowRows.length > 0) {
        wfLines.push(`\n\n### Workflows`);
        wfLines.push(`${workflowRows.length} workflow(s) extracted for this campaign:`);
        for (const wf of workflowRows) {
          const steps = Array.isArray(wf.steps) ? wf.steps : [];
          const stepStr = steps
            .map((s: { order: number; description: string; tool: string }) => `${s.order}. ${s.description} (${s.tool})`)
            .join(' → ');
          const criteria = Array.isArray(wf.linked_criteria) && wf.linked_criteria.length > 0
            ? wf.linked_criteria.join(', ')
            : 'none';
          wfLines.push(
            `\n  [${wf.type}] ${wf.name} (${wf.source === 'user_stated' ? 'stated by user' : 'agent inferred'})\n  Steps: ${stepStr || '(none)'}\n  Linked criteria: ${criteria}`
          );
        }
      } else {
        wfLines.push(`\n\n### Workflows`);
        wfLines.push(
          `No workflows extracted yet. When the user describes how they find leads, extract the workflow and write it via:\nPOST /api/outreach/campaigns/${campaign_id}/workflows`
        );
      }
      wfLines.push(
        `\n\nTo save a workflow: POST /api/outreach/campaigns/${campaign_id}/workflows\nBody: { name, type (discovery/enrichment/outreach/custom), steps: [{order, description, tool, parameters}], linked_criteria, source }`
      );
      systemPrompt += wfLines.join('\n');
    } catch {
      // ignore workflow context errors — non-critical
    }

    const allMessages = [
      ...previousMessages,
      { role: "user" as const, content: message },
    ];

    const capturedConvoId = activeConversationId;

    // Stream via gateway
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    (async () => {
      let fullContent = "";

      try {
        const gatewayBase =
          instance.port === 443
            ? `https://${instance.host}`
            : `http://${instance.host}:${instance.port}`;
        const gatewayUrl = `${gatewayBase}/v1/chat/completions`;

        const gatewayMessages = [
          { role: "system", content: systemPrompt },
          ...allMessages,
        ];

        const res = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + instance.gatewayToken,
          },
          body: JSON.stringify({
            messages: gatewayMessages,
            model: "claude-sonnet-4",
            stream: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          console.error("Gateway error:", res.status, errText);
          await writer
            .write(
              encode({ type: "error", message: `Gateway error: ${res.status}` })
            )
            .catch(() => {});
        } else {
          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body from gateway");

          const decoder = new TextDecoder();
          let buffer = "";

          await writer
            .write(
              encode({
                type: "status",
                backend: "openclaw-gateway",
                conversation_id: capturedConvoId,
              })
            )
            .catch(() => {});

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);

              if (data === "[DONE]") {
                await writer
                  .write(
                    encode({ type: "done", conversation_id: capturedConvoId })
                  )
                  .catch(() => {});
                break;
              }

              try {
                const chunk = JSON.parse(data);
                const delta = chunk.choices?.[0]?.delta;
                const finishReason = chunk.choices?.[0]?.finish_reason;

                if (delta?.content) {
                  fullContent += delta.content;
                  await writer
                    .write(encode({ type: "token", text: delta.content }))
                    .catch(() => {});
                }

                if (
                  finishReason === "stop" ||
                  finishReason === "end_turn"
                ) {
                  await writer
                    .write(
                      encode({
                        type: "done",
                        conversation_id: capturedConvoId,
                      })
                    )
                    .catch(() => {});
                }
              } catch {
                // skip
              }
            }
          }
          reader.releaseLock();
        }
      } catch (err) {
        console.error("Outreach streaming error:", err);
        await writer
          .write(
            encode({
              type: "error",
              message:
                err instanceof Error ? err.message : "Streaming failed",
            })
          )
          .catch(() => {});
      }

      // Post-stream: save assistant message
      if (capturedConvoId && fullContent) {
        try {
          await supabase.from("messages").insert({
            conversation_id: capturedConvoId,
            role: "assistant",
            content: fullContent,
          });
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", capturedConvoId);
        } catch (e) {
          console.error("Failed to save assistant message:", e);
        }
      }

      await writer.close().catch(() => {});
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": activeConversationId || "",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
