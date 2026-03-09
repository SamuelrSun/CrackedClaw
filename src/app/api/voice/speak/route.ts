import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST() {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  // Placeholder: browser-side speechSynthesis is preferred.
  // Future: forward to ElevenLabs or similar TTS service.
  return NextResponse.json(
    {
      error: "Use browser speech synthesis",
      message:
        "Server-side TTS is not yet implemented. Use the Web Speech Synthesis API in the browser.",
    },
    { status: 501 }
  );
}
