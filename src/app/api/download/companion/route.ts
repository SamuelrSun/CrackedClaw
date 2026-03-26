import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect(
    "http://downloads.usedopl.com/download/companion"
  );
}
