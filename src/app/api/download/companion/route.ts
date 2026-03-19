import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect(
    "https://github.com/SamuelrSun/dopl-companion/releases/download/v1.0.0/Dopl.Connect-1.0.0-arm64.dmg"
  );
}
