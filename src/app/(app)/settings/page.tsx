import { getTokenUsage, getUserProfile } from "@/lib/supabase/data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsPageClient from "./client";

export const metadata = { title: "Settings — Dopl" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/login?next=/settings`);
  }

  const [tokenUsage, profile] = await Promise.all([
    getTokenUsage(),
    getUserProfile(user.id),
  ]);

  return (
    <SettingsPageClient 
      initialTokenUsage={tokenUsage} 
      initialProfile={profile}
    />
  );
}
