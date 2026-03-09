import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MemorySettingsClient from "./client";

export const metadata = { title: "Memory — CrackedClaw" };

export default async function MemorySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings/memory");
  }

  return <MemorySettingsClient userId={user.id} />;
}
