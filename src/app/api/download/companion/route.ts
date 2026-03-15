import { NextResponse } from "next/server";

export async function GET() {
  const dmgUrl = process.env.COMPANION_DMG_URL || "http://164.92.75.153:8080/download/companion";
  return NextResponse.redirect(dmgUrl);
}
