import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { resolveFromText, resolveIntegration } from '@/lib/integrations/resolver';

export const dynamic = 'force-dynamic';

// POST /api/integrations/resolve
// Body: { query: string } - free text like "I use Notion, Linear, and LinkedIn"
export async function POST(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  try {
    const { query } = await request.json();
    if (!query || typeof query !== 'string') return errorResponse('query required', 400);

    const resolved = resolveFromText(query);
    return jsonResponse({ resolved, count: resolved.length });
  } catch {
    return errorResponse('Failed to resolve integrations', 500);
  }
}

// GET /api/integrations/resolve?name=Attio - resolve a single service
export async function GET(request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const name = request.nextUrl.searchParams.get('name');
  if (!name) return errorResponse('name param required', 400);

  const resolved = resolveIntegration(name);
  return jsonResponse({ resolved });
}
