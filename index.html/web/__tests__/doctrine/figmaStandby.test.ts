import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Module-level test isolation (CLAUDE.md) — pure static-text assertions over
 * repo files. No Supabase, no DOM, no other module's fixtures.
 *
 * MISSION 1 (founder directive 2026-09-18).
 *
 * The founder adopted route A (headless Figma personal access token) as the
 * sole Figma MCP route and retired route B (Figma's OAuth remote server) at the
 * source: OAuth needs one interactive browser consent per machine and caps
 * Starter plans and View/Collab seats near six tool calls PER MONTH, both of
 * which contradict unattended operation (Codex 제6장 제로 핸즈 · 제7장 제로터치
 * 무인 인증). The wiring was left in STANDBY: no credential exists on this
 * machine yet, and the moment one is planted in the OS environment the probe
 * must complete the connection with no human in the loop.
 *
 * Three properties of that wiring are load-bearing and all three are invisible
 * to typecheck, to vitest's normal surface and to the build, because the files
 * are PowerShell:
 *
 *   1. standby must be a NON-FATAL state. If the keyless path exits non-zero,
 *      the toolchain board's Invoke-Step throws and `npm run setup:toolchain`
 *      starts failing for everyone, forever, over a credential nobody has yet.
 *   2. the credential must be PROVEN against Figma REST before it is persisted.
 *      An earlier revision persisted first and probed second, which left a
 *      rejected token in the User environment after a failed run.
 *   3. the token must be registered as the literal ${FIGMA_API_KEY} reference.
 *      In a double-quoted PowerShell string the shell expands it and writes the
 *      secret into ~/.claude.json — a user-global file outside the repo.
 *
 * This spec pins all three, plus the retirement itself, so a later "cleanup"
 * cannot quietly restore the OAuth route or reorder the persist/probe pair.
 */

const WEB_ROOT = join(__dirname, '../..'); // index.html/web
const OPS_ROOT = join(WEB_ROOT, '..'); // index.html

const FIGMA = readFileSync(join(OPS_ROOT, 'scripts', 'agent', 'setup-figma.ps1'), 'utf8');
const TOOLCHAIN = readFileSync(join(OPS_ROOT, 'scripts', 'setup-toolchain.ps1'), 'utf8');
const MANIFEST = readFileSync(join(OPS_ROOT, 'config', 'agent-toolkit.json'), 'utf8');

describe('Figma MCP — the OAuth route is retired, not merely unused', () => {
  it('keeps -Official only as a tombstone that registers nothing', () => {
    expect(FIGMA).toContain('[switch]$Official');
    expect(FIGMA).toContain('RETIRED by founder decree on 2026-09-18');
    expect(FIGMA).toContain('Nothing was registered.');
    expect(FIGMA).toContain('exit 3');
  });

  it('no longer calls `claude mcp add --transport http` for the remote server', () => {
    expect(FIGMA).not.toContain('--transport http');
  });

  it('records the decision in the toolkit manifest rather than only in a comment', () => {
    const figma = JSON.parse(MANIFEST).toolchain.tools.figma;
    expect(figma.route).toMatch(/HEADLESS PAT ONLY/);
    expect(figma.route).toMatch(/RETIRED route B/);
    expect(figma.standby).toMatch(/ARMED/);
  });
});

describe('Figma MCP — standby is unattended and fail-closed', () => {
  it('declares the -Standby switch', () => {
    expect(FIGMA).toContain('[switch]$Standby');
  });

  it('treats an absent credential as a healthy state (exit 0), not a failure', () => {
    // Property 1. The keyless branch must report ARMED and fall through to `exit 0`;
    // a non-zero there breaks `npm run setup:toolchain` for everyone.
    const start = FIGMA.indexOf('if ($Standby) {');
    const end = FIGMA.indexOf('# ---- Explicit one-shot route');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const standby = FIGMA.slice(start, end);
    expect(standby).toContain('standby: ARMED');
    expect(standby).toContain('exit 0');
    expect(standby).not.toContain('exit 2');
    expect(standby).not.toContain('exit 1');
  });

  it('resolves the token from process, User and Machine scope', () => {
    // A fresh shell, a scheduled task and a session hook each see a different subset.
    expect(FIGMA).toContain("GetEnvironmentVariable('FIGMA_API_KEY', 'User')");
    expect(FIGMA).toContain("GetEnvironmentVariable('FIGMA_API_KEY', 'Machine')");
  });

  it('unregisters a server whose ${FIGMA_API_KEY} reference resolves nowhere', () => {
    // Otherwise standby decays into a connection failure on every session start.
    expect(FIGMA).toContain('resolves nowhere');
    expect(FIGMA).toContain('returned to standby');
  });

  it('proves the credential against Figma REST BEFORE persisting it', () => {
    // Property 2 — ordering, not mere presence.
    const probe = FIGMA.indexOf('https://api.figma.com/v1/me');
    const persist = FIGMA.indexOf("SetEnvironmentVariable('FIGMA_API_KEY'");
    expect(probe).toBeGreaterThan(-1);
    expect(persist).toBeGreaterThan(-1);
    expect(probe).toBeLessThan(persist);
  });

  it('registers the token as a ${VAR} reference in a single-quoted argument', () => {
    // Property 3. Double quotes here would expand the variable and write the
    // secret into ~/.claude.json.
    expect(FIGMA).toContain("-e 'FIGMA_API_KEY=${FIGMA_API_KEY}'");
    expect(FIGMA).toContain('figma-developer-mcp@0.13.2');
    expect(FIGMA).toContain('--stdio');
  });

  it('rolls back a registration that stored the secret literally or did not connect', () => {
    expect(FIGMA).toContain('rolled back (fail-closed)');
    expect(FIGMA).toContain("$get -notmatch 'Connected'");
  });
});

describe('Figma MCP — the standby probe is actually wired to a caller', () => {
  it('runs from the toolchain installer rung', () => {
    expect(TOOLCHAIN).toMatch(/Invoke-Step 'Figma MCP standby[^']*'[\s\S]{0,160}setup-figma\.ps1'\) -Standby/);
  });

  it('runs from the status-only board, so no command is needed at activation time', () => {
    expect(TOOLCHAIN).toMatch(/\$figmaProbe = \(& \(Join-Path \$PSScriptRoot 'agent\\setup-figma\.ps1'\) -Standby \*>&1 \| Out-String\)/);
    expect(TOOLCHAIN).toContain('Figma MCP: $figmaState');
  });

  it('captures every stream, because the rollback path reports through Write-Warning', () => {
    // `2>&1` would miss the warning stream and mis-report a rollback as silence.
    expect(TOOLCHAIN).not.toMatch(/setup-figma\.ps1'\) -Standby 2>&1/);
  });
});

describe('Figma MCP — these assertions can go red', () => {
  // A guard that cannot fail is worse than no guard (IMPECCABLE_TASTE rule 13).
  it('the ordering check inverts on a persist-before-probe text', () => {
    const mutated = "SetEnvironmentVariable('FIGMA_API_KEY' ... https://api.figma.com/v1/me";
    expect(mutated.indexOf('https://api.figma.com/v1/me')).toBeGreaterThan(
      mutated.indexOf("SetEnvironmentVariable('FIGMA_API_KEY'"),
    );
  });

  it('the single-quote check rejects a double-quoted registration argument', () => {
    const mutated = '-e "FIGMA_API_KEY=${FIGMA_API_KEY}"';
    expect(mutated).not.toContain("-e 'FIGMA_API_KEY=${FIGMA_API_KEY}'");
  });

  it('the wiring check fails when the toolchain stops invoking the probe', () => {
    const mutated = TOOLCHAIN.split('-Standby').join('-Persist');
    expect(mutated).not.toMatch(/setup-figma\.ps1'\) -Standby/);
  });
});
