import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { BUILTIN_SKILLS } from '@/lib/skills/registry';
import { getInstalledSkills } from '@/lib/skills/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const installed = await getInstalledSkills(user.id);
  const installedIds = new Set(installed.map(s => s.skill_id));
  const skills = BUILTIN_SKILLS.map(s => ({ ...s, installed: installedIds.has(s.id) }));
  return jsonResponse({ skills, installed: installed.length });
}
