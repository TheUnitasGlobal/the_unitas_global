import type { SupabaseClient } from '@supabase/supabase-js';

// Review Agent module (founder directive 2026-09-08): automated nightly
// audit of the live operational tables, archived as a row in
// public.review_agent_logs (supabase/migrations/20260912000000_life_os_
// sovereign_modules.sql) by POST /api/life/review/run. A companion local
// script (scripts/review-agent-archive.mjs) then mirrors recent runs into
// ~/life/review/ on the founder's own machine -- see that script's header
// comment for why the literal home-directory path can only be written from
// there, never from the serverless route itself.
//
// Deliberately count-only queries (head: true) over tables that already
// exist for other reasons (profiles, wallets, coin_ledger,
// module_access_grants) -- cheap, no new indexes needed, and exactly the
// kind of drift a founder running a 1-person sovereign SaaS actually wants
// flagged nightly: signup-trigger health and payment-gate activity, not a
// simulated/fake "system status".

export type ReviewLevel = 'ok' | 'warn' | 'error';

export interface ReviewFinding {
  code: string;
  level: ReviewLevel;
  message: string;
}

export interface ReviewRunResult {
  status: ReviewLevel;
  summary: string;
  findings: ReviewFinding[];
}

function worstLevel(findings: ReviewFinding[]): ReviewLevel {
  if (findings.some((f) => f.level === 'error')) return 'error';
  if (findings.some((f) => f.level === 'warn')) return 'warn';
  return 'ok';
}

export async function runNightlyAudit(supabase: SupabaseClient): Promise<ReviewRunResult> {
  const findings: ReviewFinding[] = [];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const [profiles, wallets, activeGrants, ledger24h, secondBrainNotes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('wallets').select('*', { count: 'exact', head: true }),
    supabase.from('module_access_grants').select('*', { count: 'exact', head: true }).gt('expires_at', nowIso),
    supabase.from('coin_ledger').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabase.from('second_brain_notes').select('*', { count: 'exact', head: true }),
  ]);

  const errored = [profiles, wallets, activeGrants, ledger24h, secondBrainNotes].filter((r) => r.error);
  if (errored.length > 0) {
    findings.push({
      code: 'query_errors',
      level: 'error',
      message: `감사 쿼리 ${errored.length}건 실패 -- 스키마 또는 권한 점검 필요`,
    });
  }

  const profileCount = profiles.count ?? null;
  const walletCount = wallets.count ?? null;
  if (profileCount != null && walletCount != null) {
    if (profileCount === walletCount) {
      findings.push({
        code: 'wallet_profile_parity',
        level: 'ok',
        message: `프로필/지갑 정합 (${profileCount}건) -- 가입 트리거 정상`,
      });
    } else {
      findings.push({
        code: 'wallet_profile_mismatch',
        level: 'warn',
        message: `프로필 ${profileCount}건 대비 지갑 ${walletCount}건 -- handle_new_user() 트리거 점검 필요`,
      });
    }
  }

  findings.push({
    code: 'active_grants',
    level: 'ok',
    message: `현재 활성 모듈 접근권(module_access_grants) ${activeGrants.count ?? 0}건`,
  });
  findings.push({
    code: 'ledger_24h',
    level: 'ok',
    message: `최근 24시간 코인 원장(coin_ledger) 기록 ${ledger24h.count ?? 0}건`,
  });
  findings.push({
    code: 'second_brain_notes',
    level: 'ok',
    message: `Second Brain 누적 노트 ${secondBrainNotes.count ?? 0}건`,
  });

  const status = worstLevel(findings);
  const summary = `야간 감사 완료 -- 항목 ${findings.length}건, 상태: ${status.toUpperCase()}`;

  return { status, summary, findings };
}
