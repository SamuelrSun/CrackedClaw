import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountSettingsClient from "./client";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <AccountSettingsClient 
      user={{
        id: user.id,
        email: user.email || "",
        full_name: profile?.full_name || user.user_metadata?.full_name || "",
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || "",
        created_at: user.created_at,
      }}
    />
  );
}
