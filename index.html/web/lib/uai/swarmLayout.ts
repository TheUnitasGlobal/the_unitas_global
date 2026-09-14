/**
 * REV-24 MISSION 4 -- the OMNI-TECH SWARM layout (founder directive
 * 2026-09-13).
 *
 * REV-23 introduced `bigTechPulse`: it takes an organisation apart into six
 * Wikidata dimensions (industry, parent, subsidiaries, products, founders,
 * chief executive) and every entry is itself an entity you can re-anchor the
 * whole block onto. The founder's verdict on how that shipped: a flat list of
 * text chips does not show the thing it found. The relationships are the
 * discovery, and chips draw no relationships at all.
 *
 * So this module computes a MULTI-DIMENSIONAL NODE FIELD: the anchor sits at
 * the centre of a square field, each dimension owns an angular sector around
 * it, and each entity is a node placed on one of three depth shells inside
 * its sector. `depth` (0 = innermost shell, 1 = outermost) is what the view
 * feeds to the pointer parallax, so the field reads as a volume rather than a
 * disc and the outer nodes swim further than the inner ones.
 *
 * WHY IT IS PURE, AND WHY THERE IS NO RANDOMNESS. Every position is a
 * deterministic function of (dimension index, dimension count, node index,
 * node count, node id). Two renders of the same data -- server and client,
 * before and after a re-anchor, this page load and the next -- place every
 * node identically, so there is no hydration mismatch and no jitter when a
 * later cursor page appends a seventh dimension. The organic, non-mechanical
 * scatter comes from a hash of the node's own id, not from `Math.random`.
 *
 * Coordinates are PERCENTAGES of the field box (0-100), which is what lets
 * the same numbers drive absolutely-positioned HTML buttons AND an SVG edge
 * layer with `viewBox="0 0 100 100" preserveAspectRatio="none"` -- one source
 * of truth for the nodes and the web between them.
 *
 * Unit-tested in `__tests__/uai/swarmLayout.test.ts`.
 */

/** The field's centre, in field percent. */
export const SWARM_CENTRE = 50;

/** Depth shells. Kept off the rim so a long label still fits inside the card
 *  (`.qw-deeper-card` sets `contain: layout paint` -- anything drawn outside
 *  the box is clipped, not overflowed). */
const SHELL_RADIUS = [17, 26.5, 35.5] as const;

/** Nodes never come closer to an edge than this, label box included. */
const EDGE_MARGIN = 7;

/** The field is wider than it is tall, so x gets more room than y. */
const X_STRETCH = 1.32;

/** How far a node may wander inside its sector, as a fraction of the slot. */
const ANGLE_JITTER = 0.34;
/** How far a node may wander along its shell, in field percent. */
const RADIUS_JITTER = 2.6;

export interface SwarmInputNode {
  id: string;
  title: string;
  /** Wikidata QID -- present means this node can be re-anchored onto. */
  qid?: string;
  url?: string;
}

export interface SwarmInputDimension {
  /** Card id (`bigtech-P452`) -- stable identity for the sector. */
  key: string;
  /** Already-localized dimension name ("Products"). */
  label: string;
  nodes: readonly SwarmInputNode[];
}

export interface SwarmNode extends SwarmInputNode {
  /** Field percent, 0-100. */
  x: number;
  y: number;
  /** 0 = innermost shell, 1 = outermost. Drives the pointer parallax. */
  depth: number;
  /** Which sector this node belongs to. */
  dimensionKey: string;
  dimensionLabel: string;
  /** Sector index, so the view can hue-shift each dimension. */
  dimensionIndex: number;
}

export interface SwarmLayout {
  nodes: SwarmNode[];
  /** One entry per sector, for the legend and the hue ramp. */
  dimensions: { key: string; label: string; index: number; count: number }[];
  centre: { x: number; y: number };
}

/**
 * FNV-1a over the node id plus a final avalanche, mapped to [0, 1).
 * Deterministic -- the same id always lands in the same place.
 *
 * The avalanche is load-bearing, not decoration. Plain FNV-1a barely moves
 * its HIGH bits when only the last character of the input changes, and these
 * ids are `<PID>-Q<number>` -- so `P452-Q1` and `P452-Q2` came out 0.0039
 * apart and every dimension's nodes scattered along a visible ramp instead of
 * a field. The unit test pins that (`separates neighbouring ids`).
 */
export function hashUnit(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // xorshift-multiply finisher (MurmurHash3's fmix32 tail).
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 8) / 0x01000000;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Places every node of every dimension. Empty dimensions are dropped before
 * sectors are assigned, so a page that returns three modules uses the whole
 * circle rather than leaving three empty quadrants.
 */
export function swarmLayout(dimensions: readonly SwarmInputDimension[]): SwarmLayout {
  const live = dimensions.filter((d) => d.nodes.length > 0);
  const dimCount = live.length;
  const nodes: SwarmNode[] = [];

  live.forEach((dim, dimIndex) => {
    // Sector centre, starting at 12 o'clock and walking clockwise.
    const sectorSpan = (Math.PI * 2) / Math.max(1, dimCount);
    const sectorCentre = -Math.PI / 2 + sectorSpan * dimIndex;
    const n = dim.nodes.length;

    dim.nodes.forEach((node, i) => {
      const jitter = hashUnit(node.id);
      // Spread the dimension's nodes evenly across its own sector, then let
      // the hash nudge each one off its exact slot.
      const slot = n === 1 ? 0.5 : i / (n - 1);
      const offset = (slot - 0.5) * sectorSpan * 0.82;
      const angle = sectorCentre + offset + (jitter - 0.5) * sectorSpan * ANGLE_JITTER;

      // Walk the shells so consecutive entries never stack, and let the hash
      // breathe the radius so the shells do not read as three hard rings.
      const shell = i % SHELL_RADIUS.length;
      const radius = SHELL_RADIUS[shell] + (jitter - 0.5) * 2 * RADIUS_JITTER;

      const x = clamp(SWARM_CENTRE + Math.cos(angle) * radius * X_STRETCH, EDGE_MARGIN, 100 - EDGE_MARGIN);
      const y = clamp(SWARM_CENTRE + Math.sin(angle) * radius, EDGE_MARGIN, 100 - EDGE_MARGIN);

      nodes.push({
        ...node,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        depth: Number((shell / (SHELL_RADIUS.length - 1)).toFixed(3)),
        dimensionKey: dim.key,
        dimensionLabel: dim.label,
        dimensionIndex: dimIndex,
      });
    });
  });

  return {
    nodes,
    dimensions: live.map((d, index) => ({ key: d.key, label: d.label, index, count: d.nodes.length })),
    centre: { x: SWARM_CENTRE, y: SWARM_CENTRE },
  };
}
