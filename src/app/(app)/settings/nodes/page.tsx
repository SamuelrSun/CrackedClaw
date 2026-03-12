import { getUserProfile } from "@/lib/supabase/data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NodesPageClient from "./client";

export const metadata = {
  title: "Device Management - Dopl",
};

export default async function NodesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const profile = await getUserProfile(user.id);

  return (
    <NodesPageClient 
      profile={profile}
    />
  );
}
