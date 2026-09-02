import { Mail, type LucideIcon } from 'lucide-react';

// Global webmail direct-access hub: one-click links out to the world's major
// email providers. Deliberately NOT an OAuth/account-linking integration --
// that would require registering an app + storing secrets with each provider,
// well beyond a "direct shortcut" surface. This is a curated launcher: each
// tile opens that provider's own login/inbox page in a new tab, same as a
// bookmark bar would. lucide has no brand marks, so every tile shares the
// generic Mail glyph and is told apart by its brand accent color instead.

export interface EmailShortcut {
  key: string;
  brand: string;
  url: string;
  icon: LucideIcon;
  color: string;
  glow: string;
}

export const EMAIL_SHORTCUTS: EmailShortcut[] = [
  { key: 'gmail', brand: 'Gmail', url: 'https://mail.google.com/mail/', icon: Mail, color: '#ea4335', glow: '#f87171' },
  { key: 'outlook', brand: 'Outlook', url: 'https://outlook.live.com/mail/', icon: Mail, color: '#0078d4', glow: '#7dd3fc' },
  { key: 'yahoo', brand: 'Yahoo', url: 'https://mail.yahoo.com/', icon: Mail, color: '#6001d2', glow: '#c4b5fd' },
  { key: 'protonmail', brand: 'ProtonMail', url: 'https://mail.proton.me/', icon: Mail, color: '#6d4aff', glow: '#a5b4fc' },
];
