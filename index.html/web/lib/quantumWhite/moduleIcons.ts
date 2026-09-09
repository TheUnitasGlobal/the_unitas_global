import {
  AudioWaveform,
  CircleDashed,
  FlipHorizontal2,
  Eye,
  Activity,
  Mountain,
  Sparkles,
  Waypoints,
  Sun,
  Blend,
  Hourglass,
  Fingerprint,
  KeyRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * REV-15 (SPEC.md §4.3): `lib/ecosystems.ts`'s 11 themes and `B2B_PROTOCOLS`'
 * 3 rails carry no `icon` field of their own -- neither catalog can be
 * edited (the prebuild registry validator regex-parses both, and the DB
 * whitelist depends on their exact shape, see `lib/quantumWhite/clusters.ts`'s
 * own header comment) -- so the cluster popup rendered a bare 10px dot for
 * 14 of its 32 modules while the other 18 (Life-OS + B2C + lock-in) got a
 * dot AND a 16px icon, a visible baseline mismatch inside the same tile
 * grid row. These two maps close that gap without touching either source
 * catalog; `lib/quantumWhite/clusters.ts` looks each key up here.
 *
 * Chosen to read as a distinct, function-matched glyph per theme/protocol,
 * with zero collisions against the Life-OS set (LayoutDashboard, Network,
 * ShieldCheck, Palette, Library) or the lock-in set (Network, ShieldCheck,
 * Atom, InfinityIcon, Eye, Orbit, Handshake, Grid3x3) already in use
 * elsewhere in the same cognitive/lock-in clusters -- Eye appears in both
 * `ECOSYSTEM_ICONS` (oracle) and lock-in (panopticon), but those render in
 * two different cluster pop-outs, never side by side.
 */
export const ECOSYSTEM_ICONS: Readonly<Record<string, LucideIcon>> = {
  echo: AudioWaveform,
  void: CircleDashed,
  mirror: FlipHorizontal2,
  oracle: Eye,
  pulse: Activity,
  apex: Mountain,
  genesis: Sparkles,
  syndicate: Waypoints,
  aura: Sun,
  paradox: Blend,
  chronos: Hourglass,
};

export const B2B_ICONS: Readonly<Record<string, LucideIcon>> = {
  'u-signature': Fingerprint,
  'u-key': KeyRound,
  'u-pay': Wallet,
};
