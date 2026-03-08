import { getIntegrations } from "@/lib/supabase/data";
import IntegrationsPageClient from "./client";

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const integrations = await getIntegrations();
  return <IntegrationsPageClient initialIntegrations={integrations} />;
}
