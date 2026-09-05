import {
  Atom,
  Eye,
  Grid3x3,
  Handshake,
  Infinity as InfinityIcon,
  Network,
  Orbit,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/**
 * The 8 lock-in modules (owner instruction 2026-09-04 round 8): a single
 * one-row rotating carousel that sits directly above the core 3 enterprise
 * modules on the home page. Where the 11 ecosystems / 5 consumer modules /
 * 3 protocols are *products*, these eight are the retention layer of the
 * sovereign SaaS -- the reasons a visitor's journey stays inside UNITAS
 * (one identity, one shield, one evolving twin, margin ∞, one observatory,
 * one oracle, one coalition network, one fate lattice).
 *
 * Brand marks are owner-named and stay untranslated; every other string
 * (tagline / description / pillars / doctrine) lives under `LockIn.modules.
 * <key>` in messages/<locale>.json across all 20 locales.
 *
 * Activation is a device-local lock-in loop (localStorage, no backend, no
 * coin): opening a module and activating it lights its tile and advances
 * the "n / 8 activated" progress the section header shows. Deliberately
 * not part of MODULE_REGISTRY -- these are not routed pages, so the
 * prebuild registry validator must not expect app/[locale]/<route> folders.
 */

export type LockInModuleKey =
  | 'nexus'
  | 'aegis'
  | 'uTwin'
  | 'infinity'
  | 'panopticon'
  | 'oracle'
  | 'syndicateX'
  | 'fateMatrix';

export interface LockInModule {
  key: LockInModuleKey;
  /** Owner-named brand mark, rendered verbatim in every locale. */
  brand: string;
  icon: LucideIcon;
  color: string;
  glow: string;
}

export const LOCK_IN_MODULES: LockInModule[] = [
  { key: 'nexus', brand: 'NEXUS', icon: Network, color: '#22d3ee', glow: '#67e8f9' },
  { key: 'aegis', brand: 'AEGIS', icon: ShieldCheck, color: '#60a5fa', glow: '#93c5fd' },
  { key: 'uTwin', brand: 'U-TWIN', icon: Atom, color: '#34d399', glow: '#6ee7b7' },
  { key: 'infinity', brand: 'INFINITY', icon: InfinityIcon, color: '#d4af37', glow: '#fde047' },
  { key: 'panopticon', brand: 'PANOPTICON', icon: Eye, color: '#f472b6', glow: '#f9a8d4' },
  { key: 'oracle', brand: 'ORACLE', icon: Orbit, color: '#c084fc', glow: '#e9d5ff' },
  { key: 'syndicateX', brand: 'SYNDICATE-X', icon: Handshake, color: '#fb923c', glow: '#fed7aa' },
  { key: 'fateMatrix', brand: 'FATE-MATRIX', icon: Grid3x3, color: '#facc15', glow: '#fde68a' },
];

export const LOCK_IN_TOTAL = LOCK_IN_MODULES.length;

export function isLockInModuleKey(value: string | null | undefined): value is LockInModuleKey {
  return !!value && LOCK_IN_MODULES.some((m) => m.key === value);
}

export function lockInModule(key: LockInModuleKey): LockInModule {
  return LOCK_IN_MODULES.find((m) => m.key === key) ?? LOCK_IN_MODULES[0];
}

export function lockInIndex(key: LockInModuleKey): number {
  const i = LOCK_IN_MODULES.findIndex((m) => m.key === key);
  return i === -1 ? 0 : i;
}

/** Device-local activation set -- survives reloads and locale remounts. */
export const LOCK_IN_STORAGE_KEY = 'unitas.lockin.active.v1';

export function readActiveLockIns(): LockInModuleKey[] {
  try {
    const raw = localStorage.getItem(LOCK_IN_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is LockInModuleKey => typeof v === 'string' && isLockInModuleKey(v));
  } catch {
    return [];
  }
}

export function writeActiveLockIns(keys: LockInModuleKey[]): void {
  try {
    localStorage.setItem(LOCK_IN_STORAGE_KEY, JSON.stringify(Array.from(new Set(keys))));
  } catch {
    // storage unavailable -- activation simply doesn't persist past this session.
  }
}

/** Pure toggle so the reducer is unit-testable without React. */
export function toggleLockIn(active: LockInModuleKey[], key: LockInModuleKey): LockInModuleKey[] {
  return active.includes(key) ? active.filter((k) => k !== key) : [...active, key];
}
