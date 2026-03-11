import { NextRequest, NextResponse } from 'next/server'
import { validateCompanionToken, createAdminClient } from '@/app/api/companion/auth'

export const dynamic = 'force-dynamic'

// GET /api/companion/conversations/[id]/messages — last 50 messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateCompanionToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: conversationId } = await params
  const supabase = createAdminClient()

  // Verify the conversation belongs to this user
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', auth.userId)
    .single()

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[companion/messages GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data || [] })
}

// POST /api/companion/conversations/[id]/messages — save a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateCompanionToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: conversationId } = await params

  let role: string
  let content: string
  try {
    const body = await request.json()
    role = body.role
    content = body.content
    if (!role || !content) throw new Error('Missing role or content')
    if (!['user', 'assistant', 'system'].includes(role)) throw new Error('Invalid role')
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify the conversation belongs to this user
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', auth.userId)
    .single()

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Save the message
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      created_at: now,
    })
    .select('id, role, content, created_at')
    .single()

  if (error) {
    console.error('[companion/messages POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: now })
    .eq('id', conversationId)

  return NextResponse.json(data, { status: 201 })
}
