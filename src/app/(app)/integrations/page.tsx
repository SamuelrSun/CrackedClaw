import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getIntegrations } from "@/lib/supabase/data";
import IntegrationsPageClient from "./client";

export const dynamic = 'force-dynamic';

export const metadata = { title: "Integrations — Dopl" };

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const integrations = await getIntegrations();
  return <IntegrationsPageClient initialIntegrations={integrations} />;
}
