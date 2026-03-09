import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatPageContent from "./page-content";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chat — CrackedClaw" };

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/chat`);
  }

  return <ChatPageContent />;
}
