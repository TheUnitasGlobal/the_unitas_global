'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ShieldCheck, ArrowRight, ChevronDown } from 'lucide-react';
import { EnterpriseInquiryModal } from '@/components/interaction/EnterpriseInquiryModal';
import { useSpatialAudio } from '@/components/audio/SpatialAudioProvider';
import { B2B_TECH_SPECS } from '@/lib/b2bSpecs';
import type { B2BProtocol } from '@/lib/modules';

interface B2BProtocolCardProps {
  protocol: B2BProtocol;
  index: number;
}

/** Deep Obsidian & Liquid Gold themed card for the Enterprise R&D section. */
export function B2BProtocolCard({ protocol, index }: B2BProtocolCardProps) {
  const t = useTranslations('B2B');
  const tModules = useTranslations('Modules');
  const { playVaultSfx } = useSpatialAudio();
  const [specOpen, setSpecOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const nodes = B2B_TECH_SPECS[protocol.route] ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      onMouseEnter={() => playVaultSfx()}
      className="relative overflow-hidden border border-accent/20 bg-[#050403] p-6 transition-colors hover:border-accent/60"
      style={{
        backgroundImage:
          'linear-gradient(rgba(212,175,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.05) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      {/* Liquid gold shimmer strip */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, #d4af37 30%, #fff3c4 50%, #d4af37 70%, transparent)',
        }}
        aria-hidden="true"
      />

      <div className="mb-4 flex items-center gap-3">
        <ShieldCheck size={22} className="text-accent" />
        <h3 className="font-serif text-lg font-bold tracking-wide text-white">
          {tModules(`${protocol.messageKey}.title`)}
        </h3>
      </div>

      <p className="mb-4 text-xs text-gray-400">{tModules(`${protocol.messageKey}.description`)}</p>

      <div className="mb-4 space-y-2">
        <p className="border-l-2 border-accent/50 pl-3 text-[11px] italic text-gray-500">
          {t('rdNotice')}
        </p>
        <span className="inline-block border border-accent/30 bg-accent/5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-accent">
          {t('patentBadge')}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setSpecOpen((prev) => !prev)}
        aria-expanded={specOpen}
        className="mb-2 flex w-full items-center justify-between border border-white/10 bg-void/60 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-accent/40 hover:text-accent"
      >
        <span>{specOpen ? t('hideSpec') : t('viewSpec')}</span>
        <ChevronDown size={14} className={specOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      <AnimatePresence initial={false}>
        {specOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mb-4 flex flex-col gap-2 border border-white/10 bg-void/40 p-4">
              {nodes.map((node, i) => (
                <div key={node} className="flex items-center gap-2">
                  <span className="flex-1 border border-accent/20 bg-accent/5 px-2 py-1.5 text-[10px] text-gray-300">
                    {node}
                  </span>
                  {i < nodes.length - 1 && (
                    <ArrowRight size={12} className="shrink-0 rotate-90 text-accent/60 sm:rotate-0" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setInquiryOpen(true)}
        className="w-full border border-accent bg-accent/10 py-2.5 text-[10px] font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-void"
      >
        {t('earlyAccess')}
      </button>

      <EnterpriseInquiryModal
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        protocolTitle={tModules(`${protocol.messageKey}.title`)}
      />
    </motion.div>
  );
}
