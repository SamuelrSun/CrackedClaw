import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { uninstallSkill } from '@/lib/skills/store';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  await uninstallSkill(user.id, params.id);
  return jsonResponse({ message: 'Skill uninstalled' });
}
