# Agent Playbook

Single-page guide for AI agents and contributors to work safely in this repo.

## Canonical commands
- Frontend dev server: `cd frontend && npm run dev`
- One-time deps: `cd frontend && npm install`
- Optional checks: `cd frontend && npm run lint` / `npm run build`

## Structure to respect
- App lives in `frontend/` (Next.js pages router with client UI plus internal server API routes).
- Docs in `docs/`; start at `docs/README.md`, keep API refs in `docs/api/`, SOPs in `docs/sops/`, and ADRs in `docs/adr/`.
- Supabase bootstrap SQL in `sql/`; do not add secrets.
- Follow feature module pattern (`features/<name>/{types,constants,data,utils,logic,components}`) and keep pages thin.
- Aim to keep files under ~500 lines; if they exceed, document why and plan a split.

## Styling rules
- Use modular CSS under `frontend/styles/`; do not add rules to `globals.css`.
- Prefer feature-scoped CSS files rather than growing very large sheets; split when practical.

## Supabase and security
- Only use anon key on the client; never check in service-role keys or `.env.local`.
- Enforce per-user isolation: RLS on `saved_creators`, `media_files`, and private `media_library` bucket paths (`auth.uid()` scoped).
- Protected routes: `/dashboard`, `/performance*`, `/saved-creators`, `/media-library`, `/profile`, `/ai-studio`, `/creator-studio`, `/character*`, `/admin`.
- Reuse `frontend/lib/supabaseClient` and `useProtectedRoute` instead of ad-hoc clients.
- Use Supabase CLI for Supabase access and avoid Docker-based local Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).

## File hygiene
- Every file needs a top-level purpose comment; exported functions/components get doc comments when not obvious.
- Avoid embedding sample data in pages; keep fixtures in `data/`.
- Do not edit generated output (`.next/`, `node_modules/`).

## When adding features
- Create a feature folder first, define types/constants, then utils/logic, then components; pages orchestrate only.
- Add or update SOPs/docs for new routes and Supabase tables; add ADRs for durable architectural changes.
- Update `docs/routes.md` and `docs/repo-structure.md` if new routes/folders are created.

## Safe defaults for agents
- Prefer existing helpers/components before adding new dependencies.
- Keep UI consistent with existing palette/spacing (see `docs/styles-structure.md`).
- For large refactors, propose a plan and execute incrementally; avoid exceeding file size limits.
- Keep documentation contract-driven and no-bloat:
  - update docs when behavior/contracts/gates change,
  - prefer updating existing docs over creating new planning docs unless a new durable artifact is required.

## Execution guardrails
- Do not choose the next task by adjacency alone. Nearby files, similar routes, or matching test patterns are not sufficient justification.
- Start each new lane with a concrete problem statement: the risk/bug, why it matters, and why this target has better ROI than stopping.
- Require route/API tests to cover route-owned behavior or failure handling that shared logic tests do not already protect.
- Prefer one coherent lane at a time. Finish it, checkpoint it, or explicitly stop it before starting another lane.
- Stay on the current user-approved branch. Do not switch branches, commit on another branch, push another branch, merge into another branch, or promote work to another branch unless the user explicitly instructs that specific branch action in the current thread.
- Keep `git config --local shortpulse.allowedBranch` set to the current user-approved branch. Local Husky `pre-commit` and `pre-push` hooks enforce that the current branch and push target match it.
- Never push directly to `main` unless the user explicitly changes that rule.
- Use targeted validation during a lane and reserve full `npm run validate` for meaningful checkpoints, not every small diff.
- Stop when the next change is no longer clearly reducing risk more than it adds churn.

## Maintenance skills
- Run `npm -C frontend run docs:check` to validate markdown/index integrity plus semantic parity checks (routes, API inventory, migrations, archive manifest).
- Use `skills/skill-session-startup-contract/SKILL.md` at the start of every new task/session to enforce startup preflight, core context loading, and no-edit gating.
- Use `skills/skill-pricing-audit/SKILL.md` before changing pricing/models or credit logic.
- Use `skills/skill-doc-index/SKILL.md` when adding or renaming docs.
- Use `skills/skill-ui-ux-critic/SKILL.md` for UI-focused PR audits and trend-fit recommendations.
- Use `skills/palette-normalizer/SKILL.md` for dry-run-first CSS palette drift audits and safe normalization passes.
- Use `skills/skill-mvp-security-audit/SKILL.md` when executing P0 security blockers from the MVP pre-tester remediation plan.
- Use `skills/skill-mvp-modularization-pass/SKILL.md` when splitting oversized files and enforcing modularity thresholds.
- Use `skills/skill-mvp-docs-sop-governance/SKILL.md` when resolving docs/SOP drift and archive/index hygiene.
- Use `skills/skill-media-storage-deploy-gate/SKILL.md` when the user is preparing to deploy and media storage integrity must be pass/fail gated.
- Use `skills/adaptive-parity-check/SKILL.md`, `skills/adaptive-surface-smoke/SKILL.md`, and `skills/adaptive-perf-audit/SKILL.md` during Adaptive Media V2 rollout/tuning phases.
- Use `skills/adaptive-change-gate/SKILL.md` before merging any change that touches adaptive media or reference-grid adaptive delivery paths.
