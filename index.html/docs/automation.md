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

This generates the module pages, runs Playwright, invokes Claude Code and Gemini reviews when their CLIs are installed, and builds `site-dist/`. Add `-DeploySupabase` to `scripts/release.ps1` only after required Supabase and Stripe secrets are configured.

Set `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` in the user environment or CI secret store. They are passed to external CLIs by the terminal environment and are never written to the repository.

## Universal AI command center

Installed workspace extensions:

```vscode-extensions
continue.continue,rooveterinaryinc.roo-cline,google.geminicodeassist,anthropic.claude-code
```

Continue models are configured in `.continue/config.yaml`: Claude Sonnet, OpenAI GPT, Google Gemini, and DeepSeek. Set the corresponding environment variables before using them:

```powershell
$env:ANTHROPIC_API_KEY = '...'
$env:OPENAI_API_KEY = '...'
$env:GEMINI_API_KEY = '...'
$env:DEEPSEEK_API_KEY = '...'
npm run check:ai
```

The values are referenced through secret placeholders and are never committed. Roo Code uses `.roo/rules/unitas.md` for the same project constraints. VS Code tasks expose build, test, release, agent review, and provider checks from one command palette.

## Local agent toolkit

The checked-in manifest is `config/agent-toolkit.json`. Local source checkouts are kept outside the tracked application in `.agent-tools/`; project skills are generated under `.agents/skills/`.

```powershell
npm run setup:agents -- -InstallProjectSkills
```

This prepares Claude-Mem, Graphify, Superpowers, Strix, and the Vercel Skills CLI entrypoint without changing user-level agent settings. Claude-Mem's official `npx claude-mem install` flow is intentionally documented but not run automatically because it can configure a user profile and offer paid cloud memory.

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
