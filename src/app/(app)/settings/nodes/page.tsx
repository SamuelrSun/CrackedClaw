import { getOrganization } from "@/lib/supabase/data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NodesPageClient from "./client";

export const metadata = {
  title: "Device Management - OpenClaw Cloud",
};

export default async function NodesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const organization = await getOrganization(user.id);

  return (
    <NodesPageClient 
      organization={organization}
    />
  );
}
