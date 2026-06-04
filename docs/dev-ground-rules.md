# Dev Ground Rules

Use this document to keep the expectations clear whenever I’m making changes in this repo.

1. **Keep product work in this repo.** In this workspace, all ShortPulse code and docs live under `ShortPulse/`. Supporting non-code artifacts belong in `../assets/`; older snapshots belong in `../archive/`.
2. **Own the structure.** I’m responsible for keeping the repo tidy—if a new feature needs folders, I create them here, document them, and remove stray duplicates.
3. **Document new rules.** When conventions evolve, append them to this file so future work stays consistent.
4. **Prefer existing tooling before adding new dependencies.** If a capability already exists in `docs/`, shared components, or scripts, reuse or extend it rather than introducing redundant code.
5. **Keep user data scoped.** Any Supabase work must preserve per-user isolation by default (auth checks, RLS policies, namespaced storage paths).
6. **Ship UI changes with matching styles.** When adding a page or component, wire the relevant CSS and reference the design palette/spacing so the experience stays cohesive with the rest of the app.
7. **Surface impact in docs.** Major additions (routes, SOPs, security tweaks) deserve at least a note in the appropriate document (`docs/planning/backlog.md`, `docs/sops/sop_*.md`, etc.) so future contributors know what changed.
8. **Plan label palette is fixed.** Wherever plan info is shown, use: `Starter` (white), `Media` (green `#4ea09e`), `Studio` (brand blue/teal), `Business` (amber). Default prototype plan is `Business` unless user metadata overrides.
9. **Default to clean, readable modules.** Optimize for clarity over cleverness; code should stay easy to read, maintain, and extend.
10. **Keep files short (guideline).** Aim for ~500 lines or less; if a file grows beyond that, document the reason and plan a split when practical.
11. **Separate concerns.** UI, logic, data access, and utilities live in their own files/modules—no god files, no mixed responsibilities, no generic dumping-ground utils.
12. **Prefer explicit, small functions.** Short, well-named functions beat abstractions; preserve existing behavior during refactors.
13. **Comment intentionally.** Every file needs a top-level comment covering purpose, responsibilities, and how it fits the system. Public functions get doc-style comments (purpose, inputs, outputs, side effects). Inline comments explain intent or edge cases—never restate obvious code.
14. **Plan-first refactors.** For structural changes: audit first, propose the modular plan (folders/files and responsibilities), then execute incrementally and validate that structure/line limits are met.
15. **Keep structure manageable.** Use feature/domain folders, avoid deep nesting and circular deps, isolate side effects, and keep business logic out of UI glue.
16. **Use Supabase CLI and avoid Docker for Supabase ops.** For Supabase access in this repo, use Supabase CLI with explicit hosted targets; do not run Docker-based local Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).
17. **Treat `npm run db:reset` as blocked by policy.** The script intentionally exits non-zero to prevent local reset workflows that violate this repo's Supabase operations policy.
18. **Do not continue by adjacency or momentum.** New work must start from a concrete problem statement and a repo-backed reason it is a better use of time than stopping; nearby files or easy-to-add tests are not enough.
19. **Do not commit transpiled JS sidecars for frontend source modules.** Under `frontend/features/`, `frontend/lib/`, and `frontend/prefabs/`, `.ts/.tsx` files are the source of truth; generated CommonJS/compiled `.js` siblings should be removed or ignored rather than committed.
20. **Use the pre-launch production branch deliberately.** During the current pre-launch production-readiness phase through the Copperknot launch decision window ending `2026-07-07`, `production` is the only active local and GitHub branch for repo work. Keep `git config --local shortpulse.allowedBranch` set to `production`, do not create or promote feature/staging branches, and never push directly to `main`.
21. **Use canonical active Seedance 2 IDs.** The active Kie Seedance 2 lanes are `kie-ai/seedance-2` and `kie-ai/seedance-2-fast`. Treat those IDs as canonical in code, docs, validation, and support assumptions; do not reintroduce the stale `seedance-2.0` naming or quarantine guidance.
22. **Generate CTAs stay validation-only.** If a Generate button is active, it must stay visibly ready to click: no in-button busy spinners, no busy labels, no `aria-busy`, and no disabling purely because a generation is already in flight. Show progress on output cards, stage overlays, banners, or other status surfaces instead, and preserve rapid repeat clicks whenever the underlying generate lane supports them. Run `npm -C frontend run check:generate-cta-contract` after touching Generate CTA surfaces.
23. **AI Studio right rail is global.** `Reference Grid`, `Quick Slot Inventory`, and `Canvas` are workspace-global right-rail surfaces across all AI Studio workflows and all Create modes. Do not split, reset, shadow, or persist them as workflow-local, route-local, Standard-only, Pulse-only, or mode-local state. If a workflow needs lane-specific behavior, layer it on top of the shared right-rail authority instead of forking the right rail. Use `docs/adr/0083-create-mode-global-right-rail-authority.md`, `docs/sops/sop_ai_studio_pulse_mode.md`, and `docs/sops/sop_ai_studio_create_properties_generation_wiring.md` as the canonical references.
24. **Fix the canonical path.** When behavior is broken or incomplete, trace the owning implementation and correct it at the source. Do not add parallel paths, duplicate implementations, hidden fallback behavior, backup copies, or legacy variants to bypass the root problem. Compatibility, migration scaffolding, or platform-required alternate transport is allowed only when it is explicitly documented as the canonical plan for that constraint, with an owner, validation path, and removal condition when temporary.
25. **Use the production URL for pre-launch browser validation.** During the pre-launch phase, browser/manual validation for production work targets `https://www.shortpulse.ai`. Do not open or rely on `localhost`, `127.0.0.1`, arbitrary preview URLs, or local browser sessions unless the user explicitly asks for local development, localhost, or a non-production dry run in the current thread. Local tests and commands can validate implementation details, but they do not prove deployed production behavior.

## Canonical run commands (always respond with these)

- **Frontend startup** (new terminal):
  ```
  cd frontend
  npm run dev
  ```
- Use the frontend startup command only when the user explicitly asks for local development or a local repro. Pre-launch browser validation should use `https://www.shortpulse.ai`.
- **Install steps are one-time** (or when dependencies change): `npm install` only when setting up a new environment or after package changes; do not repeat on every restart. If asked for the frontend command, provide `npm run dev` (plus the one-time `npm install` note only when relevant).

_Suggestions for future rules_

- Define how to handle large assets (where to store example data or design exports).
- Specify when to add a runbook/sop entry alongside new features.
- Outline branch naming or commit conventions for multi-contributor work.
- Add a checklist for supabase security verifications before shipping auth-related changes.
