import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const secret = process.env.DO_SERVER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "DO_SERVER_SECRET not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`https://companion.crackedclaw.com/api/browser/screenshot`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Companion screenshot failed" }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
