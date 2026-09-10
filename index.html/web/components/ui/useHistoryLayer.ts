'use client';

import { useEffect, useRef } from 'react';
import { getModalStack, type ModalLayerHandle } from '@/lib/history/modalStack';

/**
 * REV-19 §1.2 -- bind an open/closed surface to the deep modal history stack.
 *
 * While `open` is true the surface holds ONE layer: the device back gesture
 * (phone hardware back, browser back, Alt+Left, mouse X1, the PC context
 * menu's 뒤로가기) closes it through `onBack` -- and closes only it, the
 * layers beneath stay exactly as they were. Closing it any other way (X,
 * backdrop, Escape, gate eviction, unmount) releases the layer, which walks
 * history back over the surface's own entry so the next back press reaches
 * the layer below (or, with nothing left, ExitGuard's exit confirm).
 *
 * `onBack` is read through a ref so parents may pass fresh arrows every
 * render without re-registering the layer. `url` (optional) gives the
 * layer's own entry a URL -- the Quantum White surface hash -- so the entry
 * beneath keeps the URL it had before the layer opened and a back press
 * lands on a URL that matches what is on screen.
 */
export interface HistoryLayer {
  /** True while this surface's layer is the topmost open one -- the only
   *  surface an Escape press should close. True while closed / without a
   *  stack so a lone dialog never loses its own Escape. */
  isTop: () => boolean;
}

export function useHistoryLayer(
  open: boolean,
  id: string,
  onBack: () => void,
  url?: string | (() => string),
): HistoryLayer {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const urlRef = useRef(url);
  urlRef.current = url;
  const handleRef = useRef<ModalLayerHandle | null>(null);

  useEffect(() => {
    if (!open) return;
    const stack = getModalStack();
    if (!stack) return;
    const handle: ModalLayerHandle = stack.push(id, () => onBackRef.current(), {
      url: () => {
        const u = urlRef.current;
        return (typeof u === 'function' ? u() : u) ?? '';
      },
    });
    handleRef.current = handle;
    return () => {
      if (handleRef.current === handle) handleRef.current = null;
      handle.release();
    };
  }, [open, id]);

  const apiRef = useRef<HistoryLayer | null>(null);
  if (!apiRef.current) {
    apiRef.current = {
      isTop: () => {
        const handle = handleRef.current;
        if (!handle) return true;
        return handle.isTop();
      },
    };
  }
  return apiRef.current;
}
