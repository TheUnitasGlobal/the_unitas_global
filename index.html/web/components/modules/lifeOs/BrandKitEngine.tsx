'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import {
  BRAND_ASSET_MANIFEST,
  BRAND_COLOR_TOKENS,
  BRAND_TYPOGRAPHY,
  applyBrandVoice,
  checkBrandVoice,
} from '@/lib/lifeOs/brandKit';

/**
 * Brand Kit: sovereign tone-of-voice + style/asset automated injection.
 * Surfaces the ONE real brand system already wired into tailwind.config.ts
 * / app/[locale]/layout.tsx / public/assets/svg/unitas-mark.svg (never a
 * parallel invented palette), plus a live voice checker running
 * checkBrandVoice() from lib/lifeOs/brandKit.ts entirely client-side --
 * text never leaves the browser for this check.
 */
export function BrandKitEngine() {
  const t = useTranslations('LifeOs.brandKit');
  const [draft, setDraft] = useState('');

  const findings = useMemo(() => checkBrandVoice(draft), [draft]);
  const preview = useMemo(() => applyBrandVoice(draft), [draft]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">{t('paletteLabel')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BRAND_COLOR_TOKENS.map((token) => (
            <div key={token.name} className="border border-accent/15 bg-void/60 p-3">
              <div className="mb-2 h-10 w-full border border-white/10" style={{ backgroundColor: token.value }} />
              <p className="text-[11px] font-bold text-white">{token.name}</p>
              <p className="font-mono text-[10px] text-gray-500">{token.value}</p>
              <p className="mt-1 text-[10px] leading-snug text-gray-500">{token.usage}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">{t('typographyLabel')}</h2>
        <div className="space-y-2">
          {BRAND_TYPOGRAPHY.map((token) => (
            <div key={token.role} className="border border-accent/15 bg-void/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{token.role}</p>
              <p className="font-mono text-xs text-white">{token.family}</p>
              <p className="mt-1 text-[10px] text-gray-500">{token.usage}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">{t('assetsLabel')}</h2>
        <ul className="space-y-1">
          {BRAND_ASSET_MANIFEST.map((asset) => (
            <li key={asset.key} className="text-xs text-gray-400">
              <span className="font-mono text-gray-300">{asset.path}</span> -- {asset.usage}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">{t('voiceCheckerLabel')}</h2>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('voiceCheckerPlaceholder')}
          rows={4}
          className="w-full border border-accent/20 bg-void/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-accent focus:outline-none"
        />

        {findings.length > 0 && (
          <div className="mt-3 space-y-2">
            {findings.map((finding, i) => (
              <p key={i} className="flex items-start gap-2 text-xs text-amber-400">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  &ldquo;{finding.match}&rdquo; -&gt; &ldquo;{finding.suggestion}&rdquo; -- {finding.reason}
                </span>
              </p>
            ))}
            <div className="border border-accent/15 bg-void/60 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">{t('previewLabel')}</p>
              <p className="text-sm text-gray-200">{preview}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
