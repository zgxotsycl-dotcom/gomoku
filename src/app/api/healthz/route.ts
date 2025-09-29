import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const aiBase = process.env.SWAP2_SERVER_URL || process.env.NEXT_PUBLIC_AI_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? true : false;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? true : false;

  return NextResponse.json({
    ok: true,
    aiConfigured: !!aiBase,
    supabaseConfigured: supabaseUrl && supabaseAnon,
  });
}
