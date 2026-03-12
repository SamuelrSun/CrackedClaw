import { NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Admin Supabase client using service role key — bypasses RLS.
 * Only used in server-side API routes, never exposed to the client.
 */
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl, serviceRoleKey)
}

/**
 * Validate the X-Companion-Token header by looking up the profile
 * whose auth_token matches the provided token.
 * Returns { userId } on success, null on failure.
 */
export async function validateCompanionToken(
  request: NextRequest
): Promise<{ userId: string } | null> {
  const token = request.headers.get('X-Companion-Token')
  if (!token) return null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_token', token)
    .limit(1)
    .single()

  if (error || !data?.id) return null

  return { userId: data.id }
}
