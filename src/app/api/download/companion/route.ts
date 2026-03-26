import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect(
    "https://downloads.usedopl.com/download/companion"
  );
}
