import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { embedText } from '@/lib/lifeOs/embeddings';
import type { SecondBrainNote } from '@/lib/lifeOs/secondBrain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TITLE_LEN = 200;
const MAX_CONTENT_LEN = 20_000;
const MAX_TAGS = 16;

/**
 * Second Brain notes CRUD (list + create). Founder-only in practice -- the
 * page itself is edge-fenced (middleware.ts, any `/sovereign` path) -- but
 * data ownership is still enforced per-user via Supabase auth, same pattern
 * as app/api/account/delete/route.ts: verify the bearer token, then scope
 * every query to that user's own id explicitly (service-role client, so RLS
 * is bypassed but the manual `.eq('user_id', ...)` filter takes its place).
 */
async function authenticate(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { user: null, supabase: null } as const;

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  return { user, supabase } as const;
}

function rowToNote(row: {
  id: string;
  title: string;
  content: string;
  tags: string[] | null;
  embedding: unknown;
  created_at: string;
  updated_at: string;
}): SecondBrainNote {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: Request) {
  const { user, supabase } = await authenticate(req);
  if (!user || !supabase) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('second_brain_notes')
    .select('id, title, content, tags, embedding, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notes: (data ?? []).map(rowToNote) });
}

export async function POST(req: Request) {
  const { user, supabase } = await authenticate(req);
  if (!user || !supabase) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  let body: { title?: unknown; content?: unknown; tags?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE_LEN) : '';
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, MAX_CONTENT_LEN) : '';
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, MAX_TAGS)
    : [];

  if (!title || !content) {
    return NextResponse.json({ ok: false, error: 'title_and_content_required' }, { status: 400 });
  }

  // Fail-open: embedding failure never blocks saving the note itself.
  const embedding = await embedText(`${title}\n\n${content}`);

  const { data, error } = await supabase
    .from('second_brain_notes')
    .insert({ user_id: user.id, title, content, tags, embedding })
    .select('id, title, content, tags, embedding, created_at, updated_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, note: rowToNote(data) });
}
