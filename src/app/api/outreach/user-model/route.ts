/**
 * User Model API — cross-campaign memory for Sam's general preferences.
 *
 * GET  /api/outreach/user-model          → { profile, workflows, communication }
 * POST /api/outreach/user-model          → write a new user-level memory
 * DELETE /api/outreach/user-model?memory_id=<id> → delete a user memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mem0GetAll, mem0Write, mem0Delete } from '@/lib/memory/mem0-client';

export const dynamic = 'force-dynamic';

const USER_DOMAINS = ['user:profile', 'user:workflows', 'user:communication'] as const;
type UserDomain = (typeof USER_DOMAINS)[number];

function isUserDomain(domain: string): domain is UserDomain {
  return USER_DOMAINS.includes(domain as UserDomain);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [profile, workflows, communication] = await Promise.all([
      mem0GetAll(user.id, 'user:profile').catch(() => []),
      mem0GetAll(user.id, 'user:workflows').catch(() => []),
      mem0GetAll(user.id, 'user:communication').catch(() => []),
    ]);

    return NextResponse.json({ profile, workflows, communication });
  } catch (err) {
    console.error('[user-model] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { content, domain, importance, source } = body as {
      content?: string;
      domain?: string;
      importance?: number;
      source?: string;
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    if (!domain || !isUserDomain(domain)) {
      return NextResponse.json(
        {
          error: `domain must be one of: ${USER_DOMAINS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const id = await mem0Write(user.id, content.trim(), {
      domain,
      importance: typeof importance === 'number' ? importance : 0.7,
      source: source ?? 'outreach',
      metadata: {
        campaign_source: source ?? 'outreach',
      },
    });

    return NextResponse.json({ id, domain, content: content.trim() });
  } catch (err) {
    console.error('[user-model] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get('memory_id');

    if (!memoryId) {
      return NextResponse.json({ error: 'memory_id is required' }, { status: 400 });
    }

    await mem0Delete(memoryId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[user-model] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
