"use client";

import { useEffect, useState } from "react";
import OutreachClient from "./client";

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  status: "setup" | "scanning" | "active" | "paused";
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export default function OutreachPageContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const res = await fetch("/api/outreach/campaigns");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCampaigns(data.campaigns || []);
        }
      } catch (err) {
        console.error("Failed to load campaigns:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Navbar skeleton */}
        <nav className="shrink-0 h-[48px] md:h-[56px] bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex items-center px-6">
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-12 rounded bg-white/[0.06] animate-pulse" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="w-2 h-2 rounded-sm bg-white/[0.08] animate-pulse" />
            <div className="h-2.5 w-12 rounded bg-white/[0.06] animate-pulse" />
            <div className="w-7 h-7 rounded-full bg-white/[0.06] animate-pulse" />
          </div>
        </nav>
        {/* Content skeleton */}
        <div className="flex-1 flex gap-[7px] min-h-0">
          <aside className="hidden md:flex shrink-0 w-72 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex-col" />
          <div className="flex-1 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
          <aside className="hidden md:flex shrink-0 w-80 bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex-col" />
        </div>
      </div>
    );
  }

  return (
    <OutreachClient
      initialCampaigns={campaigns}
      onCampaignsChange={setCampaigns}
    />
  );
}
