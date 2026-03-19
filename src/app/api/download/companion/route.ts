import { NextResponse } from "next/server";

export async function GET() {
  const dmgUrl = process.env.COMPANION_DMG_URL || "http://164.92.75.153:3100/download/companion";
  // Override any stale env pointing to port 8080 (firewalled)
  const finalUrl = dmgUrl.includes(":8080") ? dmgUrl.replace(":8080", ":3100") : dmgUrl;
  return NextResponse.redirect(finalUrl);
}
