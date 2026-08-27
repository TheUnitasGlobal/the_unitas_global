import { Shield, Swords } from 'lucide-react';

interface SwordShieldIconProps {
  size?: number;
  className?: string;
}

/**
 * Composite "secure cognitive defense & operations" glyph -- lucide has no
 * single sword-and-shield icon, so this layers `Swords` over `Shield`
 * (same approach as any other icon-compositing: absolutely positioned,
 * sized off the same `size` prop the shield-only icon it replaces used).
 */
export function SwordShieldIcon({ size = 22, className }: SwordShieldIconProps) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <Shield size={size} className={className} strokeWidth={1.75} />
      <Swords
        size={size * 0.58}
        className={className}
        strokeWidth={2.25}
        style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
    </span>
  );
}
