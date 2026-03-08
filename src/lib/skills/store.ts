/**
 * Skill Store — install/uninstall skills for a user and sync to AI memory.
 */

import { createClient } from '@/lib/supabase/server';
import { getSkillById, getInstalledSkillsPrompt, type SkillDefinition } from './registry';

export interface InstalledSkill {
  id: string;
  user_id: string;
  skill_id: string;
  skill_name: string;
  version: string;
  source: string;
  installed_at: string;
}

export async function getInstalledSkills(userId: string): Promise<InstalledSkill[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('installed_skills')
    .select('*')
    .eq('user_id', userId)
    .order('installed_at', { ascending: false });
  return data || [];
}

export async function installSkill(userId: string, skillId: string): Promise<InstalledSkill | null> {
  const skill = getSkillById(skillId);
  if (!skill) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('installed_skills')
    .upsert({
      user_id: userId,
      skill_id: skillId,
      skill_name: skill.name,
      version: skill.version,
      source: skill.source,
    }, { onConflict: 'user_id,skill_id' })
    .select()
    .single();

  if (data) await syncSkillsToMemory(userId);
  return data;
}

export async function uninstallSkill(userId: string, skillId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('installed_skills').delete().eq('user_id', userId).eq('skill_id', skillId);
  await syncSkillsToMemory(userId);
}

export async function isSkillInstalled(userId: string, skillId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('installed_skills')
    .select('id')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .single();
  return !!data;
}

/**
 * Write installed skills to the user's AI memory so the AI knows what it can do.
 */
export async function syncSkillsToMemory(userId: string): Promise<void> {
  const skills = await getInstalledSkills(userId);
  if (!skills.length) return;

  const supabase = await createClient();
  const skillsList = skills.map(s => `- ${s.skill_name} (v${s.version})`).join('\n');
  const content = `## Installed Skills\nYou have the following skills installed — use them proactively:\n${skillsList}`;

  // Upsert a memory entry for installed skills
  try {
    await supabase.from('memories').upsert({
      user_id: userId,
      key: 'installed_skills',
      content,
      type: 'system',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' });
  } catch {
    // Memory table may not have this exact schema — fail silently
  }
}

/**
 * Build the skills portion of the system prompt for a user.
 */
export async function buildSkillsSystemPrompt(userId: string): Promise<string> {
  const skills = await getInstalledSkills(userId);
  const ids = skills.map(s => s.skill_id);
  return getInstalledSkillsPrompt(ids);
}
