import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddIntegrationContent from "./page-content";

export const dynamic = "force-dynamic";

export default async function AddIntegrationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AddIntegrationContent />;
}
