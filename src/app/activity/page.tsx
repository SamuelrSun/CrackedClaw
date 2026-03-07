import { getActivityLog } from "@/lib/supabase/data";
import ActivityPageClient from "./client";

export default async function ActivityPage() {
  // Fetch initial activity with a higher limit for the full page
  const activities = await getActivityLog({ limit: 50 });
  
  return <ActivityPageClient initialActivities={activities} />;
}
