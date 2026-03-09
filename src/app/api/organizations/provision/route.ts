import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionInstance, getInstanceStatus } from "@/lib/provisioning-client";
import { createInitialState } from "@/lib/onboarding/state-machine";

/**
 * Generate a random workspace name like "swift-horizon-4821"
 */
function generateWorkspaceName(): string {
  const adjectives = ["swift", "bright", "calm", "bold", "keen", "crisp", "clear", "sharp", "deep", "wide", "pure", "free", "strong", "wise", "warm"];
  const nouns = ["horizon", "studio", "signal", "layer", "stream", "base", "core", "space", "field", "forge", "grid", "loop", "node", "stack", "tide"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}-${noun}-${num}`;
}

/**
 * POST /api/organizations/provision
 * Provision a new OpenClaw instance for the user's organization.
 * organization_name is now optional — auto-generated if omitted.
 * Also accepts: user_display_name, agent_name, use_case for onboarding context.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const organization_name: string = body.organization_name || generateWorkspaceName();
    const user_display_name: string | undefined = body.user_display_name;
    const agent_name: string | undefined = body.agent_name;
    const use_case: string | undefined = body.use_case;

    // Check if user already has an organization
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    let organizationId: string;
    let isNewOrganization = false;

    if (existingOrg) {
      // Check if already provisioned
      if (existingOrg.openclaw_instance_id && existingOrg.openclaw_status === "running") {
        return NextResponse.json({
          error: "Organization already has a provisioned instance",
          organization: existingOrg,
        }, { status: 400 });
      }
      organizationId = existingOrg.id;
    } else {
      isNewOrganization = true;

      // Generate a unique slug: base + user id suffix to avoid collisions
      const baseSlug = organization_name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "org";
      const uniqueSlug = `${baseSlug}-${user.id.slice(0, 8)}`;

      // Create new organization
      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({
          name: organization_name,
          slug: uniqueSlug,
          owner_id: user.id,
          openclaw_status: "provisioning",
        })
        .select()
        .single();

      if (createError || !newOrg) {
        console.error("Failed to create organization:", createError);
        const errMsg = createError?.message || "Failed to create organization";
        // Slug collision fallback: try with full timestamp
        if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
          const fallbackSlug = `${baseSlug}-${Date.now()}`;
          const { data: retryOrg, error: retryError } = await supabase
            .from("organizations")
            .insert({
              name: organization_name,
              slug: fallbackSlug,
              owner_id: user.id,
              openclaw_status: "provisioning",
            })
            .select()
            .single();
          if (retryError || !retryOrg) {
            console.error("Retry org creation failed:", retryError);
            return NextResponse.json({ error: "Failed to create organization: " + (retryError?.message || "unknown") }, { status: 500 });
          }
          organizationId = retryOrg.id;
        } else {
          return NextResponse.json({ error: "Failed to create organization: " + errMsg }, { status: 500 });
        }
      } else {
        organizationId = newOrg.id;
      }
      organizationId = newOrg.id;

      // Update profile with organization_id
      await supabase
        .from("profiles")
        .update({ organization_id: organizationId })
        .eq("id", user.id);
    }

    // Call provisioning API
    const provisionResult = await provisionInstance(organizationId, organization_name);

    if (!provisionResult.success || !provisionResult.instance) {
      // Update status to failed
      await supabase
        .from("organizations")
        .update({ openclaw_status: "failed" })
        .eq("id", organizationId);

      return NextResponse.json({
        error: provisionResult.error || "Failed to provision instance",
      }, { status: 500 });
    }

    const now = new Date().toISOString();

    // Update organization with instance details
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        openclaw_instance_id: provisionResult.instance.id,
        openclaw_gateway_url: provisionResult.instance.gateway_url,
        openclaw_auth_token: provisionResult.instance.auth_token,
        openclaw_status: "running", // normalize: instance is up even if API reports "stopped"
        updated_at: now,
      })
      .eq("id", organizationId);

    if (updateError) {
      console.error("Failed to update organization with instance details:", updateError);
    }

    // Also save to user_gateways for consistency
    await supabase
      .from("user_gateways")
      .upsert({
        user_id: user.id,
        gateway_url: provisionResult.instance.gateway_url,
        auth_token: provisionResult.instance.auth_token,
        name: `${organization_name} (Cloud)`,
        status: "connected",
        created_at: now,
        updated_at: now,
      }, {
        onConflict: "user_id",
      });

    // Initialize onboarding state for new users
    if (isNewOrganization) {
      const initialState = createInitialState(user.id);

      // Merge pre-auth landing chat context into initial state
      const gatheredContext = {
        ...initialState.gathered_context,
        ...(use_case ? { use_case, source: "landing_chat" } : {}),
      };
      const completedSteps = [
        ...initialState.completed_steps,
        ...(user_display_name ? ["user_name_provided" as const] : []),
        ...(agent_name ? ["agent_name_provided" as const] : []),
      ];
      
      // Create onboarding state record
      const { error: onboardingError } = await supabase
        .from("onboarding_state")
        .upsert({
          user_id: user.id,
          phase: initialState.phase,
          completed_steps: completedSteps,
          skipped_steps: initialState.skipped_steps,
          gathered_context: gatheredContext,
          suggested_workflows: initialState.suggested_workflows,
          agent_name: agent_name ?? initialState.agent_name,
          user_display_name: user_display_name ?? initialState.user_display_name,
          created_at: now,
          updated_at: now,
        }, {
          onConflict: "user_id",
        });

      if (onboardingError) {
        console.error("Failed to create onboarding state:", onboardingError);
        // Non-fatal, continue
      }

      // Create initial welcome conversation
      const { data: welcomeConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: "Welcome to OpenClaw",
          summary: "Your onboarding conversation",
          is_pinned: false,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (convoError) {
        console.error("Failed to create welcome conversation:", convoError);
        // Non-fatal, continue
      } else if (welcomeConvo) {
        // Add initial welcome message
        await supabase
          .from("messages")
          .insert({
            conversation_id: welcomeConvo.id,
            role: "assistant",
            content: user_display_name
              ? `Hey ${user_display_name}! I'm ${agent_name ?? "your AI agent"} — fully set up and ready to go. What would you like to tackle first?`
              : "👋 Welcome! I'm your new AI assistant. Let's get to know each other.\n\nWhat should I call you?",
            created_at: now,
          });
      }
    }

    return NextResponse.json({
      success: true,
      organization_id: organizationId,
      instance: {
        id: provisionResult.instance.id,
        gateway_url: provisionResult.instance.gateway_url,
        status: provisionResult.instance.status,
      },
      onboarding_initialized: isNewOrganization,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Provision error (full):", msg, error);
    return NextResponse.json({
      error: "Internal server error: " + msg,
    }, { status: 500 });
  }
}

/**
 * GET /api/organizations/provision
 * Get current organization's OpenClaw instance status
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!org) {
      return NextResponse.json({ organization: null });
    }

    // If instance exists, check its status
    if (org.openclaw_instance_id) {
      const statusResult = await getInstanceStatus(org.openclaw_instance_id);
      
      if (statusResult.success && statusResult.instance) {
        // Normalize status: provisioning API may return "stopped" even when running
        // Always keep as "running" if instance exists and gateway URL is set
        const normalizedStatus = org.openclaw_gateway_url ? "running" : statusResult.instance.status;
        if (normalizedStatus !== org.openclaw_status) {
          await supabase
            .from("organizations")
            .update({
              openclaw_status: normalizedStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", org.id);
        }

        return NextResponse.json({
          organization: {
            id: org.id,
            name: org.name,
            plan: org.plan,
            openclaw_instance_id: org.openclaw_instance_id,
            openclaw_gateway_url: org.openclaw_gateway_url,
            openclaw_status: normalizedStatus,
          },
        });
      }
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        plan: org.plan,
        openclaw_instance_id: org.openclaw_instance_id,
        openclaw_gateway_url: org.openclaw_gateway_url,
        openclaw_status: org.openclaw_status,
      },
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/provision
 * Delete the organization's OpenClaw instance
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!org || !org.openclaw_instance_id) {
      return NextResponse.json({ error: "No instance to delete" }, { status: 400 });
    }

    // Import deleteInstance dynamically to avoid issues
    const { deleteInstance } = await import("@/lib/provisioning-client");
    const deleteResult = await deleteInstance(org.openclaw_instance_id);

    if (!deleteResult.success) {
      return NextResponse.json({
        error: deleteResult.error || "Failed to delete instance",
      }, { status: 500 });
    }

    // Clear instance details from organization
    await supabase
      .from("organizations")
      .update({
        openclaw_instance_id: null,
        openclaw_gateway_url: null,
        openclaw_auth_token: null,
        openclaw_status: "not_provisioned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", org.id);

    // Also clear from user_gateways
    await supabase
      .from("user_gateways")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete instance error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
