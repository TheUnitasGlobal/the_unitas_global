import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInsight, insightProviderAvailable } from '@/lib/uai/provider';
import { packRecordsForPrompt } from '@/lib/uai/tokenPack';

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
//
// Ledger review + executive briefing (founder audit 2026-09-08): beyond
// the original parity/count checks, the audit now also samples
// coin_ledger's `kind` distribution over the last 7 days (refund share is
// the one anomaly worth flagging nightly -- a refund spike means something
// upstream is failing paid generation after the burn already landed, see
// the "no auto-refund" gap documented in CLAUDE.md). A short natural-
// language executive briefing is then generated FREE via the same U-AI
// provider chain (lib/uai/provider.ts, now with its own free-tier
// fallback-on-failure) so the founder gets one paragraph of narrative
// instead of only a bare findings list -- fail-open: no provider
// configured, or the call fails, and `briefing` is simply null.

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

/** 7일 환불 비율이 이 값을 넘으면 경고 -- 결제 이후 생성 실패가 쌓이고 있다는 신호. */
const REFUND_SHARE_WARN_THRESHOLD = 0.1;

function worstLevel(findings: ReviewFinding[]): ReviewLevel {
  if (findings.some((f) => f.level === 'error')) return 'error';
  if (findings.some((f) => f.level === 'warn')) return 'warn';
  return 'ok';
}

export async function runNightlyAudit(supabase: SupabaseClient): Promise<ReviewRunResult> {
  const findings: ReviewFinding[] = [];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [profiles, wallets, activeGrants, ledger24h, secondBrainNotes, ledger7dKinds] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('wallets').select('*', { count: 'exact', head: true }),
    supabase.from('module_access_grants').select('*', { count: 'exact', head: true }).gt('expires_at', nowIso),
    supabase.from('coin_ledger').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
    supabase.from('second_brain_notes').select('*', { count: 'exact', head: true }),
    // Ledger review (founder audit 2026-09-08): row-level, not count-only --
    // `kind` isn't exposed by a head-count query, and a 7-day window on a
    // 1-person sovereign SaaS is a small enough row count that this stays
    // cheap. Only the one column is selected, never full ledger rows.
    supabase.from('coin_ledger').select('kind').gte('created_at', weekAgo),
  ]);

  const errored = [profiles, wallets, activeGrants, ledger24h, secondBrainNotes, ledger7dKinds].filter(
    (r) => r.error,
  );
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

  const ledgerRows = ledger7dKinds.data ?? [];
  if (ledgerRows.length > 0) {
    const refundCount = ledgerRows.filter((row) => row.kind === 'refund').length;
    const refundShare = refundCount / ledgerRows.length;
    if (refundShare > REFUND_SHARE_WARN_THRESHOLD) {
      findings.push({
        code: 'ledger_refund_spike',
        level: 'warn',
        message: `최근 7일 원장 ${ledgerRows.length}건 중 환불 ${refundCount}건 (${Math.round(refundShare * 100)}%) -- 결제 이후 생성 실패 누적 여부 점검 필요`,
      });
    } else {
      findings.push({
        code: 'ledger_refund_share',
        level: 'ok',
        message: `최근 7일 원장 ${ledgerRows.length}건 중 환불 ${refundCount}건 (${Math.round(refundShare * 100)}%) -- 정상 범위`,
      });
    }
  }
  findings.push({
    code: 'second_brain_notes',
    level: 'ok',
    message: `Second Brain 누적 노트 ${secondBrainNotes.count ?? 0}건`,
  });

  const status = worstLevel(findings);
  const summary = `야간 감사 완료 -- 항목 ${findings.length}건, 상태: ${status.toUpperCase()}`;

  return { status, summary, findings };
}

const BRIEFING_SYSTEM_PROMPT =
  '너는 THE UNITAS GLOBAL OÜ의 1인 창립자에게 매일 밤 운영 감사 결과를 보고하는 경영 참모다. ' +
  '주어진 감사 항목(CSV)을 근거로 딱 한 문단(3~5문장), 한국어 평서문으로 브리핑을 써라. ' +
  '수치를 인용하고, 경고/에러가 있으면 무엇을 먼저 점검해야 하는지 명시하고, 전부 정상이면 그렇게만 짧게 확인하라. ' +
  '과장된 표현이나 이 회사 특유의 초월적 수사는 쓰지 말고, 실무 보고서처럼 건조하게 써라.';

/**
 * Generates a short natural-language executive briefing from a completed
 * audit's findings, via the U-AI provider chain (free-tier fallback
 * included). Fail-open by design: no provider configured, or the call
 * throws for any reason (network, rate limit, malformed response), and
 * this returns null -- the audit itself (runNightlyAudit above) already
 * succeeded and archived regardless of whether a narrative could be added
 * on top of it.
 *
 * The findings array is packed as CSV (lib/uai/tokenPack.ts) rather than
 * JSON.stringify'd into the prompt -- one repeated flat shape
 * ({code, level, message}), exactly what that packer is for, and it costs
 * measurably fewer input tokens on every nightly run over the life of the
 * feature.
 */
export async function craftExecutiveBriefing(result: ReviewRunResult): Promise<string | null> {
  if (!insightProviderAvailable()) return null;
  try {
    const packedFindings = packRecordsForPrompt(
      result.findings.map((f) => ({ code: f.code, level: f.level, message: f.message })),
    );
    const userPrompt = `감사 상태: ${result.status}\n요약: ${result.summary}\n\n항목(CSV):\n${packedFindings}`;
    const { text } = await generateInsight(BRIEFING_SYSTEM_PROMPT, userPrompt, 400);
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
