import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTokenUsage, getUsageHistory } from "@/lib/supabase/data";
import UsagePageClient from "./client";

export default async function UsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const [tokenUsage, usageHistory] = await Promise.all([
    getTokenUsage(),
    getUsageHistory(30), // Last 30 days
  ]);

  return (
    <UsagePageClient 
      initialUsage={tokenUsage}
      initialHistory={usageHistory}
    />
  );
}
