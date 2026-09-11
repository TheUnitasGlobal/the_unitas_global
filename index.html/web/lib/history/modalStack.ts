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
 *    without the key (a sentinel or the page's real entry) and is capped by
 *    `DEAD_SKIP_BUDGET` per `DEAD_SKIP_WINDOW_MS` as a hard stop.
 *  - `claimPop(event)` answers "was this popstate the modal stack's?" the
 *    same way no matter which listener (this module's or ExitGuard's) asks
 *    first: the verdict is memoised per event object.
 *
 * REV-19 follow-up -- INTEGRITY LOCK against rapid / abnormal traversals:
 *  - resolution reads the popstate EVENT's own state (the entry the engine
 *    actually landed on), never a `history.state` that may lag it on a
 *    swipe-back engine; a landing that changes nothing is a no-op, so a
 *    duplicated popstate (WebKit swipe replay) can never double-close.
 *  - every layer's `onBack` runs AT MOST ONCE (a `closed` latch), and a
 *    popstate delivered re-entrantly from inside an `onBack` is parked and
 *    processed after the current dispatch completes.
 *  - programmatic traversals are OWNED: each `history.go()` we issue is
 *    expected as one Navigation-API `navigate(traverse)` intent; a traverse
 *    intent we did NOT issue marks a USER traversal in flight until its
 *    popstate lands. While one is in flight a release does NOT add its own
 *    `go(-1)` (the visitor's traversal is already passing over the entry;
 *    a second step would close one layer too many -- the back-press-then-X
 *    race) and new pushes wait for the landing (an entry pushed during a
 *    traversal would be orphaned as a forward entry).
 *  - queued work replays one item at a time and stops the moment an item
 *    starts a new traversal; the rest waits for that landing.
 *
 * Pure core + injectable host so the whole state machine runs under vitest
 * in the node environment; `getModalStack()` binds it to `window` lazily.
 */

export const MODAL_STACK_KEY = 'unitasModalStack';

/** How long a programmatic traversal may take before queued work proceeds
 *  without it (engines never fire popstate for an out-of-range delta). */
export const TRAVERSAL_TIMEOUT_MS = 600;

/** Hard stop for the dead-entry skip walk: at most this many consecutive
 *  programmatic skips inside one window. A history that keeps landing on
 *  dead entries (a hostile forward/back storm) parks instead of looping. */
export const DEAD_SKIP_BUDGET = 16;
export const DEAD_SKIP_WINDOW_MS = 2000;

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
  /** Monotonic clock (ms) for the dead-skip budget window. */
  now?(): number;
  /** Optional pre-commit traversal signal (Navigation API `navigate` with
   *  `navigationType === 'traverse'`): the listener fires once per
   *  same-document traversal BEFORE it commits -- for the browser's own
   *  back / forward gestures as much as for our `go()`. Returns the
   *  unsubscribe. Hosts without the API omit it; the lock then degrades to
   *  the pre-follow-up behaviour. */
  observeTraversals?(listener: () => void): () => void;
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
  /** `onBack` already ran (or the layer was released) -- never run twice. */
  closed: boolean;
  /** Registered while the visitor's traversal was already in flight: that
   *  traversal's landing predates this layer and must not close it. */
  awaitingLanding: boolean;
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

/** Pure: may one more programmatic dead-entry skip run? `count` skips have
 *  run since `since`; the budget refills once the window has elapsed. */
export function deadSkipAllowed(
  count: number,
  since: number,
  now: number,
  budget = DEAD_SKIP_BUDGET,
  windowMs = DEAD_SKIP_WINDOW_MS,
): boolean {
  if (now - since >= windowMs) return true;
  return count < budget;
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
  /** True while a traversal (ours or the visitor's) is known to be in
   *  flight -- pushes and releases are parked until it lands. */
  locked(): boolean;
  /** Tear down listeners (tests / hot reload). */
  dispose(): void;
}

export function createModalStack(host: ModalHistoryHost): ModalStack {
  let layers: Layer[] = [];
  let seq = 0;
  /** A programmatic traversal is in flight: work queued until it lands. */
  let pending: { timer: unknown } | null = null;
  /** `go()` calls we issued whose `navigate(traverse)` intent has not been
   *  observed yet -- lets a traverse intent be attributed to us or to the
   *  visitor. Reset on every settle so a no-op `go()` cannot drift it. */
  let ownTraversalsExpected = 0;
  /** The visitor's own back / forward traversal is committing right now
   *  (seen through the Navigation API); cleared by the popstate it produces
   *  or by a safety timer. */
  let userTraversal: { timer: unknown } | null = null;
  const queue: Array<() => void> = [];
  const claims = new WeakMap<object, boolean>();
  /** popstate dispatch in progress (re-entrant deliveries are parked). */
  let dispatching = false;
  const parkedPops: unknown[] = [];
  let deadSkips = { count: 0, since: 0 };

  const now = () => {
    try {
      return host.now ? host.now() : Date.now();
    } catch {
      return Date.now();
    }
  };

  function stackOf(state: unknown): string[] {
    try {
      return readModalStack(state);
    } catch {
      return [];
    }
  }

  function currentStack(): string[] {
    try {
      return stackOf(host.getState());
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

  const locked = () => pending !== null || userTraversal !== null;

  /** Push the entry for `layer` now (caller guarantees activation + no
   *  traversal in flight). The pushed stack = entried tokens at or below it. */
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
    if (locked()) return;
    for (const layer of layers) {
      if (!layer.entried) {
        if (!host.activationActive()) return;
        pushEntry(layer);
      }
    }
  }

  /** Replay parked work one item at a time; stop the moment an item starts
   *  a traversal (the rest waits for that landing). */
  function drain(): void {
    for (const layer of layers) layer.awaitingLanding = false;
    while (queue.length > 0 && !locked()) {
      const fn = queue.shift()!;
      try {
        fn();
      } catch {
        // parked work must never strand the queue behind it.
      }
    }
    flushDeferred();
  }

  function settle(): void {
    if (!pending) return;
    host.clearTimeout(pending.timer);
    pending = null;
    ownTraversalsExpected = 0;
    drain();
  }

  function clearUserTraversal(): void {
    if (!userTraversal) return;
    host.clearTimeout(userTraversal.timer);
    userTraversal = null;
  }

  function traverse(delta: number): void {
    const timer = host.setTimeout(() => {
      if (pending && pending.timer === timer) settle();
    }, TRAVERSAL_TIMEOUT_MS);
    pending = { timer };
    ownTraversalsExpected += 1;
    try {
      host.go(delta);
    } catch {
      settle();
    }
  }

  /** Close `tokens` (top -> bottom): drop them from the open list first so
   *  a re-entrant release / push inside `onBack` sees a consistent stack,
   *  then run each `onBack` exactly once. */
  function closeLayers(tokens: readonly string[]): void {
    const closing = layers.filter((l) => tokens.includes(l.token)).reverse();
    layers = layers.filter((l) => !tokens.includes(l.token));
    for (const layer of closing) {
      if (layer.closed) continue;
      layer.closed = true;
      try {
        layer.onBack();
      } catch {
        // a throwing close handler must not strand the rest of the stack.
      }
    }
  }

  function handlePop(event: unknown): void {
    // The visitor's traversal (if one was in flight) has landed.
    clearUserTraversal();
    // A popstate whose entry carries NO state is not a traversal onto
    // anything this site wrote (every entry of ours -- sentinels, layers,
    // the page's own entry -- carries Next's `__NA` at least): it is the
    // artefact of a same-URL fragment navigation (a `location.assign` /
    // address-bar re-entry of the current URL replaces the entry with a
    // null state and fires popstate). Nothing opened or closed; ignore.
    const state = event && typeof event === 'object' ? (event as { state?: unknown }).state : undefined;
    if (state === null || state === undefined) {
      if (event && typeof event === 'object') claims.set(event, false);
      drain();
      return;
    }
    const claimed = claimPop(event as object);
    // Resolve against the entry the engine says it landed on -- the event's
    // own state -- never a `history.state` read that may lag it.
    const landed = stackOf(state);
    // Our own traversal landing (a programmatic release) may only close
    // layers that actually HAVE an entry above the landing point -- a layer
    // still waiting for its gesture (deferred / queued) is not touched. A
    // USER pop closes deferred layers too (the F5-restore case) -- except
    // a layer opened AFTER that traversal had already started: the press
    // predates it, so the landing leaves it alone.
    const candidates = pending ? layers.filter((l) => l.entried) : layers.filter((l) => !l.awaitingLanding);
    const { close, dead } = resolvePop(
      candidates.map((l) => l.token),
      landed,
    );
    if (close.length > 0) {
      closeLayers(close);
      deadSkips = { count: 0, since: 0 };
    }
    // Whether this popstate settles a traversal WE issued -- decided before
    // any settling happens, since settle() itself clears `pending`.
    const wasPending = pending !== null;
    if (dead) {
      // Landed on an entry nothing open owns -> step over it. Finite: the
      // walk stops at the first entry without the key, and a hostile storm
      // of dead landings parks at the budget instead of looping.
      //
      // This decision -- and, when it fires, the corrective traverse --
      // MUST happen before settle()/drain() gets a chance to flush any
      // push that was queued behind this same traversal. Draining first
      // would let that push land its own fresh entry on top of the dead
      // one, and the corrective `go(-1)` below would then overshoot past
      // THAT entry too, closing a layer that had only just legitimately
      // opened (the "open a keyword result while its dropdown collapses"
      // race REV-20 uncovered: three nested search layers releasing in the
      // same tick leave two dead tokens on the landing the new layer's
      // queued push would otherwise ride in on).
      const t = now();
      if (deadSkipAllowed(deadSkips.count, deadSkips.since, t)) {
        if (t - deadSkips.since >= DEAD_SKIP_WINDOW_MS) deadSkips = { count: 0, since: t };
        deadSkips.count += 1;
        if (wasPending) {
          // Clear the settled traversal's bookkeeping WITHOUT draining --
          // queued work stays parked for the corrective traverse's own
          // landing (still consistent with "a push mid-traversal waits
          // for that landing", just one landing later than usual here).
          host.clearTimeout(pending!.timer);
          pending = null;
          ownTraversalsExpected = 0;
        }
        traverse(-1);
        return;
      }
      // Budget exhausted this window -- give up skipping for now rather
      // than loop; fall through so queued work is not stranded forever.
    } else {
      deadSkips = { count: 0, since: 0 };
    }
    if (wasPending) settle();
    // The landing released every lock: replay parked pushes / releases in
    // order, then give deferred layers their entry if a gesture is live.
    void claimed;
    drain();
  }

  function onPop(event: unknown): void {
    if (dispatching) {
      // Re-entrant delivery (a popstate raised from inside an onBack):
      // finish the current resolution first, then take this one.
      parkedPops.push(event);
      return;
    }
    dispatching = true;
    try {
      handlePop(event);
      while (parkedPops.length > 0) handlePop(parkedPops.shift());
    } finally {
      dispatching = false;
    }
  }

  function claimPop(event: object | null | undefined): boolean {
    if (event && typeof event === 'object') {
      const memo = claims.get(event);
      if (memo !== undefined) return memo;
    }
    const landed =
      event && typeof event === 'object' && 'state' in event ? stackOf((event as { state?: unknown }).state) : currentStack();
    const verdict = pending !== null || layers.length > 0 || landed.length > 0;
    if (event && typeof event === 'object') claims.set(event, verdict);
    return verdict;
  }

  function onActivation(): void {
    flushDeferred();
  }

  /** Navigation API pre-commit intent: ours (expected) or the visitor's. */
  function onTraverseIntent(): void {
    if (ownTraversalsExpected > 0) {
      ownTraversalsExpected -= 1;
      return;
    }
    clearUserTraversal();
    const timer = host.setTimeout(() => {
      if (userTraversal && userTraversal.timer === timer) {
        userTraversal = null;
        drain();
      }
    }, TRAVERSAL_TIMEOUT_MS);
    userTraversal = { timer };
  }

  host.addEventListener('popstate', onPop, false);
  for (const type of MODAL_ACTIVATION_EVENTS) host.addEventListener(type, onActivation, true);
  let unobserve: (() => void) | null = null;
  try {
    unobserve = host.observeTraversals ? host.observeTraversals(onTraverseIntent) : null;
  } catch {
    unobserve = null;
  }

  function push(id: string, onBack: () => void, options: PushOptions = {}): ModalLayerHandle {
    seq += 1;
    const layer: Layer = {
      token: `${id}#${seq}`,
      id,
      onBack,
      entried: false,
      closed: false,
      awaitingLanding: userTraversal !== null,
      url: options.url,
    };
    layers.push(layer);
    const attempt = () => {
      if (!layers.includes(layer) || layer.entried) return;
      if (!host.activationActive()) return; // deferred to the next gesture
      pushEntry(layer);
    };
    if (locked()) queue.push(attempt);
    else attempt();

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const index = layers.indexOf(layer);
      if (index === -1) return; // already closed by a traversal
      layers.splice(index, 1);
      layer.closed = true;
      if (!layer.entried) return;
      const run = () => {
        // Only walk back when this layer's entry is the CURRENT one -- after
        // a router replace (locale switch) or with entried layers still open
        // above it, a traversal would drag the visitor somewhere else.
        const stack = currentStack();
        if (stack[stack.length - 1] !== layer.token) return;
        // Integrity lock: the visitor's own traversal is committing right
        // now -- it passes over this entry by itself (or the dead-entry
        // skip cleans up); adding our own step would close one layer too
        // many (the back-press-then-X race).
        if (userTraversal) return;
        traverse(-1);
      };
      if (locked()) queue.push(run);
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
    locked,
    dispose: () => {
      host.removeEventListener('popstate', onPop, false);
      for (const type of MODAL_ACTIVATION_EVENTS) host.removeEventListener(type, onActivation, true);
      if (unobserve) {
        try {
          unobserve();
        } catch {
          // already gone
        }
        unobserve = null;
      }
      if (pending) host.clearTimeout(pending.timer);
      pending = null;
      clearUserTraversal();
      ownTraversalsExpected = 0;
      layers = [];
      queue.length = 0;
      parkedPops.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// browser binding
// ---------------------------------------------------------------------------

interface NavigateEventLike {
  navigationType?: string;
}

interface NavigationLike {
  addEventListener(type: string, listener: (event: NavigateEventLike) => void): void;
  removeEventListener(type: string, listener: (event: NavigateEventLike) => void): void;
}

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
    now: () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()),
    observeTraversals: (listener) => {
      const nav = (window as Window & { navigation?: NavigationLike }).navigation;
      if (!nav || typeof nav.addEventListener !== 'function') return () => undefined;
      const onNavigate = (event: NavigateEventLike) => {
        if (event && event.navigationType === 'traverse') listener();
      };
      try {
        nav.addEventListener('navigate', onNavigate);
      } catch {
        return () => undefined;
      }
      return () => {
        try {
          nav.removeEventListener('navigate', onNavigate);
        } catch {
          // already gone
        }
      };
    },
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
