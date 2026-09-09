import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * Shared shell for every institutional footer page (Company / Legal /
 * Policies / Customer Service). Server component -- pure typographic content,
 * no client state. Matches the ecosystem's design grammar: hairline gold
 * rule, uppercase tracked eyebrow, Cinzel serif title with a restrained
 * glow, wide measure, calm spacing.
 */
export function SitePage({
  eyebrow,
  title,
  lede,
  body,
  disclaimer,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  body: string[];
  disclaimer?: string;
  backLabel: string;
}) {
  return (
    <main className="mx-auto min-h-[70vh] max-w-3xl px-6 pb-28 pt-32">
      <Link
        href="/"
        className="group inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-accent/70 transition-colors hover:text-accent"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
        {backLabel}
      </Link>

      <div className="mt-10 border-t border-accent/20 pt-10">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-accent/60">
          {eyebrow}
        </p>
        <h1
          className="font-serif text-3xl font-bold leading-tight text-white md:text-4xl"
          style={{ textShadow: '0 0 24px rgba(212,175,55,0.28), 0 0 60px rgba(0,243,255,0.08)' }}
        >
          {title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-gray-200 [text-wrap:balance]">{lede}</p>

        <div className="mt-10 space-y-6">
          {body.map((paragraph, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-gray-400">
              {paragraph}
            </p>
          ))}
        </div>

        {disclaimer ? (
          <p className="mt-14 border-t border-white/10 pt-6 text-xs leading-relaxed text-gray-500">
            {disclaimer}
          </p>
        ) : null}
      </div>
    </main>
  );
}
