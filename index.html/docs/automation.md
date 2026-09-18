# Automation contract

## Local setup

```powershell
npm run setup:tools -- -InstallMissing
```

The setup script checks Node.js, npm, Git, Supabase CLI, Stripe CLI, and Flutter/Dart. It creates `.env` from `.env.example` only when `.env` does not already exist. Replace all placeholders before running deployment.

## Module pages

`config/modules.json` is the source of truth. Generate Arche, Arena, Score, Fate, and Codex22 pages with:

```powershell
npm run build:pages
```

Generated pages are ignored by Git and rebuilt in CI.

## Stripe validation

```powershell
npm run validate:stripe
```

This calls the Stripe Prices API and verifies that all five configured IDs are active recurring prices. The secret key is read from `.env` and is never printed.

## Supabase deployment

```powershell
$env:SUPABASE_ACCESS_TOKEN = '...'
$env:SUPABASE_PROJECT_REF = 'fjznkonbjoierxvopiko'
npm run deploy:supabase
```

Only server-side Stripe secrets and price IDs are uploaded. `SUPABASE_ANON_KEY` is intentionally not uploaded as an Edge Function secret.

## One-command release

```powershell
npm run release
```

This generates the module pages, runs Playwright, invokes the Claude Code review (both lenses), and builds `site-dist/`. Add `-DeploySupabase` to `scripts/release.ps1` only after required Supabase and Stripe secrets are configured.

Codex v41.0 제4장 destroys every auxiliary-agent CLI integration: `scripts/agent-review.ps1` shells out to `claude` and nothing else, and `-Review` now selects a LENS (`security` | `ux` | `both` | `none`), not a vendor. Set `ANTHROPIC_API_KEY` in the user environment or CI secret store; it is passed to the CLI by the terminal environment and is never written to the repository.

## Universal AI command center

Installed workspace extensions:

```vscode-extensions
continue.continue,rooveterinaryinc.roo-cline,anthropic.claude-code
```

Continue models are configured in `.continue/config.yaml`: Claude Sonnet, OpenAI GPT, and DeepSeek. (Google Gemini was removed on 2026-09-17 under 제4장.) OpenAI and DeepSeek remain because the app itself calls them as MODEL providers — they are not rival control towers. Set the corresponding environment variables before using them:

```powershell
$env:ANTHROPIC_API_KEY = '...'
$env:OPENAI_API_KEY = '...'
$env:DEEPSEEK_API_KEY = '...'
npm run check:ai
```

The values are referenced through secret placeholders and are never committed. Roo Code uses `.roo/rules/unitas.md` for the same project constraints. VS Code tasks expose build, test, release, agent review, and provider checks from one command palette.

## Sovereign agent toolchain (2026-09-10)

Twelve tools (Headroom, task-observer, OmniRoute, Ollama + qwen3:4b, Agent-Reach, find-skills, agent-browser, systematic-debugging, skill-creator, UI/UX Pro Max, 21st.dev, mcporter/yt-dlp/gh) are installed at user scope with version pins recorded in `config/agent-toolkit.json` (`toolchain` block). Reinstall or audit with:

```powershell
npm run setup:toolchain                        # status board
npm run setup:toolchain -- -Install -PullModel # full install on a new machine
```

Model routing is opt-in per process through `scripts/agent/*.ps1` (Headroom proxy, local Ollama, OmniRoute); nothing edits `~/.claude/settings.json` or `.mcp.json`. The 21st.dev HTTP MCP is registered at user scope with an `${API_KEY_21ST}` header reference (`scripts/agent/setup-21st.ps1 -Persist`), and `web/components.json` exposes the same key to the shadcn CLI as the `@21st` registry namespace; the key itself lives only in the Windows User environment. Full matrix, measured limits (7.6 GB laptop, 4B model ceiling), and founder follow-ups: `docs/toolchain/README.md`.

**Figma MCP (2026-09-18, MISSION 2) — staged, not registered.** `scripts/agent/setup-figma.ps1` is the same pattern: a Figma REST `/v1/me` pre-flight proves the credential *before* `~/.claude.json` is touched, the server is registered with a `${FIGMA_API_KEY}` reference so the token never lands in a config file, and a non-`Connected` result is rolled back. It is **not registered today** and that is deliberate — no Figma credential exists on this machine, and an unauthenticated MCP entry becomes a connection failure on every session start (the unreachable playwright plugin is the live example). Activation is one command:

```powershell
$env:FIGMA_API_KEY = '<personal access token>'   # headless, Zero-Touch (제7장)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Persist

# ...or the official OAuth remote instead, which stores no secret at all:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/agent/setup-figma.ps1 -Official
```

Note for anyone following an older instruction: `@modelcontextprotocol/server-figma` and `@figma/mcp` both return npm **E404** (measured 2026-09-18). No official Figma MCP ships on npm. The real options are the pinned third-party `figma-developer-mcp@0.13.2` (headless, personal access token), Figma's remote OAuth server at `https://mcp.figma.com/mcp`, or a local server hosted by the Figma **desktop app** on `127.0.0.1:3845` — the last of which needs that app installed and a Dev Mode seat, so it is not wired here.

## Local agent toolkit

The checked-in manifest is `config/agent-toolkit.json`. Local source checkouts are kept outside the tracked application in `.agent-tools/`; project skills are generated under `.agents/skills/`.

```powershell
npm run setup:agents -- -InstallProjectSkills
```

This prepares Claude-Mem, Graphify, Superpowers, Strix, Ponytail, and the Vercel Skills CLI entrypoint without changing user-level agent settings. Claude-Mem's official `npx claude-mem install` flow is intentionally documented but not run automatically because it can configure a user profile and offer paid cloud memory.

Ponytail (`@dietrichgebert/ponytail` on npm, MIT) is a minimal-code coding-agent skill/ruleset -- a 7-step decision ladder that biases the agent toward stdlib/native/existing-dependency solutions before writing new code, matching this repo's own "three similar lines beats a premature abstraction" stance. Confirmed via research 2026-09-08: this is a real, unrelated project from whatever internal note previously called something "Ponytail 파이프라인 오토메이션" -- it is not a pipeline-automation tool. Not installed automatically; confirm the exact install subcommand in the package's own README first, same as Claude-Mem above.

`tokenpack` (also researched 2026-09-08) exists on npm (Yashwanth9394) as a small JSON->CSV token-compression utility for LLM prompts, but this repo does not depend on it directly -- `web/lib/uai/tokenPack.ts` hand-rolls the same CSV-packing pattern natively (no external dependency for something this small) and is wired into the Review Agent's executive-briefing prompt (`lib/lifeOs/reviewAgent.ts`).

`reborn.ax`, named in an internal note alongside Pomelli/Opal as a marketing-asset tool, does not exist -- its domain does not resolve and no such product was found (research 2026-09-08). Treat that name as stale/a typo until someone provides a corrected reference; nothing in this codebase integrates it.

For zero-cost checkout tests, run the local mock endpoint:

```powershell
npm run mock:checkout
```

It accepts only a module name at `POST http://127.0.0.1:54321/functions/v1/create-checkout-session` and never accepts a client amount or Price ID. Production continues to use the authenticated Supabase Edge Function and server-side Stripe catalog.

## FlutterFlow integration

FlutterFlow does not provide a general project deployment CLI in this repository. Configure a FlutterFlow API Call or Custom Action against:

```text
POST https://<project-ref>.supabase.co/functions/v1/create-checkout-session
Authorization: Bearer <Supabase user access token>
Content-Type: application/json

{"module":"Arche"}
```

The response contains `{ "url": "https://checkout.stripe.com/..." }`; open that URL with FlutterFlow's URL launcher. Allowed module values are `Arche`, `Arena`, `Score`, `Fate`, and `Codex22`. Never send a Stripe secret key or a price ID from FlutterFlow.
