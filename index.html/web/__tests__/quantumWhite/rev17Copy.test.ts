import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';
import { SINGULARITY_CLUSTERS, ALL_CLUSTER_MODULES } from '../../lib/quantumWhite/clusters';

// Module-level test isolation (CLAUDE.md) -- pure JSON-shape/content
// assertions against the real message files, mirroring
// __tests__/i18n/quantumWhiteParity.test.ts's approach. Guards the REV-17
// curiosity-copy mandate (SPEC.md §4.1, §7.0): no digit, no leftover
// instructional/counter key, every new Entry Gate key present.

function loadMessages(locale: string): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function resolveKey(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, segment) => {
    if (node === undefined || node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[segment];
  }, messages);
}

const LOCALES = routing.locales;
const KINDS = ['ecosystem', 'lifeos', 'b2c', 'lockin', 'b2b'] as const;

describe('REV-17 QuantumWhite copy (SPEC.md §4.1, §7)', () => {
  for (const locale of LOCALES) {
    describe(`locale: ${locale}`, () => {
      const messages = loadMessages(locale);
      const qw = (messages.QuantumWhite ?? {}) as Record<string, unknown>;

      it('cluster tagline/enigma carry no Arabic numeral (module-count leak)', () => {
        for (const cluster of SINGULARITY_CLUSTERS) {
          const tagline = resolveKey(messages, cluster.taglineKey) as string;
          const enigma = resolveKey(messages, cluster.enigmaKey) as string;
          expect(tagline, `${locale}.${cluster.taglineKey}`).not.toMatch(/\d/);
          expect(enigma, `${locale}.${cluster.enigmaKey}`).not.toMatch(/\d/);
        }
      });

      it('module riddle carries no Arabic numeral', () => {
        for (const module of ALL_CLUSTER_MODULES) {
          const riddle = resolveKey(messages, module.i18n.riddleKey) as string;
          expect(riddle, `${locale}.${module.i18n.riddleKey}`).not.toMatch(/\d/);
        }
      });

      it('module scenario resolves to a non-empty string', () => {
        for (const module of ALL_CLUSTER_MODULES) {
          const scenario = resolveKey(messages, module.i18n.scenarioKey);
          expect(typeof scenario, `${locale}.${module.i18n.scenarioKey}`).toBe('string');
          expect(scenario).not.toBe('');
        }
      });

      it('retires moduleCount, selectModule, the investNow/signInToInvest/guestInvest trio and the kind.* badge namespace', () => {
        expect(qw.moduleCount, `${locale}.QuantumWhite.moduleCount`).toBeUndefined();
        expect(qw.selectModule, `${locale}.QuantumWhite.selectModule`).toBeUndefined();
        expect(qw.investNow, `${locale}.QuantumWhite.investNow`).toBeUndefined();
        expect(qw.signInToInvest, `${locale}.QuantumWhite.signInToInvest`).toBeUndefined();
        expect(qw.guestInvest, `${locale}.QuantumWhite.guestInvest`).toBeUndefined();
        expect(qw.kind, `${locale}.QuantumWhite.kind`).toBeUndefined();
      });

      it('adds the renamed U-Pay CTA keys (enter/signInToEnter/guestEnter)', () => {
        for (const key of ['enter', 'signInToEnter', 'guestEnter']) {
          const value = resolveKey(qw, key);
          expect(typeof value, `${locale}.QuantumWhite.${key}`).toBe('string');
          expect(value).not.toBe('');
        }
      });

      it('adds the Entry Gate eyebrow/back labels and legal notice (n1-n4 + legalLink)', () => {
        for (const key of ['entry.eyebrowScenario', 'entry.eyebrowGuide', 'entry.eyebrowNotice', 'entry.stageStandby', 'entry.back']) {
          const value = resolveKey(qw, key);
          expect(typeof value, `${locale}.QuantumWhite.${key}`).toBe('string');
          expect(value).not.toBe('');
        }
        for (const key of ['n1', 'n2', 'n3', 'n4', 'legalLink']) {
          const value = resolveKey(qw, `entry.notice.${key}`);
          expect(typeof value, `${locale}.QuantumWhite.entry.notice.${key}`).toBe('string');
          expect(value).not.toBe('');
        }
      });

      it('adds a 3-bullet usage guide for every module kind', () => {
        for (const kind of KINDS) {
          for (const bullet of ['g1', 'g2', 'g3']) {
            const value = resolveKey(qw, `entry.guide.${kind}.${bullet}`);
            expect(typeof value, `${locale}.QuantumWhite.entry.guide.${kind}.${bullet}`).toBe('string');
            expect(value).not.toBe('');
          }
        }
      });
    });
  }
});
