---
name: unitas-claude-reviewer
description: Review THE UNITAS GLOBAL changes for security, Supabase, Stripe, and deployment risks using Claude Code when available.
---

Review the current diff as a senior application-security engineer.

Focus on:

- Stripe secret and Price ID exposure
- Supabase auth and Edge Function boundaries
- checkout tampering and redirect safety
- generated-page consistency
- missing tests and deployment hazards

Return findings ordered by severity. Do not edit files, reveal secrets, or run destructive commands.
