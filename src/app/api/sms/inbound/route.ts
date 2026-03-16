import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Validate Twilio signature (basic - full validation requires twilio SDK)
// For now we check that the request has the expected Twilio fields
function isTwilioRequest(body: URLSearchParams): boolean {
  return body.has("From") && body.has("Body") && body.has("To");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(request: NextRequest) {
  // Twilio sends form-encoded data
  const text = await request.text();
  const body = new URLSearchParams(text);

  if (!isTwilioRequest(body)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const from = body.get("From") ?? ""; // sender's number e.g. +14155551234
  const messageBody = body.get("Body") ?? "";

  if (!from) {
    return new NextResponse("OK", { status: 200 });
  }

  const supabase = createAdminClient();

  // Look up user by phone number
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone_verified, gateway_url, auth_token")
    .eq("phone_number", from)
    .maybeSingle();

  if (!profile) {
    // Unknown number — ignore silently (return TwiML empty response)
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // If not yet verified — this is the verification SMS
  if (!profile.phone_verified) {
    await supabase
      .from("profiles")
      .update({ phone_verified: true })
      .eq("id", profile.id);

    // Respond with a welcome SMS
    const twiml = `<Response><Message>✓ Phone verified! You can now text this number to chat with your AI companion.</Message></Response>`;
    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Verified user — forward message to their OpenClaw instance
  if (profile.gateway_url && profile.auth_token) {
    try {
      // Send via HTTP chat endpoint (fire and forget — we'll send reply via Twilio)
      const chatRes = await fetch(`${profile.gateway_url}/api/gateway/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${profile.auth_token}`,
        },
        body: JSON.stringify({
          message: messageBody,
          channel: "sms",
          from_phone: from,
        }),
      });

      if (chatRes.ok) {
        const data = await chatRes.json();
        const replyText = (data.message ?? data.content ?? "Got it!") as string;

        // Truncate to SMS limit
        const smsReply = replyText.slice(0, 1600);
        const twiml = `<Response><Message>${escapeXml(smsReply)}</Message></Response>`;
        return new NextResponse(twiml, {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      }
    } catch (err) {
      console.error("[sms/inbound] Failed to forward to instance:", err);
    }
  }

  // Fallback: acknowledge
  const twiml = `<Response><Message>Message received. Your companion is processing it.</Message></Response>`;
  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
