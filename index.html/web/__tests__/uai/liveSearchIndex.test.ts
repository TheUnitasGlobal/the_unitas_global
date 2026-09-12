import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLiveIndex, mergeLiveResults, searchLiveIndex, type LiveIndexLabels } from '@/lib/uai/liveSearchIndex';
import type { ShortcutGroup } from '@/lib/hotIssues';

// REV-21 §5.2 -- the typing dropdown's local corpus must only ever surface
// context-matching keywords. Founder-reported regression: typing '사'
// listed '임대' / '매칭' / '관계' / '영화' because the old matcher hit any
// syllable anywhere inside an entry's blurb ("사람", "살아", "서사"). These
// tests run the REAL production index against the REAL ko/en message files.

const NS: Record<ShortcutGroup, string> = {
  civic: 'Civic',
  hotIssue: 'HotIssue',
  finance: 'Finance',
  realEstate: 'RealEstate',
  dating: 'Dating',
  career: 'Career',
};

type Messages = Record<string, Record<string, unknown>>;

function load(locale: string): Messages {
  return JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as Messages;
}

function get(obj: unknown, path: string): string {
  const v = path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
  return typeof v === 'string' ? v : `<<missing:${path}>>`;
}

function labelsFor(msgs: Messages): LiveIndexLabels {
  const axisT = Object.fromEntries(
    (Object.keys(NS) as ShortcutGroup[]).map((g) => [g, (key: string) => get(msgs[NS[g]], key)]),
  ) as LiveIndexLabels['axisT'];
  return {
    axisT,
    tabLabel: (tab) => get(msgs.OmniSynapse, `tab.${tab}`),
    appDescription: (app) => get(app.family === 'email' ? msgs.Email : msgs.Social, 'openAria').replace('{brand}', app.brand),
  };
}

describe('searchLiveIndex (ko corpus)', () => {
  const index = buildLiveIndex(labelsFor(load('ko')));
  const ids = (q: string) => searchLiveIndex(index, q).map((r) => r.id);

  it("'사' returns only titles that start with a 사-family syllable", () => {
    const hits = ids('사');
    expect(hits).toContain('axis:hotIssue:society'); // 사회
    for (const stray of ['axis:dating:matchmaking', 'axis:dating:relationship', 'axis:hotIssue:movie', 'axis:realEstate:rental']) {
      expect(hits, stray).not.toContain(stray);
    }
    for (const r of searchLiveIndex(index, '사')) {
      expect(r.range?.start, r.title).toBe(0);
    }
  });

  it("'임' still reaches 임대 by its title, never through its blurb", () => {
    expect(ids('임')).toContain('axis:realEstate:rental');
    // '실시간' and '소득' sit inside the rental blurb; neither may pull it in.
    expect(ids('실')).not.toContain('axis:realEstate:rental');
    expect(ids('소')).not.toContain('axis:realEstate:rental');
  });

  it('never matches an entry through the English message key', () => {
    expect(ids('rent')).toEqual([]);
    expect(ids('realEstate')).toEqual([]);
  });

  it('keeps every result anchored to a word start of its title', () => {
    for (const q of ['ㅅ', '사', '삼', '시', 'ㅇ', '임', '주', '법']) {
      for (const r of searchLiveIndex(index, q)) {
        expect(r.range, `${q} -> ${r.title}`).not.toBeNull();
        const before = Array.from(r.title)[r.range!.start - 1];
        expect(r.range!.start === 0 || /[\s·()/-]/.test(before ?? ''), `${q} -> ${r.title}`).toBe(true);
      }
    }
  });
});

describe('searchLiveIndex (en corpus)', () => {
  const index = buildLiveIndex(labelsFor(load('en')));
  const titles = (q: string) => searchLiveIndex(index, q).map((r) => r.title);

  it('matches English titles at word starts only', () => {
    expect(titles('rent')).toContain('Rental');
    expect(titles('sa')).not.toContain('WhatsApp');
    expect(titles('r')).not.toContain('Art');
  });
});

describe('mergeLiveResults', () => {
  it('appends web rows after local ones and de-duplicates by title', () => {
    const merged = mergeLiveResults(
      [{ kind: 'axis', id: 'a', title: '사회', description: '', category: 'c', range: { start: 0, end: 1 } }],
      [
        { title: '사회', description: 'dup', url: 'https://ko.wikipedia.org/wiki/사회' },
        { title: '사회학', description: 'x', url: 'https://ko.wikipedia.org/wiki/사회학' },
      ],
      '사',
      'web',
    );
    expect(merged.map((r) => r.title)).toEqual(['사회', '사회학']);
    expect(merged[1].kind).toBe('web');
  });
});
