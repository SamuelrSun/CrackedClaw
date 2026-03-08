import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { installSkill } from '@/lib/skills/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { skillId } = await request.json();
  if (!skillId) return errorResponse('skillId required', 400);
  const result = await installSkill(user.id, skillId);
  if (!result) return errorResponse('Skill not found', 404);
  return jsonResponse({ skill: result, message: `${result.skill_name} installed` }, 201);
}
