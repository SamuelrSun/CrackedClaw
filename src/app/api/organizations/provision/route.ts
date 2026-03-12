import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/organizations/provision
 * Provision a user's OpenClaw instance — stores data directly on the profile.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const user_display_name: string | undefined =
      body.user_display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      undefined;
    const agent_name: string | undefined = body.agent_name;
    const use_case: string | undefined = body.use_case;
    const force_new: boolean = body.force_new === true;

    // Check if user already has an instance
    const { data: profile } = await supabase
      .from("profiles")
      .select("instance_id, gateway_url, auth_token, instance_status, instance_settings")
      .eq("id", user.id)
      .single();

    const hasInstance = !force_new && profile?.instance_id;

    if (!hasInstance) {
      // Provision a new OpenClaw gateway instance on DO server
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
              user_id: user.id,
              user_display_name: user_display_name || undefined,
              agent_name: agent_name || undefined,
              use_case: use_case || undefined,
            }),
          });

          if (provRes.ok) {
            const provData = await provRes.json();
            if (provData.success && provData.instance) {
              const settingsUpdate: Record<string, unknown> = {
                ...(profile?.instance_settings || {}),
              };
              if (provData.instance.operator_device_token) {
                settingsUpdate.operator_device_token = provData.instance.operator_device_token;
              }

              await supabase
                .from("profiles")
                .update({
                  instance_id: provData.instance.id,
                  gateway_url: provData.instance.gateway_url,
                  auth_token: provData.instance.auth_token,
                  instance_status: "running",
                  instance_settings: settingsUpdate,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);
            }
          } else {
            const errText = await provRes.text().catch(() => provRes.statusText);
            console.error("DO provisioning failed:", provRes.status, errText);
            // Non-fatal: profile still exists, just no gateway instance yet
          }
        } catch (provErr) {
          console.error("DO provisioning error:", provErr);
          // Non-fatal
        }
      } else {
        // No provisioning server configured — mark as running anyway (dev mode)
        await supabase
          .from("profiles")
          .update({
            instance_status: "running",
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    }

    // Fetch the updated profile to return current instance data
    const { data: finalProfile } = await supabase
      .from("profiles")
      .select("instance_id, gateway_url, instance_status")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      organization_id: user.id,
      instance: {
        id: finalProfile?.instance_id || user.id,
        gateway_url: finalProfile?.gateway_url || null,
        status: finalProfile?.instance_status || "running",
      },
      is_new: !hasInstance,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Provision error:", msg, error);
    return NextResponse.json({ error: "Internal server error: " + msg }, { status: 500 });
  }
}

/**
 * GET /api/organizations/provision
 * Get current provisioning / instance status
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
      .select("id, plan, instance_id, gateway_url, instance_status")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ organization: null });
    }

    return NextResponse.json({
      organization: {
        id: profile.id,
        name: user.user_metadata?.full_name || user.email || "My Account",
        plan: profile.plan,
        openclaw_instance_id: profile.instance_id || null,
        openclaw_gateway_url: profile.gateway_url || null,
        openclaw_status: profile.instance_status || "running",
      },
    });
  } catch (error) {
    console.error("Get provision status error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/provision
 * No-op — instances are managed via the provisioning server directly.
 */
export async function DELETE() {
  return NextResponse.json({ success: true, message: "No instance to delete in serverless mode" });
}
