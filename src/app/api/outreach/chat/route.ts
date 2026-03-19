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
  scoringContext?: { scored: number; high: number; medium: number; low: number; topCriteria: string }
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
${scoringContext && scoringContext.scored > 0 ? `
### Lead Scoring Results
${scoringContext.scored} leads scored: ${scoringContext.high} High, ${scoringContext.medium} Medium, ${scoringContext.low} Low
Top criteria: ${scoringContext.topCriteria}

The user can ask you to:
- Find more leads matching the criteria (use web search + browser tools)
- Explain why a specific lead was ranked a certain way
- Adjust criteria based on feedback
- Re-score leads after criteria changes` : ''}

### Your Role
- Listen to the user describe who they're looking for
- Ask clarifying questions to understand nuances
- When you have enough info, summarize the criteria and suggest extracting them
- Present your understanding back to the user for confirmation
- Refine based on their corrections`;
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
        criteriaText = criteriaMemories
          .map((m) => {
            const meta = (m.metadata as Record<string, unknown>) || {};
            if (meta.type === "criterion") {
              try {
                const c = JSON.parse(m.memory ?? m.content ?? "");
                return `- [${c.category?.toUpperCase() ?? "UNKNOWN"}] ${c.description} (importance: ${c.importance?.toFixed(2) ?? "?"}, source: ${c.source ?? "?"})`;
              } catch {
                return `- ${m.memory ?? m.content}`;
              }
            } else if (meta.type === "anti_pattern") {
              return `- EXCLUDE: ${m.memory ?? m.content}`;
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
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

    // Load scoring context if campaign is active
    let scoringContext: { scored: number; high: number; medium: number; low: number; topCriteria: string } | undefined;
    if (campaign.status === 'active') {
      try {
        const { data: leadCounts } = await supabase
          .from('campaign_leads')
          .select('rank')
          .eq('campaign_id', campaign_id);
        if (leadCounts && leadCounts.length > 0) {
          const high = leadCounts.filter((l) => l.rank === 'high').length;
          const medium = leadCounts.filter((l) => l.rank === 'medium').length;
          const low = leadCounts.filter((l) => l.rank === 'low').length;
          // Build top criteria summary from criteriaText
          const criteriaLines = criteriaText.split('\n').slice(0, 3);
          scoringContext = {
            scored: leadCounts.length,
            high,
            medium,
            low,
            topCriteria: criteriaLines.join('; ').slice(0, 200),
          };
        }
      } catch {
        // ignore scoring context errors
      }
    }

    // Inject outreach context
    const outreachContext = buildOutreachSystemPrompt(
      campaign.name,
      campaign.status,
      criteriaText,
      scoringContext
    );
    systemPrompt += outreachContext;

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
