import { NextRequest, NextResponse } from "next/server";
import { authenticateCompanion } from "@/lib/companion-auth";
import { getWalletStatus } from "@/lib/usage/wallet";

export const dynamic = "force-dynamic";

/**
 * GET /api/companion/balance
 * Returns the user's wallet balance via companion token auth.
 */
export async function GET(request: NextRequest) {
  const { userId, error } = await authenticateCompanion(request);
  if (error) return error;

  try {
    const wallet = await getWalletStatus(userId!);
    return NextResponse.json({
      balance_usd: wallet.balance,
      allowed: wallet.allowed,
      auto_reload: wallet.autoReload,
    });
  } catch (err) {
    console.error("[companion/balance] Error:", err);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
