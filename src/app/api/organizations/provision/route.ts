import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

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
 * "Provision" an organization — in the serverless architecture this just means
 * creating the org record in Supabase with default settings. No instance needed.
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
    const force_new: boolean = body.force_new === true;

    let organizationId!: string;
    let isNewOrganization = false;

    if (!force_new) {
      // Check if user already has an org
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOrg) {
        // Already has an org — mark as active and return success
        organizationId = existingOrg.id;
        await supabase
          .from("organizations")
          .update({ openclaw_status: "running", updated_at: new Date().toISOString() })
          .eq("id", organizationId);
      } else {
        isNewOrganization = true;
      }
    } else {
      isNewOrganization = true;
    }

    if (isNewOrganization) {
      const baseSlug = organization_name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "org";
      const uniqueSlug = `${baseSlug}-${user.id.slice(0, 8)}`;

      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({
          name: organization_name,
          slug: uniqueSlug,
          owner_id: user.id,
          openclaw_status: "running",
          settings: {},
        })
        .select()
        .single();

      if (createError || !newOrg) {
        const errMsg = createError?.message || "Failed to create organization";
        if (errMsg.includes("unique") || errMsg.includes("duplicate")) {
          const fallbackSlug = `${baseSlug}-${Date.now()}`;
          const { data: retryOrg, error: retryError } = await supabase
            .from("organizations")
            .insert({
              name: organization_name,
              slug: fallbackSlug,
              owner_id: user.id,
              openclaw_status: "running",
              settings: {},
            })
            .select()
            .single();
          if (retryError || !retryOrg) {
            return NextResponse.json({ error: "Failed to create organization: " + (retryError?.message || "unknown") }, { status: 500 });
          }
          organizationId = retryOrg.id;
        } else {
          return NextResponse.json({ error: "Failed to create organization: " + errMsg }, { status: 500 });
        }
      } else {
        organizationId = newOrg.id;
      }

      await supabase
        .from("profiles")
        .update({ organization_id: organizationId })
        .eq("id", user.id);
    }

    // ── Provision OpenClaw gateway instance on DO server ──
    if (isNewOrganization) {
      const provisioningUrl = process.env.PROVISIONING_API_URL;
      const provisioningSecret = process.env.PROVISIONING_API_SECRET;

      if (provisioningUrl && provisioningSecret) {
        try {
          const provRes = await fetch(`${provisioningUrl}/api/provision`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${provisioningSecret}`,
            },
            body: JSON.stringify({
              organization_id: organizationId,
              organization_name,
              user_display_name: user_display_name || undefined,
              agent_name: agent_name || undefined,
              use_case: use_case || undefined,
            }),
          });

          if (provRes.ok) {
            const provData = await provRes.json();
            if (provData.success && provData.instance) {
              // Store operator_device_token in settings so we can approve node pairings later
              const settingsUpdate: Record<string, unknown> = {};
              if (provData.instance.operator_device_token) {
                settingsUpdate.operator_device_token = provData.instance.operator_device_token;
              }

              await supabase
                .from("organizations")
                .update({
                  openclaw_gateway_url: provData.instance.gateway_url,
                  openclaw_auth_token: provData.instance.auth_token,
                  openclaw_instance_id: provData.instance.id,
                  openclaw_status: "running",
                  updated_at: new Date().toISOString(),
                  ...(Object.keys(settingsUpdate).length > 0 ? { settings: settingsUpdate } : {}),
                })
                .eq("id", organizationId);
            }
          } else {
            const errText = await provRes.text().catch(() => provRes.statusText);
            console.error("DO provisioning failed:", provRes.status, errText);
            // Non-fatal: org still created, just no gateway instance
          }
        } catch (provErr) {
          console.error("DO provisioning error:", provErr);
          // Non-fatal: org still created
        }
      }
    }

    // Fetch the org to return current gateway data
    const { data: finalOrg } = await supabase
      .from("organizations")
      .select("openclaw_instance_id, openclaw_gateway_url, openclaw_status")
      .eq("id", organizationId)
      .single();

    return NextResponse.json({
      success: true,
      organization_id: organizationId,
      instance: {
        id: finalOrg?.openclaw_instance_id || organizationId,
        gateway_url: finalOrg?.openclaw_gateway_url || null,
        status: finalOrg?.openclaw_status || "running",
      },
      is_new: isNewOrganization,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Provision error:", msg, error);
    return NextResponse.json({ error: "Internal server error: " + msg }, { status: 500 });
  }
}

/**
 * GET /api/organizations/provision
 * Get current organization status
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!org) {
      return NextResponse.json({ organization: null });
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        plan: org.plan,
        openclaw_instance_id: org.openclaw_instance_id || null,
        openclaw_gateway_url: org.openclaw_gateway_url || null,
        openclaw_status: org.openclaw_status || "running",
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
 * No-op in serverless architecture — organizations can't be "deleted" this way.
 */
export async function DELETE() {
  return NextResponse.json({ success: true, message: "No instance to delete in serverless mode" });
}
