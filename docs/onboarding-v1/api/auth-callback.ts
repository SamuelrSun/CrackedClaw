import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { provisionInstance } from "@/lib/provisioning-client";

async function getPostAuthRedirect(origin: string, source?: string): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return `${origin}/login`;

    // Check if onboarding already complete
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();
    if (profile?.onboarding_completed) return `${origin}/chat`;

    const { data: onboarding } = await supabase
      .from("onboarding_state")
      .select("phase")
      .eq("user_id", user.id)
      .single();
    if (onboarding?.phase === "complete") return `${origin}/chat`;

    // Existing users with no onboarding go to old flow
    return source === "landing" ? `${origin}/chat` : `${origin}/onboarding`;
  } catch {
    return source === "landing" ? `${origin}/chat` : `${origin}/onboarding`;
  }
}

async function provisionForNewUser(
  origin: string,
  ctxParam: string | null
): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return `${origin}/login`;

    // Check if already provisioned
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("openclaw_gateway_url, openclaw_status")
      .eq("owner_id", user.id)
      .single();

    if (existingOrg?.openclaw_gateway_url) return `${origin}/chat`;

    // Parse onboarding context
    let userName = "";
    let agentName = "";
    let useCase = "";
    if (ctxParam) {
      try {
        const ctx = JSON.parse(decodeURIComponent(ctxParam));
        userName = ctx.userName || "";
        agentName = ctx.agentName || "";
        useCase = ctx.useCase || "";
      } catch { /* ignore */ }
    }

    // Generate workspace name
    const adjs = ["swift","bright","calm","bold","keen","crisp","clear","sharp","deep","wide"];
    const nouns = ["horizon","studio","signal","layer","stream","base","core","space","field","forge"];
    const orgName = `${adjs[Math.floor(Math.random()*adjs.length)]}-${nouns[Math.floor(Math.random()*nouns.length)]}-${Math.floor(Math.random()*9000)+1000}`;

    // Create org record
    const slug = `${orgName}-${user.id.slice(0, 8)}`;
    const now = new Date().toISOString();

    const { data: newOrg, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: orgName, slug, owner_id: user.id, openclaw_status: "provisioning" })
      .select()
      .single();

    if (orgErr || !newOrg) {
      console.error("Org creation failed:", orgErr);
      return `${origin}/chat`;
    }

    // Update profile
    await supabase.from("profiles").update({ organization_id: newOrg.id }).eq("id", user.id);

    // Provision instance
    const result = await provisionInstance(newOrg.id, orgName, { user_display_name: userName, agent_name: agentName, use_case: useCase });

    if (result.success && result.instance) {
      await supabase.from("organizations").update({
        openclaw_instance_id: result.instance.id,
        openclaw_gateway_url: result.instance.gateway_url,
        openclaw_auth_token: result.instance.auth_token,
        openclaw_status: "running",
        updated_at: now,
      }).eq("id", newOrg.id);

      await supabase.from("user_gateways").upsert({
        user_id: user.id,
        gateway_url: result.instance.gateway_url,
        auth_token: result.instance.auth_token,
        name: `${orgName} (Cloud)`,
        status: "connected",
        created_at: now,
        updated_at: now,
      }, { onConflict: "user_id" });

      // Seed onboarding state
      await supabase.from("onboarding_state").upsert({
        user_id: user.id,
        phase: "welcome",
        completed_steps: [
          ...(userName ? ["user_name_provided"] : []),
          ...(agentName ? ["agent_name_provided"] : []),
        ],
        skipped_steps: [],
        gathered_context: useCase ? { use_case: useCase, source: "landing_chat" } : {},
        suggested_workflows: [],
        agent_name: agentName || null,
        user_display_name: userName || null,
        created_at: now,
        updated_at: now,
      }, { onConflict: "user_id" });

      // Personalized welcome message
      const { data: convo } = await supabase.from("conversations").insert({
        user_id: user.id,
        title: "Welcome to CrackedClaw",
        summary: "Onboarding conversation",
        is_pinned: false,
        created_at: now,
        updated_at: now,
      }).select().single();

      if (convo) {
        const greeting = userName
          ? `Hey ${userName}! I'm ${agentName || "your agent"} — all set up and ready to go. What would you like to tackle first?`
          : "Welcome! I'm your new AI agent. What would you like to work on?";
        await supabase.from("messages").insert({
          conversation_id: convo.id,
          role: "assistant",
          content: greeting,
          created_at: now,
        });
      }
    } else {
      await supabase.from("organizations").update({ openclaw_status: "failed" }).eq("id", newOrg.id);
    }
  } catch (err) {
    console.error("Callback provision error:", err);
  }
  return `${origin}/chat`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? null;
  const type = searchParams.get("type");
  const source = searchParams.get("source") ?? undefined;
  const ctx = searchParams.get("ctx");

  const isEmailVerification =
    type === "email_verification" ||
    searchParams.get("token_hash") !== null ||
    type === "signup" ||
    type === "email";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[auth/callback] exchangeCodeForSession:", { error: error?.message });

    if (!error) {
      if (isEmailVerification) {
        return NextResponse.redirect(`${origin}/verify-email?status=success`);
      }
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Landing chat OAuth — session is now set in response cookies.
      // Redirect to /provision which handles provisioning client-side (session is available there).
      if (source === "landing") {
        const ctxEncoded = ctx ? `&ctx=${encodeURIComponent(ctx)}` : "";
        return NextResponse.redirect(`${origin}/provision?source=landing${ctxEncoded}`);
      }

      const redirectTo = await getPostAuthRedirect(origin, source);
      return NextResponse.redirect(redirectTo);
    }

    if (isEmailVerification) {
      const errorMessage = encodeURIComponent(error.message || "Verification failed");
      return NextResponse.redirect(`${origin}/verify-email?status=error&error=${errorMessage}`);
    }
  }

  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  if (tokenHash && (tokenType === "signup" || tokenType === "email")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType === "signup" ? "signup" : "email",
    });
    if (!error) return NextResponse.redirect(`${origin}/verify-email?status=success`);
    const errorMessage = encodeURIComponent(error.message || "Verification failed");
    return NextResponse.redirect(`${origin}/verify-email?status=error&error=${errorMessage}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
