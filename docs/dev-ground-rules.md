# Dev Ground Rules

Use this document to keep the expectations clear whenever I’m making changes in this repo.

1. **Keep product work in this repo.** In this workspace, all ShortPulse code and docs live under `ShortPulse/`. Supporting non-code artifacts belong in `../assets/`; older snapshots belong in `../archive/`.
2. **Own the structure.** I’m responsible for keeping the repo tidy—if a new feature needs folders, I create them here, document them, and remove stray duplicates.
3. **Document new rules.** When conventions evolve, append them to this file so future work stays consistent.
4. **Prefer existing tooling before adding new dependencies.** If a capability already exists in `docs/`, shared components, or scripts, reuse or extend it rather than introducing redundant code.
5. **Keep user data scoped.** Any Supabase work must preserve per-user isolation by default (auth checks, RLS policies, namespaced storage paths).
6. **Ship UI changes with matching styles.** When adding a page or component, wire the relevant CSS and reference the design palette/spacing so the experience stays cohesive with the rest of the app.
7. **Surface impact in docs.** Major additions (routes, SOPs, security tweaks) deserve at least a note in the appropriate document (`docs/planning/backlog.md`, `docs/sops/sop_*.md`, etc.) so future contributors know what changed.
8. **Plan label palette is fixed.** Wherever plan info is shown, use: `Free` (white), `Media` (green `#4ea09e`), `Studio` (brand blue/teal), `Business` (amber). Default prototype plan is `Business` unless user metadata overrides.
9. **Default to clean, readable modules.** Optimize for clarity over cleverness; code should stay easy to read, maintain, and extend.
10. **Keep files short (guideline).** Aim for ~500 lines or less; if a file grows beyond that, document the reason and plan a split when practical.
11. **Separate concerns.** UI, logic, data access, and utilities live in their own files/modules—no god files, no mixed responsibilities, no generic dumping-ground utils.
12. **Prefer explicit, small functions.** Short, well-named functions beat abstractions; preserve existing behavior during refactors.
13. **Comment intentionally.** Every file needs a top-level comment covering purpose, responsibilities, and how it fits the system. Public functions get doc-style comments (purpose, inputs, outputs, side effects). Inline comments explain intent or edge cases—never restate obvious code.
14. **Plan-first refactors.** For structural changes: audit first, propose the modular plan (folders/files and responsibilities), then execute incrementally and validate that structure/line limits are met.
15. **Keep structure manageable.** Use feature/domain folders, avoid deep nesting and circular deps, isolate side effects, and keep business logic out of UI glue.
16. **Use Supabase CLI and avoid Docker for Supabase ops.** For Supabase access in this repo, use Supabase CLI with explicit hosted targets; do not run Docker-based local Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).

## Canonical run commands (always respond with these)
- **Frontend startup** (new terminal):
  ```
  cd frontend
  npm run dev
  ```
- **Install steps are one-time** (or when dependencies change): `npm install` only when setting up a new environment or after package changes; do not repeat on every restart. If asked for the frontend command, provide `npm run dev` (plus the one-time `npm install` note only when relevant).

_Suggestions for future rules_
- Define how to handle large assets (where to store example data or design exports).
- Specify when to add a runbook/sop entry alongside new features.
- Outline branch naming or commit conventions for multi-contributor work.
- Add a checklist for supabase security verifications before shipping auth-related changes.
