import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { buildDocumentGraph, type SecondBrainNote } from '@/lib/lifeOs/secondBrain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Same auth shape as ../notes/route.ts -- see that file's header comment. */
export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('second_brain_notes')
    .select('id, title, content, tags, embedding, created_at, updated_at')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  const notes: SecondBrainNote[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return NextResponse.json({ ok: true, graph: buildDocumentGraph(notes) });
}
