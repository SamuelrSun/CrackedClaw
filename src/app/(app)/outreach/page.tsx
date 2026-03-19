import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OutreachPageContent from "./page-content";

export const dynamic = "force-dynamic";

export const metadata = { title: "Outreach — Dopl" };

export default async function OutreachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/outreach");
  }

  return <OutreachPageContent />;
}
