import { describe, expect, it, vi } from 'vitest';
import {
  ALL_SITE_SLUGS,
  SITE_LINK_BOOTSTRAP,
  SITE_LINK_LIVE_FLAG,
  SITE_LINK_PENDING_KEY,
  SITE_PAGE_EVENT,
  SITE_PAGE_OPEN_STORAGE_KEY,
  consumePendingSitePage,
  groupOfSlug,
  parseSitePageHref,
  readSavedSitePage,
  readSitePageDocument,
  saveOpenSitePage,
  validateSitePageRequest,
} from '@/lib/sitePages';

// REV-21 SPEC.md §6.1 (F-2 / F-7) -- the pre-hydration site-link bootstrap
// and the modal host's plumbing. The bootstrap is an ES5 string evaluated
// against a fake window (no jsdom): a footer / legal link clicked before
// React hydrates must be captured, validated against the SAME slug set as
// parseSitePageHref, parked on `window`, mirrored to sessionStorage and
// announced on `unitas:site-page`; everything else is left to the browser.

type Listener = (event: unknown) => void;

function boot(opts: { live?: boolean } = {}) {
  const listeners = new Map<string, Listener>();
  const removed: string[] = [];
  const dispatched: Array<{ type: string; detail: unknown }> = [];
  const storage = { setItem: vi.fn() };
  const doc = { nodeType: 9 };
  const win: Record<string, unknown> = {
    addEventListener: (type: string, fn: Listener, capture: boolean) => {
      expect(capture).toBe(true);
      listeners.set(type, fn);
    },
    removeEventListener: (type: string) => {
      removed.push(type);
      listeners.delete(type);
    },
    dispatchEvent: (event: { type: string; detail: unknown }) => {
      dispatched.push(event);
      return true;
    },
  };
  if (opts.live) win[SITE_LINK_LIVE_FLAG] = true;
  class FakeCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  new Function('window', 'document', 'sessionStorage', 'CustomEvent', SITE_LINK_BOOTSTRAP)(win, doc, storage, FakeCustomEvent);
  return { win, doc, storage, listeners, removed, dispatched };
}

function node(attrs: Record<string, string>, parentNode: unknown) {
  return {
    getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
    hasAttribute: (k: string) => k in attrs,
    parentNode,
  };
}

function click(target: unknown, extra: Record<string, unknown> = {}) {
  return {
    target,
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...extra,
  };
}

describe('SITE_LINK_BOOTSTRAP (REV-21 §6.1 F-2)', () => {
  it('is ES5-only, parses, and runs against an empty environment without throwing', () => {
    expect(() => new Function(SITE_LINK_BOOTSTRAP)).not.toThrow();
    expect(() => new Function('window', 'document', 'sessionStorage', 'CustomEvent', SITE_LINK_BOOTSTRAP)({}, {}, {}, {})).not.toThrow();
    expect(SITE_LINK_BOOTSTRAP).not.toContain('=>');
    expect(SITE_LINK_BOOTSTRAP).not.toMatch(/\b(let|const)\b/);
    expect(SITE_LINK_BOOTSTRAP).not.toContain('`');
  });

  it('embeds every registered slug so it validates the same set as parseSitePageHref', () => {
    for (const slug of ALL_SITE_SLUGS) expect(SITE_LINK_BOOTSTRAP).toContain(`"${slug}"`);
    expect(SITE_LINK_BOOTSTRAP).toContain(SITE_LINK_LIVE_FLAG);
    expect(SITE_LINK_BOOTSTRAP).toContain(SITE_LINK_PENDING_KEY);
    expect(SITE_LINK_BOOTSTRAP).toContain(SITE_PAGE_OPEN_STORAGE_KEY);
    expect(SITE_LINK_BOOTSTRAP).toContain(SITE_PAGE_EVENT);
  });

  it('parks a plain click on a footer link (from a nested target) before hydration', () => {
    const b = boot();
    const anchor = node({ 'data-site-link': 'legal/terms', href: '/ko/legal/terms' }, b.doc);
    const span = node({}, anchor);
    const event = click(span);
    b.listeners.get('click')!(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(b.win[SITE_LINK_PENDING_KEY]).toEqual({ group: 'legal', slug: 'terms' });
    expect(b.storage.setItem).toHaveBeenCalledWith(SITE_PAGE_OPEN_STORAGE_KEY, JSON.stringify({ group: 'legal', slug: 'terms' }));
    expect(b.dispatched).toHaveLength(1);
    expect(b.dispatched[0].type).toBe(SITE_PAGE_EVENT);
    expect(b.dispatched[0].detail).toEqual({ group: 'legal', slug: 'terms' });
    // still armed: a second link is captured too
    const second = click(node({ 'data-site-link': 'company/about' }, b.doc));
    b.listeners.get('click')!(second);
    expect(second.preventDefault).toHaveBeenCalledTimes(1);
    expect(b.win[SITE_LINK_PENDING_KEY]).toEqual({ group: 'company', slug: 'about' });
  });

  it('leaves modifier, non-primary and already-handled clicks to the browser', () => {
    const b = boot();
    const anchor = node({ 'data-site-link': 'legal/privacy' }, b.doc);
    for (const extra of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
      const event = click(anchor, extra);
      b.listeners.get('click')!(event);
      expect(event.preventDefault, JSON.stringify(extra)).not.toHaveBeenCalled();
    }
    expect(b.win[SITE_LINK_PENDING_KEY]).toBeUndefined();
    expect(b.storage.setItem).not.toHaveBeenCalled();
  });

  it('ignores anchors outside the registry and clicks with no site link in the ancestry', () => {
    const b = boot();
    for (const target of [
      node({ 'data-site-link': 'legal/nope' }, b.doc),
      node({ 'data-site-link': 'nope/terms' }, b.doc),
      node({ 'data-site-link': '' }, b.doc), // empty marker and no href
      node({ href: '/ko/u-ai' }, b.doc),
      node({}, node({}, b.doc)),
    ]) {
      const event = click(target);
      b.listeners.get('click')!(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(b.win[SITE_LINK_PENDING_KEY]).toBeUndefined();
  });

  it('falls back to the href (with a locale prefix) when the marker attribute is empty', () => {
    const b = boot();
    const event = click(node({ 'data-site-link': '', href: '/ko/company/about?x=1#y' }, b.doc));
    b.listeners.get('click')!(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(b.win[SITE_LINK_PENDING_KEY]).toEqual({ group: 'company', slug: 'about' });
  });

  it('stands down on the first click once SiteLinkModalHost is live', () => {
    const b = boot({ live: true });
    const event = click(node({ 'data-site-link': 'legal/terms' }, b.doc));
    b.listeners.get('click')!(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(b.removed).toEqual(['click']);
    expect(b.listeners.has('click')).toBe(false);
    expect(b.win[SITE_LINK_PENDING_KEY]).toBeUndefined();
  });

  it('never stops propagation (ExitGuard still counts the click as the activation gesture)', () => {
    expect(SITE_LINK_BOOTSTRAP).not.toContain('stopPropagation');
    expect(SITE_LINK_BOOTSTRAP).not.toContain('stopImmediatePropagation');
  });
});

describe('site page request plumbing', () => {
  it('validateSitePageRequest accepts only registered group/slug pairs', () => {
    expect(validateSitePageRequest({ group: 'legal', slug: 'terms' })).toEqual({ group: 'legal', slug: 'terms' });
    expect(validateSitePageRequest({ group: 'company', slug: 'terms' })).toBeNull();
    expect(validateSitePageRequest({ group: 'legal', slug: 'nope' })).toBeNull();
    expect(validateSitePageRequest({ group: 'x', slug: 'terms' })).toBeNull();
    expect(validateSitePageRequest('legal/terms')).toBeNull();
    expect(validateSitePageRequest(null)).toBeNull();
  });

  it('parseSitePageHref resolves routes, marker values and locale-prefixed hrefs', () => {
    expect(parseSitePageHref('/ko/legal/terms')).toEqual({ group: 'legal', slug: 'terms' });
    expect(parseSitePageHref('legal/terms')).toEqual({ group: 'legal', slug: 'terms' });
    expect(parseSitePageHref('/support/help-center?x#y')).toEqual({ group: 'support', slug: 'help-center' });
    expect(parseSitePageHref('/a/b/legal/terms')).toBeNull();
    expect(parseSitePageHref('/legal/nope')).toBeNull();
    expect(parseSitePageHref('/legal')).toBeNull();
  });

  it('groupOfSlug maps every slug to its group', () => {
    for (const slug of ALL_SITE_SLUGS) {
      const group = groupOfSlug(slug);
      expect(group).not.toBeNull();
      expect(parseSitePageHref(`/${group}/${slug}`)).toEqual({ group, slug });
    }
    expect(groupOfSlug('nope')).toBeNull();
  });

  it('consumePendingSitePage takes and clears the window slot, rejecting garbage', () => {
    const g = globalThis as unknown as { window?: Record<string, unknown> };
    try {
      g.window = { [SITE_LINK_PENDING_KEY]: { group: 'support', slug: 'contact' } };
      expect(consumePendingSitePage()).toEqual({ group: 'support', slug: 'contact' });
      expect(g.window[SITE_LINK_PENDING_KEY]).toBeNull();
      expect(consumePendingSitePage()).toBeNull();
      g.window[SITE_LINK_PENDING_KEY] = { group: 'support', slug: 'nope' };
      expect(consumePendingSitePage()).toBeNull();
    } finally {
      delete g.window;
    }
    expect(consumePendingSitePage()).toBeNull(); // no window at all
  });

  it('saveOpenSitePage / readSavedSitePage mirror the open page through a store (F-7)', () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    expect(readSavedSitePage(store)).toBeNull();
    saveOpenSitePage({ group: 'legal', slug: 'privacy' }, store);
    expect(data.get(SITE_PAGE_OPEN_STORAGE_KEY)).toBe(JSON.stringify({ group: 'legal', slug: 'privacy' }));
    expect(readSavedSitePage(store)).toEqual({ group: 'legal', slug: 'privacy' });
    saveOpenSitePage(null, store);
    expect(data.has(SITE_PAGE_OPEN_STORAGE_KEY)).toBe(false);
    data.set(SITE_PAGE_OPEN_STORAGE_KEY, '{not json');
    expect(readSavedSitePage(store)).toBeNull();
    data.set(SITE_PAGE_OPEN_STORAGE_KEY, JSON.stringify({ group: 'legal', slug: 'nope' }));
    expect(readSavedSitePage(store)).toBeNull();
    expect(readSavedSitePage(null)).toBeNull();
  });
});

describe('readSitePageDocument (REV-21 §6.2 schema)', () => {
  it('accepts the sections schema and passes highlights / updated through', () => {
    const doc = readSitePageDocument({
      title: 'T',
      lede: 'L',
      sections: [
        { heading: 'A', paragraphs: ['a1', 'a2'] },
        { heading: 'B', paragraphs: ['b1'] },
      ],
      highlights: ['h1'],
      updated: '2026-09-12',
    });
    expect(doc).not.toBeNull();
    expect(doc!.sections).toHaveLength(2);
    expect(doc!.sections[0].paragraphs).toEqual(['a1', 'a2']);
    expect(doc!.highlights).toEqual(['h1']);
    expect(doc!.updated).toBe('2026-09-12');
  });

  it('promotes the pre-REV-21 body[] shape to one heading-less section instead of crashing', () => {
    const doc = readSitePageDocument({ title: 'T', lede: 'L', body: ['p1', 'p2'] });
    expect(doc).not.toBeNull();
    expect(doc!.sections).toEqual([{ heading: '', paragraphs: ['p1', 'p2'] }]);
    expect(doc!.highlights).toBeUndefined();
  });

  it('rejects malformed documents', () => {
    expect(readSitePageDocument(null)).toBeNull();
    expect(readSitePageDocument('x')).toBeNull();
    expect(readSitePageDocument({ title: 'T' })).toBeNull();
    expect(readSitePageDocument({ title: 'T', lede: 'L' })).toBeNull();
    expect(readSitePageDocument({ title: 'T', lede: 'L', sections: [{ heading: 'A', paragraphs: ['ok', 3] }] })).toBeNull();
    expect(readSitePageDocument({ title: 'T', lede: 'L', sections: [{ paragraphs: ['x'] }] })).toBeNull();
    expect(readSitePageDocument({ title: 'T', lede: 'L', sections: 'nope' })).toBeNull();
  });
});
