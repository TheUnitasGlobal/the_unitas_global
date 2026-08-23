'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { buildSyndicateNetwork, type SyndicateNetwork } from '@/lib/engines/syndicate';
import type { EcosystemTheme } from '@/lib/ecosystems';

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 95;

export function SyndicateEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [target, setTarget] = useState('');
  const [network, setNetwork] = useState<SyndicateNetwork | null>(null);
  const [mapping, setMapping] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target.trim() || mapping) return;
    setMapping(true);
    window.setTimeout(() => {
      setNetwork(buildSyndicateNetwork(target));
      setMapping(false);
    }, 800);
  }

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t('syndicateTargetPlaceholder')}
          className="w-full border bg-void px-3 py-2 text-sm text-white outline-none"
          style={{ borderColor: `${ecosystem.color}44` }}
        />
        <button
          type="submit"
          disabled={mapping || !target.trim()}
          className="shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {mapping ? t('syndicateMappingLabel') : t('syndicateMapButton')}
        </button>
      </form>

      {network && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto mb-4 w-full max-w-xs">
            {network.nodes.map((node) => {
              const x = CENTER + Math.cos(node.angle) * RADIUS;
              const y = CENTER + Math.sin(node.angle) * RADIUS;
              return (
                <line
                  key={`line-${node.id}`}
                  x1={CENTER}
                  y1={CENTER}
                  x2={x}
                  y2={y}
                  stroke={ecosystem.color}
                  strokeOpacity={0.15 + (node.influence / 100) * 0.5}
                  strokeWidth={1 + (node.influence / 100) * 2}
                />
              );
            })}
            <circle cx={CENTER} cy={CENTER} r={18} fill={ecosystem.color} fillOpacity={0.9} />
            <text x={CENTER} y={CENTER + 4} textAnchor="middle" fontSize={9} fill="#0a0908" fontWeight={700}>
              {t('syndicateTargetNodeLabel')}
            </text>
            {network.nodes.map((node) => {
              const x = CENTER + Math.cos(node.angle) * RADIUS;
              const y = CENTER + Math.sin(node.angle) * RADIUS;
              return <circle key={node.id} cx={x} cy={y} r={7 + (node.influence / 100) * 6} fill="#14131c" stroke={ecosystem.color} strokeWidth={1.5} />;
            })}
          </svg>

          <ul className="space-y-1.5">
            {network.nodes
              .slice()
              .sort((a, b) => b.influence - a.influence)
              .map((node) => (
                <li key={node.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{t(node.archetypeKey)}</span>
                  <span className="font-mono font-bold" style={{ color: ecosystem.color }}>
                    {node.influence}
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-gray-500">{t('syndicateInfluenceLabel')}</p>
        </motion.div>
      )}
    </div>
  );
}
