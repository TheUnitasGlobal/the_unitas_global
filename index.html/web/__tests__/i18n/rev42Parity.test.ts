import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routing } from '@/i18n/routing';

// REV-42 SPEC.md §2 D-8, §4, §4-A -- the `Rev42` namespace (sky almanac, air
// fusion, tier-3 detail shell, cosmos telemetry, gastronomy) plus the four
// `Rev20.slots.{cosmos,gastronomy}.{title,tag}` keys are written by
// scripts/apply-rev42-i18n.mjs from the 20 drafts under docs/rev42/i18n, and
// the same applicator DELETES `Rev20.slots.air` (the slot is retired, D-1).
// This gate proves every half in all 20 locales: the exact key set, the
// structural counts of §4 / §4-A (so a catalogue key cannot go missing
// behind a matching count elsewhere), ICU tokens preserved per key, no
// empty string, no `[MISSING` placeholder, a per-locale drift ceiling so a
// positional slip that leaves English in a foreign slot cannot ship, the
// retired `air` object absent everywhere, and the four Rev20 flagship keys
// actually translated (rev20Parity has no drift ceiling, 1-A #17).
//
// FAIL-CLOSED ON ABSENCE: until the applicator has run, the namespace is
// absent and the first test below fails with one clear line; the rest skip
// rather than pile 19 x N red lines on top of the same cause.

function load(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dirname, '../../messages', `${locale}.json`), 'utf8')) as Record<string, unknown>;
}

/** Flatten to leaf strings; array elements become `path.<index>`. */
function flatten(obj: unknown, prefix: string, out: Record<string, string>): Record<string, string> {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
    return out;
  }
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') out[prefix] = obj;
    return out;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    flatten(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

const icu = (s: string) => (s.match(/\{[^}]*\}/g) ?? []).slice().sort().join('|');

function get(tree: Record<string, unknown>, dotted: string): unknown {
  let node: unknown = tree;
  for (const p of dotted.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return node;
}

/** Keys of an object node, or [] when the node is absent / not an object. */
function keysAt(tree: Record<string, unknown>, dotted: string): string[] {
  const node = get(tree, dotted);
  return node && typeof node === 'object' && !Array.isArray(node) ? Object.keys(node as object) : [];
}

/**
 * The exact number of leaf keys en's `Rev42` namespace carries. Exact, not
 * `>=`: a floor lets a lane bolt a key on without a locale sweep and lets a
 * deleted key's 19 foreign copies rot in place.
 *
 * Integration set this from docs/rev42/i18n/en.json (533 Rev42 leaves on
 * 2026-09-18). While it is 0 the exact-count assertion is skipped and only
 * the structural counts below are enforced.
 */
const REV42_KEY_COUNT = 533;

/**
 * Keys whose value legitimately stays byte-identical to en in every locale
 * (SPEC §4 "IDENTICAL 허용"): the μg/m³ unit. Any other key whose en
 * value carries no letter at all (a pure symbol / number string) is waived
 * automatically -- there is nothing in it to translate.
 */
const IDENTICAL_ALLOWED = new Set<string>(['air.unit.ugm3']);
const hasNoLetter = (s: string) => !/\p{L}/u.test(s);

/** §4-A: the catalogue key lists the code and the copy both follow. */
const SKY_TERMS = [
  'lichun', 'yushui', 'jingzhe', 'chunfen', 'qingming', 'guyu', 'lixia', 'xiaoman', 'mangzhong', 'xiazhi', 'xiaoshu', 'dashu',
  'liqiu', 'chushu', 'bailu', 'qiufen', 'hanlu', 'shuangjiang', 'lidong', 'xiaoxue', 'daxue', 'dongzhi', 'xiaohan', 'dahan',
];
const SKY_ZODIAC = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const SKY_PHASES = ['newMoon', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'fullMoon', 'waningGibbous', 'lastQuarter', 'waningCrescent'];
const SKY_ANIMALS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'];
const COSMOS_OBJECTS = [
  'm31', 'm51', 'm104', 'm87', 'lmc', 'centaurusA', 'm42', 'm1', 'm57', 'ngc7293', 'carina', 'm16',
  'm45', 'm13', 'omegaCentauri', 'hyades', 'sgrA', 'cygnusX1', 'velaPulsar', 'quasar3c273', 'betelgeuse', 'proxima', 'vega', 'sirius',
];
const COSMOS_TYPES = ['galaxy', 'nebula', 'openCluster', 'globularCluster', 'blackHole', 'pulsar', 'quasar', 'star', 'supernovaRemnant', 'planetaryNebula'];
const COSMOS_CONSTELLATIONS = [
  'andromeda', 'canesVenatici', 'virgo', 'dorado', 'centaurus', 'orion', 'taurus', 'lyra', 'aquarius', 'carina', 'serpens', 'hercules', 'sagittarius', 'cygnus', 'vela', 'canisMajor',
];
const COSMOS_EPOCHS = ['thisLife', 'writtenHistory', 'agriculture', 'homoSapiens', 'earlyHumans', 'greatApes', 'dinosaursEnd', 'dinosaurs', 'complexLife', 'earlyEarth'];
const GASTRO_TRENDING = [
  'bibimbap', 'kimchiJjigae', 'tteokbokki', 'ramen', 'sushi', 'onigiri', 'dimSum', 'mapoTofu', 'pho', 'banhMi', 'padThai', 'tomYum',
  'nasiGoreng', 'tacosAlPastor', 'neapolitanPizza', 'cacioEPepe', 'croissant', 'shakshuka', 'avocadoToast', 'flatWhite', 'pourOverCoffee', 'darkChocolate', 'greekSalad', 'birria',
];
const GASTRO_TRENDS = ['fermentation', 'plantForward', 'hyperLocal', 'zeroWaste', 'koreanWave', 'regenerative', 'functionalDrinks', 'fireCooking', 'thirdWaveCoffee', 'nightMarkets'];
const GASTRO_DISHES: Record<string, [string, string]> = {
  KR: ['kimchi', 'samgyetang'], JP: ['okonomiyaki', 'tempura'], CN: ['pekingDuck', 'xiaolongbao'], US: ['hamburger', 'gumbo'], EE: ['mulgikapsad', 'kama'],
  ES: ['paella', 'gazpacho'], KH: ['fishAmok', 'numBanhChok'], FR: ['coqAuVin', 'ratatouille'], DE: ['sauerbraten', 'spaetzle'], PT: ['bacalhauABras', 'pastelDeNata'],
  VN: ['bunCha', 'banhXeo'], ID: ['rendang', 'satay'], RU: ['borscht', 'pelmeni'], IN: ['biryani', 'masalaDosa'], IT: ['risottoAllaMilanese', 'lasagna'],
  TR: ['kebap', 'baklava'], TH: ['greenCurry', 'somTam'], PL: ['pierogi', 'bigos'], NL: ['stamppot', 'stroopwafel'], PH: ['adobo', 'sinigang'],
  GB: ['fishAndChips', 'sundayRoast'], MX: ['moleNegro', 'pozole'], BR: ['feijoada', 'moqueca'], AR: ['asado', 'empanadas'], GR: ['moussaka', 'souvlaki'],
  EG: ['koshari', 'fulMedames'], MA: ['tagine', 'couscous'], ET: ['injera', 'doroWat'], PE: ['ceviche', 'lomoSaltado'], AU: ['meatPie', 'lamington'],
};
const GASTRO_SCIENCE = ['rice', 'wheat', 'maize', 'coffee', 'cacao', 'chili', 'tomato', 'cabbageFerment'];
const GASTRO_FLAVORS = ['umami', 'spicy', 'sweet', 'sour', 'bitter', 'smoky', 'fresh', 'rich', 'fermented', 'herbal'];
const GASTRO_MEAL_SLOTS = ['morning', 'noon', 'afternoon', 'evening', 'night'];
const AIR_ADVICE = ['good', 'fair', 'moderate', 'poor', 'veryPoor', 'extreme'];
const DETAIL_KEYS = ['weather', 'cosmos', 'gastronomy'];

const enTree = load('en');
const enRev42 = get(enTree, 'Rev42') as Record<string, unknown> | undefined;
const applied = Boolean(enRev42 && typeof enRev42 === 'object');

describe('REV-42 i18n', () => {
  it('the Rev42 namespace has been applied to en (scripts/apply-rev42-i18n.mjs)', () => {
    expect(applied, 'messages/en.json carries no Rev42 root -- run `node scripts/apply-rev42-i18n.mjs` after the docs/rev42/i18n drafts land').toBe(true);
  });

  describe.skipIf(!applied)('namespace', () => {
    const en = flatten(enRev42, '', {});
    const enKeys = Object.keys(en).sort();
    const rev42 = enRev42 as Record<string, unknown>;

    it.skipIf(REV42_KEY_COUNT < 0)('en carries exactly REV42_KEY_COUNT leaf keys, no more and no less', () => {
      expect(enKeys.length).toBe(REV42_KEY_COUNT);
    });

    it('en carries the five §4 roots', () => {
      expect(Object.keys(rev42).sort()).toEqual(['air', 'cosmos', 'detail', 'gastronomy', 'sky']);
    });

    it('§4-A sky: 24 terms, 12 zodiac signs, 8 phases, 12 animals, and the ICU lines', () => {
      expect(keysAt(rev42, 'sky.terms').sort()).toEqual([...SKY_TERMS].sort());
      expect(keysAt(rev42, 'sky.zodiac').sort()).toEqual([...SKY_ZODIAC].sort());
      expect(keysAt(rev42, 'sky.phases').sort()).toEqual([...SKY_PHASES].sort());
      expect(keysAt(rev42, 'sky.animals').sort()).toEqual([...SKY_ANIMALS].sort());
      expect(icu(en['sky.lunarLine'])).toBe('{day}|{month}');
      expect(icu(en['sky.lunarLeapLine'])).toBe('{day}|{month}');
      expect(icu(en['sky.animalYear'])).toBe('{animal}');
      expect(icu(en['sky.moonAge'])).toBe('{age}');
      expect(icu(en['sky.illumination'])).toBe('{pct}');
      expect(icu(en['sky.termIn'])).toBe('{days}|{hours}');
      expect(icu(en['sky.zodiacPos'])).toBe('{deg}|{min}|{sign}');
      expect(icu(en['sky.pixelAria'])).toBe('{age}|{phase}');
      for (const k of ['termNow', 'termNext', 'lst', 'gmst', 'jd', 'observer', 'sun', 'moon', 'eclipticLon', 'eclipticLat', 'ra', 'dec', 'altitude', 'azimuth', 'distance', 'aboveHorizon', 'belowHorizon', 'ringAria', 'dialAria', 'sectionSidereal', 'sectionTerms', 'sectionSun', 'sectionMoon', 'sectionZodiac', 'live']) {
        expect(en[`sky.${k}`], `sky.${k}`).toBeTruthy();
      }
    });

    it('§4 air: the nine pollutant / UV labels, 6 advice bands, the honest unreadable line and the two units', () => {
      for (const k of ['title', 'euAqi', 'usAqi', 'pm25', 'pm10', 'o3', 'no2', 'so2', 'co', 'dust', 'aod', 'uvNow', 'uvMax', 'dominant', 'unreadable']) {
        expect(en[`air.${k}`], `air.${k}`).toBeTruthy();
      }
      expect(keysAt(rev42, 'air.advice').sort()).toEqual([...AIR_ADVICE].sort());
      expect(keysAt(rev42, 'air.unit').sort()).toEqual(['index', 'ugm3']);
      expect(en['air.unit.ugm3']).toBe('μg/m³');
    });

    it('§4 detail: open / title for the three tier-3 hosts and the mirror note', () => {
      expect(keysAt(rev42, 'detail.open').sort()).toEqual([...DETAIL_KEYS].sort());
      expect(keysAt(rev42, 'detail.title').sort()).toEqual([...DETAIL_KEYS].sort());
      expect(en['detail.mirrorNote']).toBeTruthy();
    });

    it('§4-A cosmos: 24 objects x {name,note}, 10 types, 16 constellations, 10 epochs, and the four tier-3 sections', () => {
      expect(keysAt(rev42, 'cosmos.objects').sort()).toEqual([...COSMOS_OBJECTS].sort());
      for (const key of COSMOS_OBJECTS) expect(keysAt(rev42, `cosmos.objects.${key}`).sort(), key).toEqual(['name', 'note']);
      expect(keysAt(rev42, 'cosmos.types').sort()).toEqual([...COSMOS_TYPES].sort());
      expect(keysAt(rev42, 'cosmos.constellations').sort()).toEqual([...COSMOS_CONSTELLATIONS].sort());
      expect(keysAt(rev42, 'cosmos.epochs').sort()).toEqual([...COSMOS_EPOCHS].sort());
      expect(keysAt(rev42, 'cosmos.visibility').sort()).toEqual(['belowHorizon', 'daylight', 'visible']);
      expect(keysAt(rev42, 'cosmos.sections').sort()).toEqual(['lineage', 'relativity', 'scale', 'trajectory']);
      expect(keysAt(rev42, 'cosmos.lineage.origins').sort()).toEqual(['bigBang', 'cosmicRay', 'neutronMerger', 'stellarFusion', 'supernova']);
      expect(keysAt(rev42, 'cosmos.lineage.elements').sort()).toEqual(['calcium', 'carbon', 'gold', 'hydrogen', 'iron', 'nitrogen', 'oxygen', 'phosphorus']);
      expect(keysAt(rev42, 'cosmos.scale').sort()).toEqual(['earth', 'heliopause', 'laniakea', 'localGroup', 'milkyWay', 'observable', 'oort', 'proxima', 'sunEarth', 'virgo', 'you']);
      for (const k of ['objectOfDay', 'type', 'constellation', 'distance', 'lightLeft', 'altitude', 'visibility', 'observer', 'earthOrbit', 'travelledToday', 'galacticOrbit', 'cmbDipole', 'galacticCenter']) {
        expect(en[`cosmos.facts.${k}`], `cosmos.facts.${k}`).toBeTruthy();
      }
      expect(icu(en['cosmos.lightYears'])).toBe('{n}');
      expect(icu(en['cosmos.lightLeft.ago'])).toBe('{n}');
      expect(icu(en['cosmos.lightLeft.bce'])).toBe('{year}');
      expect(icu(en['cosmos.lightLeft.ce'])).toBe('{year}');
      expect(icu(en['cosmos.kmPerSec'])).toBe('{v}');
      expect(icu(en['cosmos.trajectory.line'])).toBe('{epoch}|{object}|{years}');
      expect(icu(en['cosmos.lineage.bodyShare'])).toBe('{pct}');
      expect(icu(en['cosmos.relativity.gLine'])).toBe('{g}|{lat}');
      expect(icu(en['cosmos.relativity.rotLine'])).toBe('{v}');
      expect(en['cosmos.source']).toContain('Wikipedia');
    });

    it('§4-A gastronomy: 24 trending x {name,why}, 10 trends x {title,line}, 30 countries x 2 dishes x {name,origin}, 8 sciences, 10 flavors, 5 meal slots', () => {
      expect(keysAt(rev42, 'gastronomy.trending').sort()).toEqual([...GASTRO_TRENDING].sort());
      for (const key of GASTRO_TRENDING) expect(keysAt(rev42, `gastronomy.trending.${key}`).sort(), key).toEqual(['name', 'why']);
      expect(keysAt(rev42, 'gastronomy.trends').sort()).toEqual([...GASTRO_TRENDS].sort());
      for (const key of GASTRO_TRENDS) expect(keysAt(rev42, `gastronomy.trends.${key}`).sort(), key).toEqual(['line', 'title']);
      const countries = Object.keys(GASTRO_DISHES);
      expect(countries).toHaveLength(30);
      expect(keysAt(rev42, 'gastronomy.dishes').sort()).toEqual([...countries].sort());
      for (const cc of countries) {
        expect(keysAt(rev42, `gastronomy.dishes.${cc}`).sort(), cc).toEqual([...GASTRO_DISHES[cc]].sort());
        for (const dish of GASTRO_DISHES[cc]) expect(keysAt(rev42, `gastronomy.dishes.${cc}.${dish}`).sort(), `${cc}.${dish}`).toEqual(['name', 'origin']);
      }
      expect(keysAt(rev42, 'gastronomy.science').sort()).toEqual([...GASTRO_SCIENCE].sort());
      for (const key of GASTRO_SCIENCE) expect(keysAt(rev42, `gastronomy.science.${key}`).sort(), key).toEqual(['chemistry', 'ingredient', 'pairing', 'solar']);
      expect(keysAt(rev42, 'gastronomy.flavors').sort()).toEqual([...GASTRO_FLAVORS].sort());
      expect(keysAt(rev42, 'gastronomy.mealSlots').sort()).toEqual([...GASTRO_MEAL_SLOTS].sort());
      expect(keysAt(rev42, 'gastronomy.sections').sort()).toEqual(['localEats', 'localEatsFallback', 'traditional', 'trends']);
      expect(keysAt(rev42, 'gastronomy.sections3').sort()).toEqual(['chemistry', 'pairing', 'solar']);
      expect(keysAt(rev42, 'gastronomy.pathway').sort()).toEqual(['c3', 'c4', 'cam']);
      for (const k of ['trending', 'mealSlot', 'origin', 'flavor', 'localTime']) expect(en[`gastronomy.facts.${k}`], `gastronomy.facts.${k}`).toBeTruthy();
      expect(icu(en['gastronomy.traditionMeta'])).toBe('{origin}');
      expect(icu(en['gastronomy.localMeta'])).toBe('{dist}');
      expect(icu(en['gastronomy.energyLine'])).toBe('{area}|{kcal}');
      expect(en['gastronomy.source']).toContain('Wikipedia');
    });

    it.each(routing.locales)('%s has the exact Rev42 key set with ICU tokens preserved, no empty strings and no placeholders', (locale) => {
      const flat = flatten(get(load(locale), 'Rev42'), '', {});
      expect(Object.keys(flat).sort()).toEqual(enKeys);
      for (const key of enKeys) {
        expect(icu(flat[key]), `${locale}:${key}`).toBe(icu(en[key]));
        expect(flat[key].trim().length, `${locale}:${key}`).toBeGreaterThan(0);
        expect(flat[key].includes('[MISSING'), `${locale}:${key}`).toBe(false);
      }
    });

    it.each(routing.locales)('%s keeps the μg/m³ unit verbatim (SPEC §4 IDENTICAL)', (locale) => {
      const flat = flatten(get(load(locale), 'Rev42'), '', {});
      for (const key of IDENTICAL_ALLOWED) expect(flat[key], `${locale}:${key}`).toBe(en[key]);
    });

    it.each(routing.locales.filter((l) => l !== 'en'))('%s is actually translated (not a positional slip): at most 8% of keys identical to en', (locale) => {
      const flat = flatten(get(load(locale), 'Rev42'), '', {});
      const identical = enKeys.filter((k) => !IDENTICAL_ALLOWED.has(k) && !hasNoLetter(en[k]) && flat[k] === en[k]);
      const allowed = Math.floor(enKeys.length * 0.08);
      expect(identical.length, `${locale}: ${identical.slice(0, 8).join(', ')}`).toBeLessThanOrEqual(allowed);
    });
  });
});

// D-1 / D-8: the `air` slot is retired and its title / tag object pruned in
// every locale; the two flagship slots are seated in Rev20 (rev20Parity
// pins the key count at 78) AND translated -- rev20Parity has no drift
// ceiling, so this file proves the four keys moved (1-A #17). The same
// applicator run writes both halves, so this block is gated on the same
// `applied` flag: before the run the ONE failure above names the cause.
describe.skipIf(!applied)('REV-42 Rev20 slot keys', () => {
  it.each(routing.locales)('%s no longer carries Rev20.slots.air', (locale) => {
    expect(get(load(locale), 'Rev20.slots.air'), `${locale}: Rev20.slots.air`).toBeUndefined();
  });

  it.each(routing.locales)('%s carries Rev20.slots.{cosmos,gastronomy}.{title,tag}', (locale) => {
    const tree = load(locale);
    for (const slot of ['cosmos', 'gastronomy']) {
      for (const leaf of ['title', 'tag']) {
        const value = get(tree, `Rev20.slots.${slot}.${leaf}`);
        expect(typeof value, `${locale}: Rev20.slots.${slot}.${leaf}`).toBe('string');
        expect((value as string).trim().length, `${locale}: Rev20.slots.${slot}.${leaf}`).toBeGreaterThan(0);
        expect((value as string).includes('[MISSING'), `${locale}: Rev20.slots.${slot}.${leaf}`).toBe(false);
      }
    }
  });

  it.each(routing.locales.filter((l) => l !== 'en'))('%s translates the four flagship title / tag keys (never byte-identical to en)', (locale) => {
    const tree = load(locale);
    for (const slot of ['cosmos', 'gastronomy']) {
      for (const leaf of ['title', 'tag']) {
        const dotted = `Rev20.slots.${slot}.${leaf}`;
        expect(get(tree, dotted), `${locale}: ${dotted} is still English`).not.toBe(get(enTree, dotted));
      }
    }
  });
});
