import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteInstance } from "@/lib/provisioning-client";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = 'force-dynamic';

interface DeletionInfo {
  has_organization: boolean;
  organization_id?: string;
  organization_name?: string;
  is_owner: boolean;
  has_other_members: boolean;
  member_count?: number;
  instance_id?: string;
  instance_status?: string;
  can_delete_instance: boolean;
}

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

    // Get deletion info using the database function
    const { data, error } = await supabase.rpc("get_account_deletion_info", {
      target_user_id: user.id,
    });

    if (error) {
      console.error("Failed to get deletion info:", error);
      
      // Fallback: manually query the data
      const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      
      let memberCount = 0;
      if (org) {
        const { count } = await supabase
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("org_id", org.id)
          .neq("user_id", user.id)
          .not("accepted_at", "is", null);
        memberCount = count || 0;
      }

      const deletionInfo: DeletionInfo = {
        has_organization: !!org,
        organization_id: org?.id,
        organization_name: org?.name,
        is_owner: !!org,
        has_other_members: memberCount > 0,
        member_count: memberCount,
        instance_id: org?.openclaw_instance_id,
        instance_status: org?.openclaw_status,
        can_delete_instance: !!org && memberCount === 0,
      };

      return NextResponse.json({
        requiresConfirmation: true,
        ...deletionInfo,
        dataToDelete: getDataSummary(deletionInfo),
      });
    }

    const deletionInfo = data as DeletionInfo;

    return NextResponse.json({
      requiresConfirmation: true,
      ...deletionInfo,
      dataToDelete: getDataSummary(deletionInfo),
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
 * Performs the account deletion
 * Body: { confirmDeleteInstance?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { confirmDeleteInstance = false } = body;

    // Get current state
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    let memberCount = 0;
    if (org) {
      const { count } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .neq("user_id", user.id)
        .not("accepted_at", "is", null);
      memberCount = count || 0;
    }

    // If there's an instance and user is solo owner, delete the instance first
    let instanceDeleted = false;
    if (org?.openclaw_instance_id && memberCount === 0) {
      // Delete the provisioned instance
      try {
        const deleteResult = await deleteInstance(org.openclaw_instance_id);
        if (deleteResult.success) {
          instanceDeleted = true;
        } else {
          console.error("Failed to delete instance:", deleteResult.error);
          // Continue with account deletion anyway - instance will be orphaned
        }
      } catch (err) {
        console.error("Instance deletion error:", err);
        // Continue with account deletion anyway
      }
    }

    // If user has other members in org, just leave the org (don't delete it)
    if (org && memberCount > 0) {
      // Transfer ownership first
      const { data: newOwner } = await supabase
        .from("team_members")
        .select("id, user_id")
        .eq("org_id", org.id)
        .neq("user_id", user.id)
        .not("accepted_at", "is", null)
        .order("role", { ascending: true }) // admins first
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (newOwner) {
        // Update the new owner's role
        await supabase
          .from("team_members")
          .update({ role: "owner" })
          .eq("id", newOwner.id);

        // Update organization owner
        await supabase
          .from("organizations")
          .update({ owner_id: newOwner.user_id })
          .eq("id", org.id);
      }

      // Remove user from team
      await supabase
        .from("team_members")
        .delete()
        .eq("user_id", user.id)
        .eq("org_id", org.id);
    } else if (org) {
      // Solo user - delete the organization
      await supabase
        .from("organizations")
        .delete()
        .eq("id", org.id);
    }

    // Delete user data
    await Promise.all([
      supabase.from("conversations").delete().eq("user_id", user.id),
      supabase.from("memory_entries").delete().eq("user_id", user.id),
      supabase.from("user_memory").delete().eq("user_id", user.id),
      supabase.from("integrations").delete().eq("user_id", user.id),
      supabase.from("workflows").delete().eq("user_id", user.id),
      supabase.from("instructions").delete().eq("user_id", user.id),
      supabase.from("activity_log").delete().eq("user_id", user.id),
      supabase.from("token_usage").delete().eq("user_id", user.id),
      supabase.from("user_gateways").delete().eq("user_id", user.id),
      supabase.from("onboarding_state").delete().eq("user_id", user.id),
      supabase.from("user_context").delete().eq("user_id", user.id),
      supabase.from("oauth_flows").delete().eq("user_id", user.id),
      supabase.from("user_integrations").delete().eq("user_id", user.id),
      supabase.from("usage_history").delete().eq("user_id", user.id),
      supabase.from("profiles").delete().eq("id", user.id),
    ]);

    // Log the deletion (for audit)
    try {
      await supabase.from("account_deletion_log").insert({
        user_id: user.id,
        user_email: user.email,
        organization_id: org?.id,
        organization_name: org?.name,
        instance_id: org?.openclaw_instance_id,
        instance_deleted: instanceDeleted,
        deletion_type: memberCount > 0 ? "leave_org" : org ? "delete_org" : "solo",
        deleted_by: user.id,
        metadata: {
          member_count: memberCount,
          had_instance: !!org?.openclaw_instance_id,
        },
      });
    } catch (err) {
      console.error("Failed to log deletion:", err);
    }

    // Sign out the user first
    await supabase.auth.signOut();

    // Delete from auth.users using admin client
    const adminClient = createAdminClient();
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteAuthError) {
      console.error("Failed to delete auth user:", deleteAuthError);
      // Non-fatal: user data is gone, they just can't log in anyway since profile is deleted
    }

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
      instanceDeleted,
      organizationDeleted: !!(org && memberCount === 0),
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * Helper to generate data deletion summary
 */
function getDataSummary(info: DeletionInfo): string[] {
  const items = [
    "All conversations and messages",
    "All memory entries",
    "All workflows and their run history",
    "All integrations and connected accounts",
    "Usage history and token records",
    "Instructions and preferences",
  ];

  if (info.has_organization) {
    if (info.has_other_members) {
      items.push("Your team membership (organization will be transferred)");
    } else {
      items.push("Your organization");
      if (info.instance_id) {
        items.push("Your CrackedClaw cloud instance");
      }
    }
  }

  return items;
}
