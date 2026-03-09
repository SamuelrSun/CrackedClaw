"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

const PRE_AUTH_KEY = "cc_pre_auth";

export default function ProvisionPage() {
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      // Parse context — prefer URL param, fall back to localStorage
      let ctx = { userName: "", agentName: "", useCase: "" };
      const ctxParam = params.get("ctx");
      if (ctxParam) {
        try { ctx = { ...ctx, ...JSON.parse(decodeURIComponent(ctxParam)) }; } catch { /* ignore */ }
      } else {
        const stored = localStorage.getItem(PRE_AUTH_KEY);
        if (stored) { try { ctx = { ...ctx, ...JSON.parse(stored) }; } catch { /* ignore */ } }
      }

      try {
        const res = await fetch("/api/organizations/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_display_name: ctx.userName,
            agent_name: ctx.agentName,
            use_case: ctx.useCase,
          }),
        });
        const data = await res.json();
        // Success or already provisioned — either way go to chat
        if (res.ok || data.organization?.openclaw_gateway_url || data.error?.includes("already has a provisioned")) {
          localStorage.removeItem(PRE_AUTH_KEY);
        }
      } catch { /* silent — still go to chat */ }

      window.location.href = "/chat";
    }

    run();
  }, [params]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-forest flex items-center justify-center mx-auto">
          <span className="text-white font-header font-bold text-sm">CC</span>
        </div>
        <div className="flex gap-[5px] justify-center">
          <span className="w-2 h-2 bg-forest/30 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-forest/30 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-forest/30 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
        <p className="font-mono text-[11px] text-grid/50 uppercase tracking-wide">Setting up your agent</p>
      </div>
    </div>
  );
}
