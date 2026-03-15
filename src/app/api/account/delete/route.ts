import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/delete
 * Returns information about what will be deleted
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("instance_id, instance_status")
      .eq("id", user.id)
      .single();

    const dataToDelete = [
      "All conversations and messages",
      "All memories (semantic memory, secrets, learned context)",
      "All AI agents and their chat history",
      "All workflows and their run history",
      "All integrations and OAuth tokens",
      "All uploaded files and embeddings",
      "All installed skills",
      "Usage history and token records",
      "Browser sessions and server-side data",
      "Onboarding state and preferences",
    ];

    if (profile?.instance_id) {
      dataToDelete.push("Your Dopl cloud instance");
    }

    return NextResponse.json({
      requiresConfirmation: true,
      has_organization: false,
      instance_id: profile?.instance_id || null,
      instance_status: profile?.instance_status || null,
      can_delete_instance: !!profile?.instance_id,
      dataToDelete,
    });
  } catch (error) {
    console.error("Get deletion info error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * POST /api/account/delete
 * Performs the account deletion using delete_user_cascade RPC
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get instance_id before deletion for cleanup
    const { data: profile } = await supabase
      .from("profiles")
      .select("instance_id")
      .eq("id", user.id)
      .single();

    const instanceId = profile?.instance_id;

    // Clean up OpenClaw instance on DigitalOcean (before user data deletion)
    if (instanceId) {
      try {
        const provisioningUrl = process.env.PROVISIONING_API_URL;
        const provisioningSecret = process.env.PROVISIONING_API_SECRET;
        if (provisioningUrl && provisioningSecret) {
          const deleteRes = await fetch(`${provisioningUrl}/api/instances/${instanceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${provisioningSecret}` },
            signal: AbortSignal.timeout(30_000),
          });
          if (!deleteRes.ok) {
            console.error('Instance cleanup failed:', deleteRes.status, await deleteRes.text().catch(() => ''));
          }
        }
      } catch (err) {
        console.error('Instance cleanup error (non-fatal):', err);
      }
    }

    // Note: DO server cleanup is handled by the provisioning API delete call above.
    // The /tools/cleanup endpoint was removed — no separate DO cleanup needed.

    // Use the database function to delete all user data atomically
    const adminClient = createAdminClient();
    const { data: result, error: deleteError } = await adminClient
      .rpc('delete_user_cascade', { target_user_id: user.id });

    // Helper: manual fallback deletion when the RPC fails or returns success:false
    const runManualDeletion = async () => {
      const deletions = [
        adminClient.from("agent_instances").delete().eq("user_id", user.id),
        adminClient.from("conversations").delete().eq("user_id", user.id),
        adminClient.from("memories").delete().eq("user_id", user.id),
        adminClient.from("user_integrations").delete().eq("user_id", user.id),
        adminClient.from("workflows").delete().eq("user_id", user.id),
        adminClient.from("activity_log").delete().eq("user_id", user.id),
        adminClient.from("instructions").delete().eq("user_id", user.id),
        adminClient.from("user_gateways").delete().eq("user_id", user.id),
        adminClient.from("profiles").delete().eq("id", user.id),
      ];
      await Promise.allSettled(deletions);
      await adminClient.auth.admin.deleteUser(user.id);
    };

    if (deleteError) {
      // RPC call itself failed (e.g. function signature mismatch, permissions)
      console.error('delete_user_cascade error:', deleteError);
      await runManualDeletion();
    } else if (result && typeof result === 'object' && 'success' in result && !result.success) {
      // RPC returned success:false — e.g. account_deletion_log table missing causes
      // a PL/pgSQL exception that rolls back the function's DELETEs and returns failure.
      // Fall back to manual deletion so the account is still properly removed.
      console.error('delete_user_cascade returned failure, falling back to manual deletion:', result);
      await runManualDeletion();
    }

    // Sign out
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
