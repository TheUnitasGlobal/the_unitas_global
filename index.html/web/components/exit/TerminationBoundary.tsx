'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { APP_TERMINATE_EVENT, isDocumentTerminated } from '@/lib/exit/appExit';

/**
 * The app's `root.unmount()` (owner instruction 2026-09-06, round 19:
 * "태스크 스위처 빈 카드 잔류 현상 격멸", item 1 -- DOM 메모리 전면 언마운트).
 *
 * Next.js's App Router hydrates the document itself and never hands out the
 * `hydrateRoot` handle, so there is no root to call `unmount()` on. This
 * boundary is the outermost CLIENT component under <body> (app/layout.tsx
 * wraps the intro splash, the audio provider, the 3D scene and every route
 * segment in it), and the moment the exit engine terminates the app in
 * place (`APP_TERMINATE_EVENT`, lib/exit/appExit.ts) it renders nothing:
 * React unmounts the entire tree beneath it, running every effect cleanup on
 * the way out -- the R3F renderer disposes its WebGL context, every
 * AudioContext closes, every timer / listener / Supabase channel is torn
 * down, every DOM node under <body> is detached and becomes collectable. No
 * scene keeps drawing, no loop keeps ticking, no request keeps firing behind
 * the terminal shroud (which lives on <html>, outside this tree, and stays).
 *
 * Only the terminal App-channel path fires the event. The ONLINE channel's
 * exit (back to the previous page, tab close) leaves the page rendered until
 * the browser has actually left it -- a refused online exit must never show
 * a blank document.
 *
 * SSR-safe and hydration-neutral: the boundary always renders its children on
 * the server and on the first client render; it only ever flips to nothing
 * after mount, from the event (or when the document was already terminated
 * before this component mounted -- a late hydration racing the tap).
 */
export function TerminationBoundary({ children }: { children: ReactNode }) {
  const [terminated, setTerminated] = useState(false);

  useEffect(() => {
    if (isDocumentTerminated()) {
      setTerminated(true);
      return;
    }
    const onTerminate = () => setTerminated(true);
    window.addEventListener(APP_TERMINATE_EVENT, onTerminate);
    return () => window.removeEventListener(APP_TERMINATE_EVENT, onTerminate);
  }, []);

  if (terminated) return null;
  return <>{children}</>;
}
