import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { error: dbError } = await supabase
      .from('agent_instances')
      .update({ status: 'idle', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (dbError) throw dbError;
    return jsonResponse({ success: true });
  } catch (err) {
    console.error("Failed to stop agent:", err);
    return errorResponse("Failed to stop agent", 500);
  }
}
