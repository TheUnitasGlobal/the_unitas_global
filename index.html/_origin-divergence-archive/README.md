# origin/main divergence archive — 2026-08-29

`C:\dev\unitas` (this repo, canonical per owner) and
`github.com/TheUnitasGlobal/the_unitas_global` `main` (`cc769a2`) diverged.
origin/main's `web/` tree was ~7,349 lines / dozens of files BEHIND this repo
(missing the coming-soon system, founders gate, wallet modals, guest identity,
profile fields, full i18n, cinema pipeline, …). Its 75 post-split commits are
mostly Stop-hook `automated low-memory sovereign checkpoint sync` noise.

The ONLY genuine origin-only work was these 3 files — a *different* React
binding for the `lib/uiGate.ts` mutex (this repo uses
`components/ui/useGatedSurface.ts` instead) plus a `preferences.ts`. Captured
here verbatim so nothing from origin is lost when local becomes the canonical
origin/main. Not wired into the build (this repo's gate approach differs);
adopt from here only if deliberately migrating to the Context-provider pattern.

- `components_ui_UIGateProvider.tsx`  — origin web/components/ui/UIGateProvider.tsx
- `lib_preferences.ts`                — origin web/lib/preferences.ts
- `__tests___ui_uiGate.test.ts`       — origin web/__tests__/ui/uiGate.test.ts
