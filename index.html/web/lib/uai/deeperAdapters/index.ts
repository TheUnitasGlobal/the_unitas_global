/**
 * Explore Deeper adapter registry (SPEC §3.4): one adapter per theme, all
 * `DiscoverySlot.load`-shaped -- `load(anchor, ctx, cursor?) => DeeperPage`,
 * fail-open, cursor-paged forever.
 */
import type { DeeperAnchor } from '../deeperAnchor';
import { EMPTY_DEEPER_PAGE, deeperTheme, type DeeperAdapter, type DeeperContext, type DeeperCursor, type DeeperPage, type DeeperThemeKey } from '../deeperThemes';
import { causalHackAdapter, dataTwinAdapter, marketMoatAdapter, zeroPointAdapter } from './wikidata';
import { chronosGateAdapter, fractalDimAdapter, hologramFieldAdapter, omniWaveAdapter, valueCycleAdapter } from './wikipedia';
import { evolutionArcAdapter, omniPressAdapter, terraPulseAdapter, timeFluxAdapter, ventureSignalAdapter } from './open';
import { bigTechPulseAdapter } from './omniTech';

export const DEEPER_ADAPTERS: Record<DeeperThemeKey, DeeperAdapter> = {
  dataTwin: dataTwinAdapter,
  causalHack: causalHackAdapter,
  valueCycle: valueCycleAdapter,
  omniWave: omniWaveAdapter,
  zeroPoint: zeroPointAdapter,
  hologramField: hologramFieldAdapter,
  evolutionArc: evolutionArcAdapter,
  ventureSignal: ventureSignalAdapter,
  marketMoat: marketMoatAdapter,
  timeFlux: timeFluxAdapter,
  fractalDim: fractalDimAdapter,
  chronosGate: chronosGateAdapter,
  omniPress: omniPressAdapter,
  terraPulse: terraPulseAdapter,
  bigTechPulse: bigTechPulseAdapter,
};

/** Run one theme page. Never throws: an adapter error is an empty page
 *  (the UI shows the retry card), never a broken modal. */
export async function loadDeeperPage(theme: DeeperThemeKey, anchor: DeeperAnchor, ctx: DeeperContext, cursor?: DeeperCursor): Promise<DeeperPage> {
  try {
    return await DEEPER_ADAPTERS[theme].load(anchor, ctx, cursor ?? undefined);
  } catch {
    return EMPTY_DEEPER_PAGE([...deeperTheme(theme).sources]);
  }
}

export { entityNewsUrl, type EntityNewsItem, type EntityNewsResponse } from './open';
