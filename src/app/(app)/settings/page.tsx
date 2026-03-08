import { getTokenUsage, getTeamMembersWithInvitations, getOrganization } from "@/lib/supabase/data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsPageClient from "./client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const [tokenUsage, teamData, organization] = await Promise.all([
    getTokenUsage(),
    getTeamMembersWithInvitations(user.id),
    getOrganization(user.id),
  ]);

  // Transform to match expected format
  const teamMembers = teamData.members.map(m => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    accepted_at: m.accepted_at,
  }));

  const invitations = teamData.invitations.map(i => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expires_at: i.expires_at,
    created_at: i.created_at,
  }));

  return (
    <SettingsPageClient 
      initialTokenUsage={tokenUsage} 
      initialTeamMembers={teamMembers}
      initialInvitations={invitations}
      currentUserRole={teamData.currentUserRole}
      initialOrganization={organization}
    />
  );
}
