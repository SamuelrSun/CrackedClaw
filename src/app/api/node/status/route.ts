import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { getNodeStatus } from '@/lib/node/status';

export const dynamic = 'force-dynamic';

// GET /api/node/status - Get current user's node status
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const status = await getNodeStatus(user.id);
  return jsonResponse(status);
}
