import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Onboarding — Dopl" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Dynamic import of the client component
  const { default: OnboardingContent } = await import("./page-content");
  return <OnboardingContent />;
}
