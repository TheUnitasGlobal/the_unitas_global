'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { runGenesisConstruction, type GenesisResult } from '@/lib/engines/genesis';
import type { EcosystemTheme } from '@/lib/ecosystems';

const INPUT_CLASS =
  'w-full border bg-void px-3 py-2 text-sm text-white outline-none transition-colors';

function Field({
  label,
  value,
  onChange,
  color,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  step?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={INPUT_CLASS}
        style={{ borderColor: `${color}44` }}
      />
    </div>
  );
}

export function GenesisEngine({ ecosystem }: { ecosystem: EcosystemTheme }) {
  const t = useTranslations('ModuleEngine');
  const [pricePerUnit, setPricePerUnit] = useState(50);
  const [costPerUnit, setCostPerUnit] = useState(20);
  const [fixedCostsPerMonth, setFixedCostsPerMonth] = useState(2000);
  const [startingCustomers, setStartingCustomers] = useState(10);
  const [monthlyGrowthRate, setMonthlyGrowthRate] = useState(15);
  const [result, setResult] = useState<GenesisResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (running) return;
    setRunning(true);
    window.setTimeout(() => {
      setResult(
        runGenesisConstruction({
          pricePerUnit,
          costPerUnit,
          fixedCostsPerMonth,
          startingCustomers,
          monthlyGrowthRate,
        }),
      );
      setRunning(false);
    }, 700);
  }

  const maxAbs = result ? Math.max(1, ...result.projection.map((v) => Math.abs(v))) : 1;

  return (
    <div className="text-left">
      <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('genesisPriceLabel')} value={pricePerUnit} onChange={setPricePerUnit} color={ecosystem.color} />
        <Field label={t('genesisCostLabel')} value={costPerUnit} onChange={setCostPerUnit} color={ecosystem.color} />
        <Field
          label={t('genesisFixedCostsLabel')}
          value={fixedCostsPerMonth}
          onChange={setFixedCostsPerMonth}
          color={ecosystem.color}
        />
        <Field
          label={t('genesisCustomersLabel')}
          value={startingCustomers}
          onChange={setStartingCustomers}
          color={ecosystem.color}
        />
        <div className="sm:col-span-2">
          <Field
            label={t('genesisGrowthLabel')}
            value={monthlyGrowthRate}
            onChange={setMonthlyGrowthRate}
            color={ecosystem.color}
            step={0.5}
          />
        </div>
        <button
          type="submit"
          disabled={running}
          className="sm:col-span-2 py-2.5 text-xs font-bold uppercase tracking-widest text-void transition-all disabled:cursor-wait disabled:opacity-50"
          style={{ backgroundColor: ecosystem.color }}
        >
          {running ? t('genesisRunningLabel') : t('genesisRunButton')}
        </button>
      </form>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {result.axiomViolations.length > 0 ? (
            <div className="border border-red-500/40 bg-red-500/5 p-4">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-red-400">
                {t('genesisAxiomViolationLabel')}
              </p>
              <ul className="space-y-1 text-xs text-red-300">
                {result.axiomViolations.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                  {t('genesisProjectionLabel')}
                </p>
                <div className="flex items-end gap-1 h-24">
                  {result.projection.map((v, i) => {
                    const height = Math.max(4, (Math.abs(v) / maxAbs) * 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`M${i + 1}: ${v}`}>
                        <div
                          className="w-full"
                          style={{
                            height: `${height}%`,
                            backgroundColor: v >= 0 ? ecosystem.color : '#ef4444',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between border-t border-white/10 pt-3 text-xs">
                <span className="text-gray-500">{t('genesisBreakevenLabel')}</span>
                <span className="font-bold" style={{ color: ecosystem.color }}>
                  {result.breakevenMonth ? `M${result.breakevenMonth}` : t('genesisNoBreakeven')}
                </span>
              </div>
            </>
          )}

          <p className="text-sm font-medium text-white">{t(result.verdict)}</p>
        </motion.div>
      )}
    </div>
  );
}
