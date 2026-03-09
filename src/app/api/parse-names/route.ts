import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: `Extract the user's name and the AI agent's name from this message. Return ONLY valid JSON with keys "userName" and "agentName". If a name isn't mentioned, use null.

Message: "${text.replace(/"/g, "'")}"

JSON:`,
          },
        ],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text?.trim() ?? "{}";

    // Parse the JSON Claude returns
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    const parsed = JSON.parse(match[0]);

    return NextResponse.json({
      userName: capitalize(parsed.userName) || null,
      agentName: capitalize(parsed.agentName) || null,
    });
  } catch (err) {
    console.error("parse-names error:", err);
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
