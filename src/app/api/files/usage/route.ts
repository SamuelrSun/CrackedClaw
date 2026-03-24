import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// GET /api/files/usage — returns user's storage usage
// Response: { totalBytes, totalFiles, memoryFiles, tempFiles, limitBytes }
export async function GET() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: files, error } = await supabase
    .from('files')
    .select('id, size, mode')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }

  const allFiles = files || [];
  const totalBytes = allFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  const memoryFiles = allFiles.filter(f => f.mode === 'memory').length;
  const tempFiles = allFiles.filter(f => f.mode === 'temp').length;

  return NextResponse.json({
    totalBytes,
    totalFiles: allFiles.length,
    memoryFiles,
    tempFiles,
    limitBytes: 100 * 1024 * 1024, // 100MB
  });
}
