import { NextRequest, NextResponse } from 'next/server'
import { validateCompanionToken, createAdminClient } from '@/app/api/companion/auth'

export const dynamic = 'force-dynamic'

// GET /api/companion/conversations — list conversations for the org owner
export async function GET(request: NextRequest) {
  const auth = await validateCompanionToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', auth.userId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[companion/conversations GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversations: data || [] })
}

// POST /api/companion/conversations — create a new conversation
export async function POST(request: NextRequest) {
  const auth = await validateCompanionToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let title = 'New Chat'
  try {
    const body = await request.json()
    if (body.title) title = String(body.title).slice(0, 200)
  } catch (_) {
    // Use default title
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: auth.userId,
      title,
      created_at: now,
      updated_at: now,
    })
    .select('id, title, created_at, updated_at')
    .single()

  if (error) {
    console.error('[companion/conversations POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
