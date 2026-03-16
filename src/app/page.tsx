import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeLayout from "@/components/home/layout";
import HomePage from "@/components/home/page";

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Signed-in users go straight to chat
  if (user) redirect("/chat");

  // Not signed in — show the landing page
  return (
    <HomeLayout>
      <HomePage />
    </HomeLayout>
  );
}
