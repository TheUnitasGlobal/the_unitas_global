import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { FOUNDER_BYPASS_COOKIE } from '@/lib/foundersGate';
import { moduleForPathname } from '@/lib/moduleAccess';
import { moduleAccessName } from '@/lib/module-registry';
import { getSupabaseServerComponentClient } from '@/lib/supabase/serverComponent';
import type { ModuleLockReason } from '@/components/modules/ModuleLockPanel';

/**
 * Page-level coin gate for every route under app/[locale]/(gated)/ -- the 16
 * coin-gated modules (5 B2C + 11 ecosystems). Closes web/CLAUDE.md's first
 * "Known gap": paid module content must not render on direct navigation /
 * refresh / deep-link unless the visitor holds a LIVE module_access_grant
 * (minted for 30 min by spend_coins() -- see
 * supabase/migrations/20260902000000_module_access_grants.sql).
 *
 * On any failure the request is `redirect()`-ed to /{locale}/locked -- NOT
 * rendered inline. That matters: a Next.js layout that conditionally omits
 * `{children}` still renders the child page in parallel and serialises its
 * RSC payload into the response. redirect() throws NEXT_REDIRECT, which
 * aborts the render and returns a bodiless 307, so no paid module content
 * ever reaches the client on a locked request. (The redirect() calls are
 * kept out of the try/catch so their NEXT_REDIRECT isn't swallowed.)
 *
 * Route-group layouts don't receive the child route segment, so the module
 * is resolved from the `x-unitas-pathname` request header that middleware.ts
 * injects. Fail-closed everywhere: missing header, unconfigured Supabase,
 * auth error, or query error all redirect to the locked page. The one bypass
 * is the founder's `unitas_dev` cookie (QA), matching lib/foundersGate.ts.
 */
export default async function GatedModuleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Founder / developer QA bypass (soft pre-launch curtain convention).
  const devCookie = cookies().get(FOUNDER_BYPASS_COOKIE)?.value;
  if (devCookie === '1' || devCookie === 'true') {
    return <>{children}</>;
  }

  const entry = moduleForPathname(headers().get('x-unitas-pathname') ?? '');
  const accessName = entry ? moduleAccessName(entry.route) : null;

  const outcome = accessName
    ? await resolveAccess(accessName)
    : ('locked' as const);

  if (outcome !== 'ok') {
    const query = new URLSearchParams({ reason: outcome });
    if (entry) query.set('m', entry.route);
    redirect(`/${locale}/locked?${query.toString()}`);
  }

  return <>{children}</>;
}

async function resolveAccess(accessName: string): Promise<'ok' | ModuleLockReason> {
  const supabase = getSupabaseServerComponentClient();
  if (!supabase) return 'signin';

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'signin';

    const { data, error } = await supabase
      .from('module_access_grants')
      .select('id')
      .eq('user_id', user.id)
      .eq('module', accessName)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    return error || !data ? 'locked' : 'ok';
  } catch {
    return 'locked';
  }
}
