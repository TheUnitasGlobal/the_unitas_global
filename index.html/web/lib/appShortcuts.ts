import {
  Mail,
  Hash,
  Camera,
  Play,
  Users,
  Music2,
  Briefcase,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';

// Direct-app launcher hub: one-click links out to the world's major webmail
// and social-media apps. Deliberately NOT an OAuth/account-linking
// integration -- that would require registering an app + storing secrets
// with each provider, well beyond a "direct shortcut" surface. Every tile
// opens that provider's own login/inbox/feed page in a new tab, same as a
// bookmark bar would. lucide 1.x ships no brand marks, so each tile uses a
// generic glyph and is told apart by its brand accent color instead.
//
// Both families share one shape so HotShortcutMatrixStrip (the tab grids)
// and HotShortcutResultModal's "app loop" row render them generically, and
// so the popup can hand a visitor straight from a knowledge tier out to the
// app and back without losing its ladder (state persists in sessionStorage).

export type DirectAppFamily = 'email' | 'social';

export interface DirectAppShortcut {
  key: string;
  brand: string;
  url: string;
  icon: LucideIcon;
  color: string;
  glow: string;
  family: DirectAppFamily;
}

export const EMAIL_SHORTCUTS: DirectAppShortcut[] = [
  { key: 'gmail', brand: 'Gmail', url: 'https://mail.google.com/mail/', icon: Mail, color: '#ea4335', glow: '#f87171', family: 'email' },
  { key: 'outlook', brand: 'Outlook', url: 'https://outlook.live.com/mail/', icon: Mail, color: '#0078d4', glow: '#7dd3fc', family: 'email' },
  { key: 'yahoo', brand: 'Yahoo', url: 'https://mail.yahoo.com/', icon: Mail, color: '#6001d2', glow: '#c4b5fd', family: 'email' },
  { key: 'protonmail', brand: 'ProtonMail', url: 'https://mail.proton.me/', icon: Mail, color: '#6d4aff', glow: '#a5b4fc', family: 'email' },
];

export const SOCIAL_SHORTCUTS: DirectAppShortcut[] = [
  { key: 'x', brand: 'X', url: 'https://x.com/home', icon: Hash, color: '#e5e7eb', glow: '#f3f4f6', family: 'social' },
  { key: 'instagram', brand: 'Instagram', url: 'https://www.instagram.com/', icon: Camera, color: '#e1306c', glow: '#f9a8d4', family: 'social' },
  { key: 'youtube', brand: 'YouTube', url: 'https://www.youtube.com/', icon: Play, color: '#ff0000', glow: '#fca5a5', family: 'social' },
  { key: 'facebook', brand: 'Facebook', url: 'https://www.facebook.com/', icon: Users, color: '#1877f2', glow: '#93c5fd', family: 'social' },
  { key: 'tiktok', brand: 'TikTok', url: 'https://www.tiktok.com/', icon: Music2, color: '#69c9d0', glow: '#a5f3fc', family: 'social' },
  { key: 'linkedin', brand: 'LinkedIn', url: 'https://www.linkedin.com/feed/', icon: Briefcase, color: '#0a66c2', glow: '#93c5fd', family: 'social' },
  { key: 'reddit', brand: 'Reddit', url: 'https://www.reddit.com/', icon: MessageCircle, color: '#ff4500', glow: '#fdba74', family: 'social' },
];

/** Every direct-app launcher (email first, then social) -- the pool the
 *  popup's "app loop" row cycles through. */
export const DIRECT_APP_SHORTCUTS: DirectAppShortcut[] = [...EMAIL_SHORTCUTS, ...SOCIAL_SHORTCUTS];
