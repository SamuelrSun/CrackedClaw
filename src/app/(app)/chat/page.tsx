import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatPageContent from "./page-content";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chat — Dopl" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: { c?: string; intro?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/chat`);
  }

  const initialConversationId = searchParams?.c || undefined;

  return <ChatPageContent initialConversationId={initialConversationId} />;
}
