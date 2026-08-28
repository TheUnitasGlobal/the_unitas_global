'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { evaluatePassword, type PasswordRuleId } from '@/lib/passwordPolicy';

const RULE_ORDER: PasswordRuleId[] = ['length', 'lower', 'upper', 'digit', 'special'];

/** Live pass/fail list for the password policy, shared by sign-up and the
 *  Account-settings password change. Copy comes from `Auth.pwRule.*`. */
export function PasswordChecklist({ value }: { value: string }) {
  const t = useTranslations('Auth');
  const { results, score, valid } = evaluatePassword(value);
  const byId = new Map(results.map((r) => [r.id, r.ok]));

  const barTone =
    valid ? 'bg-neon' : score >= 3 ? 'bg-amber-400' : score >= 1 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="h-1 w-full overflow-hidden rounded bg-white/10" aria-hidden="true">
        <div
          className={`h-full rounded transition-all ${barTone}`}
          style={{ width: `${valid ? 100 : Math.min(90, score * 22 + (byId.get('length') ? 10 : 0))}%` }}
        />
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {RULE_ORDER.map((id) => {
          const ok = byId.get(id) ?? false;
          return (
            <li
              key={id}
              className={`flex items-center gap-1.5 text-[10px] ${ok ? 'text-neon' : 'text-gray-500'}`}
            >
              {ok ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
              {t(`pwRule.${id}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
