import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Auth: service role key only
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find expired temp files
    const { data: expired, error } = await supabase
      .from('files')
      .select('id, storage_path, mode')
      .eq('mode', 'temp')
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('[files/cleanup] Query error:', error);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    if (!expired?.length) {
      return NextResponse.json({ cleaned: 0 });
    }

    // Delete from storage
    const paths = expired.map(f => f.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from('temp-files').remove(paths);
    }

    // Delete from DB (file_chunks cascade)
    const ids = expired.map(f => f.id);
    await supabase.from('files').delete().in('id', ids);

    return NextResponse.json({ cleaned: ids.length });
  } catch (err) {
    console.error('[files/cleanup] Error:', err);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
