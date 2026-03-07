"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-grid/60 hover:text-forest hover:bg-forest/5 transition-colors"
    >
      Sign out
    </button>
  );
}
