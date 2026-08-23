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
  { key: 'echo', route: 'echo', messageKey: 'echo', coinCost: 1, color: '#00f3ff', glow: '#67e8f9', sfx: 'echo' },
  { key: 'void', route: 'void', messageKey: 'void', coinCost: 2, color: '#7c3aed', glow: '#a78bfa', sfx: 'void' },
  { key: 'mirror', route: 'mirror', messageKey: 'mirror', coinCost: 2, color: '#c0c5ce', glow: '#e5e7eb', sfx: 'mirror' },
  { key: 'oracle', route: 'oracle', messageKey: 'oracle', coinCost: 3, color: '#d4af37', glow: '#fde68a', sfx: 'oracle' },
  { key: 'pulse', route: 'pulse', messageKey: 'pulse', coinCost: 1, color: '#dc2626', glow: '#f87171', sfx: 'pulse' },
  { key: 'apex', route: 'apex', messageKey: 'apex', coinCost: 4, color: '#84cc16', glow: '#bef264', sfx: 'apex' },
  { key: 'genesis', route: 'genesis', messageKey: 'genesis', coinCost: 5, color: '#f8fafc', glow: '#ffffff', sfx: 'genesis' },
  { key: 'syndicate', route: 'syndicate', messageKey: 'syndicate', coinCost: 3, color: '#ea580c', glow: '#fb923c', sfx: 'syndicate' },
  { key: 'aura', route: 'aura', messageKey: 'aura', coinCost: 2, color: '#14b8a6', glow: '#c084fc', sfx: 'aura' },
  { key: 'paradox', route: 'paradox', messageKey: 'paradox', coinCost: 4, color: '#2563eb', glow: '#60a5fa', sfx: 'paradox' },
  { key: 'chronos', route: 'chronos', messageKey: 'chronos', coinCost: 5, color: '#b45309', glow: '#f59e0b', sfx: 'chronos' },
];
