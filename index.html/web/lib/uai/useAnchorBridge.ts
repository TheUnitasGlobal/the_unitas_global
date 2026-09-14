'use client';

/**
 * REV-25 MISSION 1 -- the React face of the anchor bridge.
 *
 * One hook, mounted once inside `ExploreDeeper`, which is the single block
 * every U-AI popup and the tower already render. Repairing it there repairs
 * the tower, the /u-ai page, the module rankings, the global-ranking fallback
 * and the keyword tiers at once -- rather than patching one host and leaving
 * the other four anchorless.
 *
 * It holds no cache of its own: `anchorBridge` owns the memory tier, the
 * localStorage tier and the in-flight map, so a tower mounting twelve blocks
 * on one keyword still spends exactly one resolution -- and a second visit
 * spends none. The hook's whole job is to stop listening once the block that
 * asked has gone away; it never aborts the shared work (see `bridgeTerm`).
 */
import { useEffect, useRef, useState } from 'react';
import { bridgeAnchor, needsAnchorBridge, type AnchorBridgeOptions } from './anchorBridge';
import { anchorKey, type DeeperAnchor } from './deeperAnchor';

export interface AnchorBridgeState {
  /** The upgraded entity anchor, or `null` while unknown / not applicable. */
  bridged: DeeperAnchor | null;
  /** True while a resolution is outstanding for this anchor. */
  bridging: boolean;
}

export function useAnchorBridge(anchor: DeeperAnchor | null | undefined, opts?: AnchorBridgeOptions): AnchorBridgeState {
  const [state, setState] = useState<AnchorBridgeState>({ bridged: null, bridging: false });
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  // Identity of the SUBJECT, not of the object: a parent that rebuilds the
  // anchor every render must not restart the bridge every render.
  const key = anchor ? `${anchor.lang}|${anchorKey(anchor)}|${anchor.disambiguation ? 'd' : ''}` : '';

  useEffect(() => {
    const current = anchorRef.current;
    if (!needsAnchorBridge(current)) {
      // The overwhelmingly common case -- an anchor that already carries an
      // identifier, or a host in sources-only mode. Return the SAME state
      // object so React bails out instead of re-rendering every popup once
      // more on mount.
      setState((prev) => (prev.bridged === null && !prev.bridging ? prev : { bridged: null, bridging: false }));
      return;
    }
    let live = true;
    setState({ bridged: null, bridging: true });
    bridgeAnchor(current, optsRef.current)
      .then((next) => {
        if (live) setState({ bridged: next, bridging: false });
      })
      .catch(() => {
        if (live) setState({ bridged: null, bridging: false });
      });
    return () => {
      live = false;
    };
  }, [key]);

  return state;
}
