import { BrainCircuit, Gauge, Radar, Orbit, Database } from 'lucide-react';

// Section 2: "B2C Live Consumer Services" -- the original 5 modules,
// restored. Coin costs are pegged 1 U-Coin = 1 EUR and kept in the 1-5
// range for accessibility (see lib/currency.ts), same as the 11
// ecosystems -- this is a fictional catalog for this concept build, no
// longer mirroring the root static site's real coin economy.
//
// `icon` is a distinct futuristic/cognitive-architecture glyph per module
// (no financial gem/diamond imagery) chosen to match each module's actual
// function: Arche filters cognition, Score measures it, Arena stress-tests
// it, Fate routes it, Codex22 archives it.

export const B2C_MODULES = [
  { key: 'arche', route: 'arche', messageKey: 'arche', coinCost: 1, metal: '#e5e4e2', metalName: 'Platinum', icon: BrainCircuit },
  { key: 'score', route: 'score', messageKey: 'score', coinCost: 2, metal: '#d4af37', metalName: 'Gold', icon: Gauge },
  { key: 'arena', route: 'arena', messageKey: 'arena', coinCost: 3, metal: '#c0c0c0', metalName: 'Silver', icon: Radar },
  { key: 'fate', route: 'fate', messageKey: 'fate', coinCost: 4, metal: '#b76e79', metalName: 'Rose Gold', icon: Orbit },
  { key: 'codex22', route: 'codex22', messageKey: 'codex22', coinCost: 5, metal: '#8a97a0', metalName: 'Titanium', icon: Database },
] as const;

export const B2B_PROTOCOLS = [
  { key: 'u-signature', route: 'u-signature', messageKey: 'uSignature' },
  { key: 'u-key', route: 'u-key', messageKey: 'uKey' },
  { key: 'u-pay', route: 'u-pay', messageKey: 'uPay' },
] as const;

export type B2CModule = (typeof B2C_MODULES)[number];
export type B2BProtocol = (typeof B2B_PROTOCOLS)[number];
