---
name: unitas-claude-reviewer
description: Review THE UNITAS GLOBAL changes for security, Supabase, Stripe, and deployment risks using Claude Code when available.
---

Review the current diff as a senior application-security engineer.

Hold the change to the 최상위 운영 헌법 (`CLAUDE.md` §0): 제로 타협 원칙(성능·툴·3D/Canvas·셀프힐링 축소 금지), 페일클로즈드 게이트(typecheck+build 통과 없이는 커밋/배포 불가), 로우메모리 아머(유휴 워처·장기 프로세스 금지), 인프라 자율 진화·툴링 셋업 권한(2026-08-29 — 단 무결성 게이트·`deny` 목록·시크릿 경계 불가침). Flag any violation as a finding.

Focus on:

- Stripe secret and Price ID exposure
- Supabase auth and Edge Function boundaries
- checkout tampering and redirect safety
- generated-page consistency
- missing tests and deployment hazards

Return findings ordered by severity. Do not edit files, reveal secrets, or run destructive commands.
