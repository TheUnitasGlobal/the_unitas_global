/**
 * REV-19 §1 -- the site-wide DEEP MODAL HISTORY STACK.
 *
 * One coordinator owns every same-document history entry that a popup,
 * dialog tower, dropdown, entry gate or search level parks above the page,
 * so the device's back gesture closes the open surfaces ONE AT A TIME in
 * reverse order of opening, and only once nothing is left does the press
 * reach ExitGuard's sentinel buffer (the exit confirm on the main home).
 *
 * Contract with the rest of the site (lib/exit/appExit.ts, ExitGuard):
 *  - every entry this module pushes spreads the live `history.state`, so
 *    Next 14.2's `__NA` flag + router tree and ExitGuard's sentinel
 *    marker / depth ride along untouched; it adds ONE key,
 *    `MODAL_STACK_KEY` (`unitasModalStack`): the cumulative list of layer
 *    tokens whose entries sit at or below that entry. The key starts with
 *    `unitas`, so ExitGuard's `foreignEntryOnTop()` and the head bootstrap's
 *    `foreign()` yield to it (no sentinel refill on top of a modal entry).
 *  - a push only ever happens inside a user activation (Chromium's history
 *    manipulation intervention marks activation-less entries skippable). A
 *    layer opened outside a gesture -- an F5 surface restore, a programmatic
 *    open -- is registered at once but its entry is DEFERRED to the next
 *    activation gesture; until then a back press still closes it, because
 *    resolution compares the OPEN layers against the LANDED entry's stack,
 *    not entry counts.
 *  - closing programmatically (X, backdrop, Escape, gate eviction, unmount)
 *    walks history back over the layer's own entry with `history.go(-1)`
 *    so no dead entry is left to swallow the next back press; while that
 *    traversal is in flight every new push is queued and replayed in order
 *    once the popstate lands (or after `TRAVERSAL_TIMEOUT_MS`), so a
 *    same-tick "close A, open B" hand-off keeps its order.
 *  - a pop that lands on an entry whose stack names a token that is no
 *    longer open (a dead entry left by a route change, a forward traversal
 *    onto a closed layer) is skipped transparently with one more
 *    `history.go(-1)`; the walk is finite -- it ends at the first entry
 *    without the key (a sentinel or the page's real entry).
 *  - `claimPop(event)` answers "was this popstate the modal stack's?" the
 *    same way no matter which listener (this module's or ExitGuard's) asks
 *    first: the verdict is memoised per event object.
 *
 * Pure core + injectable host so the whole state machine runs under vitest
 * in the node environment; `getModalStack()` binds it to `window` lazily.
 */

export const MODAL_STACK_KEY = 'unitasModalStack';

/** How long a programmatic traversal may take before queued work proceeds
 *  without it (engines never fire popstate for an out-of-range delta). */
export const TRAVERSAL_TIMEOUT_MS = 400;

/** Activation-triggering input events (HTML spec) -- mirrors
 *  `EXIT_GUARD_ACTIVATION_EVENTS` so a deferred entry is born in exactly
 *  the gestures ExitGuard trusts for its own sentinels. */
export const MODAL_ACTIVATION_EVENTS = ['mousedown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

export interface ModalHistoryHost {
  getState(): unknown;
  pushState(state: Record<string, unknown>, url?: string): void;
  /** Same-document traversal; the host fires `popstate` asynchronously. */
  go(delta: number): void;
  addEventListener(type: string, listener: (event: unknown) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event: unknown) => void, capture?: boolean): void;
  /** True while a user activation is available for a history push. Hosts
   *  that cannot tell (no `navigator.userActivation`) answer true. */
  activationActive(): boolean;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ModalLayerHandle {
  /** Unique token of this open instance (`<id>#<seq>`). */
  readonly token: string;
  /** Programmatic close (X / backdrop / Escape / unmount). Idempotent. */
  release(): void;
  /** True while this layer is the TOPMOST open layer -- the one an Escape
   *  press belongs to. DOM order is no guide (long-lived portals sit early
   *  in <body>); the stack's own order is. */
  isTop(): boolean;
}

interface Layer {
  token: string;
  id: string;
  onBack: () => void;
  /** This layer's history entry has been pushed. */
  entried: boolean;
  url?: string | (() => string);
}

/** Next 14.2 app-router private history keys (see lib/exit/appExit.ts). */
const NEXT_ROUTER_KEYS = ['__NA', '_N', '__PRIVATE_NEXTJS_INTERNALS_TREE'];

/** Pure: the token list an entry's state carries (never the live object). */
export function readModalStack(state: unknown): string[] {
  if (!state || typeof state !== 'object') return [];
  const raw = (state as Record<string, unknown>)[MODAL_STACK_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/** Pure: what a pop that landed on `landed` means for the `open` layers
 *  (both bottom -> top). `close` is top -> bottom. `dead` = the landed entry
 *  names a token nothing open owns any more -> the entry must be skipped. */
export function resolvePop(open: readonly string[], landed: readonly string[]): { close: string[]; dead: boolean } {
  const landedSet = new Set(landed);
  const openSet = new Set(open);
  const close = open.filter((token) => !landedSet.has(token)).reverse();
  const dead = landed.some((token) => !openSet.has(token));
  return { close, dead };
}

export interface PushOptions {
  /** URL for the layer's own entry (a Quantum White surface hash). The
   *  entry is pushed WITHOUT Next's private router keys so the app router's
   *  patched pushState registers the URL as canonical (otherwise its next
   *  history write would erase the hash); Next copies `__NA` + its tree
   *  back onto the entry itself. Every other key (ExitGuard's sentinels,
   *  the stack) is preserved. Resolved lazily at push time. */
  url?: string | (() => string);
}

export interface ModalStack {
  push(id: string, onBack: () => void, options?: PushOptions): ModalLayerHandle;
  /** True when the popstate `event` belongs to the modal stack (an open
   *  layer closed, a dead entry skipped, or our own traversal landed). */
  claimPop(event: object | null | undefined): boolean;
  /** Number of layers currently registered as open (entried or deferred). */
  openCount(): number;
  /** Tokens of the open layers, bottom -> top. */
  openTokens(): string[];
  /** Tear down listeners (tests / hot reload). */
  dispose(): void;
}

export function createModalStack(host: ModalHistoryHost): ModalStack {
  let layers: Layer[] = [];
  let seq = 0;
  /** A programmatic traversal is in flight: work queued until it lands. */
  let pending: { timer: unknown } | null = null;
  const queue: Array<() => void> = [];
  const claims = new WeakMap<object, boolean>();

  function currentStack(): string[] {
    try {
      return readModalStack(host.getState());
    } catch {
      return [];
    }
  }

  function baseState(): Record<string, unknown> {
    try {
      const s = host.getState();
      return s && typeof s === 'object' ? { ...(s as Record<string, unknown>) } : {};
    } catch {
      return {};
    }
  }

  /** Push the entry for `layer` now (caller guarantees activation + no
   *  pending traversal). The pushed stack = entried tokens at or below it. */
  function pushEntry(layer: Layer): void {
    if (layer.entried) return;
    const below = layers.filter((l) => l.entried).map((l) => l.token);
    const state = baseState();
    state[MODAL_STACK_KEY] = [...below, layer.token];
    let url: string | undefined;
    try {
      url = typeof layer.url === 'function' ? layer.url() : layer.url;
    } catch {
      url = undefined;
    }
    if (url) for (const key of NEXT_ROUTER_KEYS) delete state[key];
    try {
      host.pushState(state, url);
      layer.entried = true;
    } catch {
      // history unavailable (embedded webview edge cases) -- the layer stays
      // open without an entry; back presses still resolve against the open
      // list, they just cannot be intercepted by the browser.
    }
  }

  function flushDeferred(): void {
    if (pending) return;
    for (const layer of layers) {
      if (!layer.entried) {
        if (!host.activationActive()) return;
        pushEntry(layer);
      }
    }
  }

  function settle(): void {
    if (!pending) return;
    host.clearTimeout(pending.timer);
    pending = null;
    const work = queue.splice(0, queue.length);
    for (const fn of work) fn();
    flushDeferred();
  }

  function traverse(delta: number): void {
    const timer = host.setTimeout(() => {
      if (pending && pending.timer === timer) settle();
    }, TRAVERSAL_TIMEOUT_MS);
    pending = { timer };
    try {
      host.go(delta);
    } catch {
      settle();
    }
  }

  function onPop(event: unknown): void {
    // A popstate whose entry carries NO state is not a traversal onto
    // anything this site wrote (every entry of ours -- sentinels, layers,
    // the page's own entry -- carries Next's `__NA` at least): it is the
    // artefact of a same-URL fragment navigation (a `location.assign` /
    // address-bar re-entry of the current URL replaces the entry with a
    // null state and fires popstate). Nothing opened or closed; ignore.
    const state = event && typeof event === 'object' ? (event as { state?: unknown }).state : undefined;
    if (state === null || state === undefined) {
      if (event && typeof event === 'object') claims.set(event, false);
      return;
    }
    const claimed = claimPop(event as object);
    const landed = currentStack();
    // Our own traversal landing (a programmatic release) may only close
    // layers that actually HAVE an entry above the landing point -- a layer
    // still waiting for its gesture (deferred / queued) is not touched. A
    // USER pop closes deferred layers too: that is the F5-restore case.
    const candidates = pending ? layers.filter((l) => l.entried) : layers;
    const { close, dead } = resolvePop(
      candidates.map((l) => l.token),
      landed,
    );
    if (close.length > 0) {
      const closing = layers.filter((l) => close.includes(l.token)).reverse();
      layers = layers.filter((l) => !close.includes(l.token));
      for (const layer of closing) {
        try {
          layer.onBack();
        } catch {
          // a throwing close handler must not strand the rest of the stack.
        }
      }
    }
    if (pending) {
      settle();
    }
    if (dead && !pending) {
      // Landed on an entry nothing open owns -> step over it. Finite: the
      // walk stops at the first entry without the key.
      traverse(-1);
      return;
    }
    if (claimed) flushDeferred();
  }

  function claimPop(event: object | null | undefined): boolean {
    if (event && typeof event === 'object') {
      const memo = claims.get(event);
      if (memo !== undefined) return memo;
    }
    const landed = currentStack();
    const verdict = pending !== null || layers.length > 0 || landed.length > 0;
    if (event && typeof event === 'object') claims.set(event, verdict);
    return verdict;
  }

  function onActivation(): void {
    flushDeferred();
  }

  host.addEventListener('popstate', onPop, false);
  for (const type of MODAL_ACTIVATION_EVENTS) host.addEventListener(type, onActivation, true);

  function push(id: string, onBack: () => void, options: PushOptions = {}): ModalLayerHandle {
    seq += 1;
    const layer: Layer = { token: `${id}#${seq}`, id, onBack, entried: false, url: options.url };
    layers.push(layer);
    const attempt = () => {
      if (!layers.includes(layer) || layer.entried) return;
      if (!host.activationActive()) return; // deferred to the next gesture
      pushEntry(layer);
    };
    if (pending) queue.push(attempt);
    else attempt();

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const index = layers.indexOf(layer);
      if (index === -1) return; // already closed by a traversal
      layers.splice(index, 1);
      if (!layer.entried) return;
      const run = () => {
        // Only walk back when this layer's entry is the CURRENT one -- after
        // a router replace (locale switch) or with entried layers still open
        // above it, a traversal would drag the visitor somewhere else.
        const stack = currentStack();
        if (stack[stack.length - 1] !== layer.token) return;
        traverse(-1);
      };
      if (pending) queue.push(run);
      else run();
    };
    const isTop = () => layers.length > 0 && layers[layers.length - 1] === layer;
    return { token: layer.token, release, isTop };
  }

  return {
    push,
    claimPop,
    openCount: () => layers.length,
    openTokens: () => layers.map((l) => l.token),
    dispose: () => {
      host.removeEventListener('popstate', onPop, false);
      for (const type of MODAL_ACTIVATION_EVENTS) host.removeEventListener(type, onActivation, true);
      if (pending) host.clearTimeout(pending.timer);
      pending = null;
      layers = [];
      queue.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// browser binding
// ---------------------------------------------------------------------------

function browserHost(): ModalHistoryHost {
  return {
    getState: () => window.history.state,
    pushState: (state, url) => window.history.pushState(state, '', url),
    go: (delta) => window.history.go(delta),
    addEventListener: (type, listener, capture) =>
      window.addEventListener(type, listener as EventListener, capture ? { capture: true, passive: true } : false),
    removeEventListener: (type, listener, capture) =>
      window.removeEventListener(type, listener as EventListener, capture ? { capture: true } : false),
    activationActive: () => {
      try {
        const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
        return ua ? ua.isActive : true;
      } catch {
        return true;
      }
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  };
}

let singleton: ModalStack | null = null;

/** The document-wide stack (created on first use, client only). */
export function getModalStack(): ModalStack | null {
  if (typeof window === 'undefined') return null;
  if (!singleton) singleton = createModalStack(browserHost());
  return singleton;
}

/** ExitGuard hook: true when `event` is a popstate the modal stack owns. */
export function claimModalPop(event: object | null | undefined): boolean {
  const stack = typeof window === 'undefined' ? null : singleton;
  return stack ? stack.claimPop(event) : false;
}

/** Test-only. */
export function __resetModalStackForTests(): void {
  singleton?.dispose();
  singleton = null;
}
