import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import { buildPoolReport, fillTemplate, type PoolMessages } from '@/lib/uai/hyperPool';
import { HYPER_POOL_MODEL } from '@/lib/uai/hyperShortcut';
import { HYPER_ENGINES, hyperItemCount, type HyperEngineKey } from '@/lib/hyperSovereign';

const EN = en as unknown as PoolMessages;
const KO = ko as unknown as PoolMessages;

const VARIANTS: Record<HyperEngineKey, string> = {
  ideaReplicator: 'root:0',
  fateEngine: '3:logic',
  omniTwin: '2',
  chronoForge: '0:2026',
  marginInfinity: '0',
};

function texts(report: NonNullable<ReturnType<typeof buildPoolReport>>): string[] {
  return [report.headline, report.oracle, ...report.items.flatMap((it) => [it.title, it.body])];
}

describe('hyperPool fail-safe narration', () => {
  it('narrates every narrated engine deterministically with fully substituted templates', () => {
    for (const engine of HYPER_ENGINES.filter((e) => e.narrated).map((e) => e.key)) {
      const a = buildPoolReport(engine, 'coffee shop', VARIANTS[engine], EN);
      const b = buildPoolReport(engine, 'Coffee, Shop!', VARIANTS[engine], EN);
      expect(a).not.toBeNull();
      // near-duplicate seeds share one simulation + narration; only the
      // display seed keeps the visitor's own spelling
      const { seed: seedA, ...restA } = a!;
      const { seed: seedB, ...restB } = b!;
      expect(restA).toEqual(restB);
      expect(seedA).toBe('coffee shop');
      expect(seedB).toBe('coffee, shop!');
      expect(a!.model).toBe(HYPER_POOL_MODEL);
      expect(a!.pooled).toBe(true);
      expect(a!.cached).toBe(false);
      expect(a!.items).toHaveLength(hyperItemCount(engine));
      for (const s of texts(a!)) {
        expect(s.length).toBeGreaterThan(0);
        expect(s).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('refuses non-narrated engines and unparsable variants', () => {
    expect(buildPoolReport('marginInfinity', 'x', '0', EN)).toBeNull();
    expect(buildPoolReport('ideaReplicator', 'x', 'root:99', EN)).toBeNull();
    expect(buildPoolReport('fateEngine', 'x', '4:none', EN)).toBeNull();
    expect(buildPoolReport('chronoForge', 'x', '0:1999', EN)).toBeNull();
  });

  it('speaks the visitor language and falls back per key to English', () => {
    const koReport = buildPoolReport('fateEngine', '월 1000만원 자동 수익', '1:none', KO, EN);
    expect(koReport).not.toBeNull();
    expect(koReport!.headline).toMatch(/[가-힣]/);
    expect(koReport!.items[0].body).toMatch(/[가-힣]/);
    // a catalog with no pool templates borrows every template from the fallback
    const bare: PoolMessages = { HyperSovereign: {} };
    const borrowed = buildPoolReport('omniTwin', 'seoul', '0', bare, EN);
    expect(borrowed).not.toBeNull();
    expect(borrowed!.headline).toContain('Twin U-');
    // and with no fallback at all it declines instead of emitting empty strings
    expect(buildPoolReport('omniTwin', 'seoul', '0', bare)).toBeNull();
  });

  it('substitutes only known placeholders', () => {
    expect(fillTemplate('{a} × {b} {c}', { a: 1, b: 'two' })).toBe('1 × two {c}');
  });
});
