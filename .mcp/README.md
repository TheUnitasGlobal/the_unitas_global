# MCP servers for local AI agent control

`config.json` in this directory declares three MCP servers so Roo Code (or
any other MCP-capable agent) can operate on this repo and its Supabase
project directly. It uses the standard `{ "mcpServers": { ... } }` schema
most clients read; wire it into your agent per its own docs (Roo Code:
Settings -> MCP Servers -> "Edit Global/Project MCP" and paste this file's
contents, or point it at this file directly if it supports that).

## Before it works

1. **filesystem** -- works out of the box (`npx -y @modelcontextprotocol/server-filesystem .`), scoped to this repo root. No setup needed.

2. **supabase** -- replace the two placeholders in `config.json`:
   - `YOUR_SUPABASE_PROJECT_REF` -- the project ref (same one used by `scripts/deploy-supabase.ps1` at the repo root and `web/scripts/generate-types.ps1`).
   - `YOUR_SUPABASE_PERSONAL_ACCESS_TOKEN` -- create one at https://supabase.com/dashboard/account/tokens.

   **This project's Supabase database is live production** (the coin-core
   wallet system -- see the root repo's memory notes / `THE_UNITAS_GLOBAL_MASTER_ARCHIVE.md`).
   The server is configured `--read-only` on purpose -- do not drop that
   flag for a project pointed at this ref. If you need to let an agent run
   migrations or write queries, do it against a separate dev/staging
   Supabase project, never this one.

3. **git** -- requires [`uv`](https://docs.astral.sh/uv/) installed (provides `uvx`), since the official git MCP server is a Python package, not npm. Install with `pipx install uv` or see the uv docs; no separate `pip install` step needed after that, `uvx` fetches `mcp-server-git` on first run.
