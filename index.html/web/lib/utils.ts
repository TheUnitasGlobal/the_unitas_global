import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class composer used by shadcn-format registries (shadcn/ui, 21st.dev `https://21st.dev/r/<author>/<slug>`).
 * `web/components.json` points the registry `utils` alias here, so `npx shadcn@latest add <registry-url>` drops
 * components into `components/ui/` without further wiring. Uses `cssVariables: false`, so registry components are
 * rewritten to plain Tailwind palette classes and never touch the UNITAS token layer (`tailwind.config.ts`,
 * `app/quantum-white*.css`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
