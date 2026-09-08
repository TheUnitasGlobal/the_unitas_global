import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Network, ShieldCheck, Palette, Library } from 'lucide-react';

/**
 * The 5 "Sovereign Life-OS" cognitive hub modules (founder directive
 * 2026-09-08). Deliberately NOT part of web/lib/module-registry.ts's
 * MODULE_REGISTRY: that registry's whole purpose (see its docstring) is
 * governing the coin-gated B2C/ecosystem catalog + the B2B protocols --
 * these 5 are founder-only operational tooling with no coin economy
 * involved, same precedent as 'u-ai' (see scripts/validate-module-registry.mjs
 * INFRA_ROUTES). Access control is instead the edge-level fail-closed 404
 * fence in middleware.ts (`isSovereignProtectedPath` matches any `/sovereign`
 * path segment) -- a visitor without a verified sovereign session never
 * receives a response body, let alone this catalog's content.
 *
 * All 5 routes live under the single literal `sovereign/` app-router segment
 * (app/[locale]/sovereign/...) so that one regex continues to fence every
 * module without per-route middleware changes as more are added.
 */
export interface LifeOsModule {
  key: string;
  /** Path segment(s) after `/sovereign` -- '' for the hub root itself. */
  path: string;
  messageKey: string;
  icon: LucideIcon;
}

export const LIFE_OS_MODULES: LifeOsModule[] = [
  { key: 'life-dashboard', path: '', messageKey: 'lifeDashboard', icon: LayoutDashboard },
  { key: 'second-brain', path: 'second-brain', messageKey: 'secondBrain', icon: Network },
  { key: 'review-agent', path: 'review-agent', messageKey: 'reviewAgent', icon: ShieldCheck },
  { key: 'brand-kit', path: 'brand-kit', messageKey: 'brandKit', icon: Palette },
  { key: 'life-library', path: 'life-library', messageKey: 'lifeLibrary', icon: Library },
];

export function lifeOsHref(path: string): string {
  return path ? `/sovereign/${path}` : '/sovereign';
}
