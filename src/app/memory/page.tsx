import { getMemoryEntries } from "@/lib/supabase/data";
import MemoryPageClient from "./client";

export const dynamic = 'force-dynamic';

export default async function MemoryPage() {
  const memoryEntries = await getMemoryEntries();
  return <MemoryPageClient initialEntries={memoryEntries} />;
}
