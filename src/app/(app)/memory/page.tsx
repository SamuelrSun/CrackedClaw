import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = { title: "Memory — Dopl" };

/**
 * /memory now redirects to /brain.
 * The unified Brain tab shows both explicit memories and learned preferences.
 * The old MemoryClient component is preserved in client.tsx for Phase 4 cleanup.
 */
export default async function MemoryPage() {
  redirect('/brain');
}
