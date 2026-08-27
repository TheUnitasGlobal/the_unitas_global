// The 11 B2C "Live Ecosystems" -- OMNI-SYNAPSE grid (Section 1: "B2C
// Cognitive Ecosystem"). Coin costs are pegged 1 U-Coin = 1 EUR and kept in
// the 1-5 range for accessibility -- see lib/currency.ts. This is a
// separate pricing tier from the original 5 modules (lib/modules.ts,
// Section 2: "B2C Live Consumer Services"), not mirrored from anywhere
// real; both are fictional catalogs for this concept build.

export interface EcosystemTheme {
  key: string;
  route: string;
  messageKey: string;
  coinCost: number;
  /** Primary theme color (borders, text accents). */
  color: string;
  /** Secondary glow/highlight color. */
  glow: string;
  /** Key into the audio engine's per-ecosystem SFX presets. */
  sfx: string;
}

export const ECOSYSTEMS: EcosystemTheme[] = [
  { key: 'echo', route: 'echo', messageKey: 'echo', coinCost: 1, color: '#06b6d4', glow: '#67e8f9', sfx: 'echo' },
  { key: 'void', route: 'void', messageKey: 'void', coinCost: 2, color: '#8b5cf6', glow: '#c4b5fd', sfx: 'void' },
  { key: 'mirror', route: 'mirror', messageKey: 'mirror', coinCost: 2, color: '#3b82f6', glow: '#93c5fd', sfx: 'mirror' },
  { key: 'oracle', route: 'oracle', messageKey: 'oracle', coinCost: 3, color: '#f59e0b', glow: '#fde68a', sfx: 'oracle' },
  { key: 'pulse', route: 'pulse', messageKey: 'pulse', coinCost: 1, color: '#f43f5e', glow: '#fda4af', sfx: 'pulse' },
  { key: 'apex', route: 'apex', messageKey: 'apex', coinCost: 4, color: '#10b981', glow: '#6ee7b7', sfx: 'apex' },
  { key: 'genesis', route: 'genesis', messageKey: 'genesis', coinCost: 5, color: '#a855f7', glow: '#d8b4fe', sfx: 'genesis' },
  { key: 'syndicate', route: 'syndicate', messageKey: 'syndicate', coinCost: 3, color: '#f97316', glow: '#fdba74', sfx: 'syndicate' },
  { key: 'aura', route: 'aura', messageKey: 'aura', coinCost: 2, color: '#14b8a6', glow: '#5eead4', sfx: 'aura' },
  { key: 'paradox', route: 'paradox', messageKey: 'paradox', coinCost: 4, color: '#6366f1', glow: '#a5b4fc', sfx: 'paradox' },
  { key: 'chronos', route: 'chronos', messageKey: 'chronos', coinCost: 5, color: '#d946ef', glow: '#f0abfc', sfx: 'chronos' },
];
