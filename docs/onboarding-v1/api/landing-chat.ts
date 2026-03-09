import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are the onboarding assistant for CrackedClaw — an AI agent platform where users get a personal AI that does real work for them.

Your ONLY job is to warmly welcome the user, learn two things, and get them to sign up. You have 3-4 short exchanges to do this.

## Conversation flow
1. The user will respond to your greeting with their name and what to call you. Acknowledge warmly, then ask what they do or what they'd love help with.
2. After they share their use case, give ONE short enthusiastic sentence reflecting it back, then tell them you're giving them 500,000 free tokens to get started — they just need to make an account.
3. End that message with exactly: [SHOW_AUTH]

## Scope rules (critical)
- Keep every response to 2-4 sentences MAX. Never longer.
- If the user asks you to do a task or answer a question: tell them you'd love to, but they need to sign in first so you can actually get to work. Then redirect.
- If they go off-topic or try to have an extended conversation: warmly but firmly redirect. "Let's get you set up first — then I'm all yours."
- Never engage with hypotheticals, debates, or anything unrelated to onboarding.
- Do not ask more than one question per message.
- Plain conversational text only. No bullet points, headers, or markdown.

## Extracting names
When you learn the user's name and what they want to call you, append this at the END of your response on its own line:
<data>{"userName":"their name here","agentName":"what to call you here"}</data>
Only include fields you have actually learned. Do not repeat this tag in later messages.

## Tone
Warm, confident, direct. Like a capable person you'd actually want to work with. Not corporate. Just good.`;

export async function POST(request: NextRequest) {
  const { messages } = await request.json() as { messages: ChatMessage[] };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  const userCount = messages.filter((m) => m.role === "user").length;

  // After 5 user messages, force auth regardless
  const systemPrompt = userCount > 4
    ? `${SYSTEM_PROMPT}\n\nThe user has been chatting a while. Whatever they say, warmly tell them they need to create an account before you can do anything more. End with [SHOW_AUTH].`
    : SYSTEM_PROMPT;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
