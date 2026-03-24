import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = { title: "Memory — Dopl" };

/**
 * /memory now redirects to /brain.
 * The unified Brain tab shows both explicit memories and learned preferences.
 */
export default async function MemoryPage() {
  redirect('/brain');
}
