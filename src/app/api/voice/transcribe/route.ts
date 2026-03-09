import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST() {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  // Placeholder: browser-side Web Speech API is preferred.
  // Future: forward audio blob to Whisper API or similar.
  return NextResponse.json(
    {
      error: "Use browser speech recognition",
      message:
        "Server-side transcription is not yet implemented. Use the Web Speech API in the browser.",
    },
    { status: 501 }
  );
}
