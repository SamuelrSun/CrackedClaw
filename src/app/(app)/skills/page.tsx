import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SkillsClient } from "./client";

export const dynamic = 'force-dynamic';
export const metadata = { title: "Skills — Dopl" };

export default async function SkillsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/skills");

  // Fetch installed skills from the installed_skills table
  const { data: installedSkills } = await supabase
    .from('installed_skills')
    .select('skill_id')
    .eq('user_id', user.id);

  const installedSlugs = (installedSkills || []).map((s: { skill_id: string }) => s.skill_id);

  return <SkillsClient initialInstalledSlugs={installedSlugs} />;
}
