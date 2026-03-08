import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CommandsPageClient from "./client";

export const dynamic = 'force-dynamic';

export default async function CommandsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CommandsPageClient />;
}
