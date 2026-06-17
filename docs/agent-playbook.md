# Agent Playbook

Single-page guide for AI agents and the solo human owner to work safely in this repo.

ShortPulse is currently one human owner/operator. Named agents are bounded AI authority surfaces for their documented lanes, not a larger human team. Treat references to owners, reviewers, operators, or contributors as the user or the named AI agent/workflow responsible for that bounded surface unless the user explicitly says another human is involved.

Authority shortcuts:

- `AGENTS.md` is the controlling repo contract.
- `skills/skill-session-startup-contract/SKILL.md` is the startup checklist and freshness trigger list.
- `docs/agents/solo-owner-launch-trust-standard.md` defines launch-relevant claim quality and delegated authority.
- Named-agent contracts define lane scope and default-load instructions for that agent.

## Canonical commands

- Frontend dev server: `cd frontend && npm run dev`
- One-time deps: `cd frontend && npm install`
- Common checks: `cd frontend && npm run lint` / `npm run build`
- Full pre-launch release authority lives in `docs/agents/copperknot/july-7-launch-authority.md`; do not treat the common checks above as the whole ship bar.

## Structure to respect

- App lives in `frontend/` (Next.js pages router with client UI plus internal server API routes).
- Docs in `docs/`; start at `docs/README.md`, keep API refs in `docs/api/`, SOPs in `docs/sops/`, and ADRs in `docs/adr/`.
- For system inventory, system rating, workflow-boundary, or panel-to-system mapping tasks, start with `docs/systems/README.md`, `docs/systems/catalog.md`, and `docs/systems/rating-rubric.md`.
- Supabase bootstrap SQL in `sql/`; do not add secrets.
- Follow feature module pattern (`features/<name>/{types,constants,data,utils,logic,components}`) and keep pages thin.
- Aim to keep files under ~500 lines; if they exceed, document why and plan a split.

## Styling rules

- Use modular CSS under `frontend/styles/`; do not add rules to `globals.css`.
- Prefer feature-scoped CSS files rather than growing very large sheets; split when practical.
- Desktop is the active build and QA target. Do not spend effort optimizing mobile layouts, mobile breakpoints, touch-only UX, or mobile polish unless the user explicitly asks for mobile scope. Keep basic responsive integrity when editing shared styles, but do not treat mobile as a launch requirement.

## Supabase and security

- Only use anon key on the client; never check in service-role keys or `.env.local`.
- Enforce per-user isolation: RLS on `saved_creators`, `media_files`, and private `media_library` bucket paths (`auth.uid()` scoped).
- Protected routes: `/performance*`, `/saved-creators`, `/profile`, `/ai-studio`, and `/admin`.
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
- Trace failures to the source and fix the canonical path; do not add parallel paths, duplicate implementations, hidden fallback behavior, backup copies, or legacy variants to bypass the root problem.
- Keep UI consistent with existing palette/spacing (see `docs/styles-structure.md`).
- For large refactors, propose a plan and execute incrementally; avoid exceeding file size limits.
- Keep documentation contract-driven and no-bloat:
  - update docs when behavior/contracts/gates change,
  - prefer updating existing docs over creating new planning docs unless a new durable artifact is required.

## Execution guardrails

- Do not choose the next task by adjacency alone. Nearby files, similar routes, or matching test patterns are not sufficient justification.
- Start each new lane with a concrete problem statement: the risk/bug, why it matters, and why this target has better ROI than stopping.
- If a lane needs compatibility, migration scaffolding, or platform-required alternate transport, document it as the canonical plan for that constraint, including the owner, validation path, and removal condition when temporary.
- Require route/API tests to cover route-owned behavior or failure handling that shared logic tests do not already protect.
- Prefer one coherent lane at a time. Finish it, checkpoint it, or explicitly stop it before starting another lane.
- During the pre-launch production-readiness phase through the Copperknot launch decision window ending `2026-07-07`, stay on `production` for local work and target GitHub `production` for branch operations.
- Keep `git config --local shortpulse.allowedBranch` set to `production`. Local Husky `pre-commit` and `pre-push` hooks enforce that the current branch and push target match it.
- Never push directly to `main` unless the user explicitly changes that rule.
- During this phase, prefer direct `production` push/check/review coordination; do not assume a cross-branch PR flow unless the user explicitly rewrites the branch policy.
- During this phase, browser/manual validation for production work targets `https://www.shortpulse.ai`. Do not use `localhost`, `127.0.0.1`, arbitrary preview URLs, or local browser sessions as the validation surface unless the user explicitly asks for local development, localhost, or a non-production dry run in the current thread.
- Use targeted validation during a lane and reserve full `npm run validate` for meaningful checkpoints, not every small diff.
- Stop when the next change is no longer clearly reducing risk more than it adds churn.

## Maintenance skills

- Run `npm -C frontend run docs:check` to validate markdown/index integrity plus semantic parity checks (routes, API inventory, migrations, archive manifest).
- Use `skills/skill-session-startup-contract/SKILL.md` at freshness checkpoints to enforce bounded startup preflight, core context loading, and no-edit gating.
- The user grants standing repo-level permission to use subagents when useful, subject to the active tool contract. Current-task phrases like `you may use subagents for this task`, `use subagents freely where useful`, or `delegate as needed` are explicit subagent authorization.
- Use `skills/skill-subagent-audit-research/SKILL.md` when the user asks to audit, inspect, investigate, or do online research; use subagents for substantive lanes when available, allowed, useful, and authorized by the active tool contract, and close unused subagents at will.
- For system-catalog work, map natural-language surfaces like `create panel`, `edit panel`, or `video panel` to their system rows first; do not create panel rows unless the repo shows a truly separate system boundary.
- Use `skills/skill-pricing-audit/SKILL.md` before changing pricing/models or credit logic.
- Use `skills/skill-pricing-wiring/SKILL.md` when implementing shared-policy pricing display or debit-alignment changes in AI Studio, and run `node scripts/check_ai_studio_pricing_display_drift.js` after touching billable AI Studio pricing surfaces.
- Use `skills/skill-doc-index/SKILL.md` when adding or renaming docs.
- Use `agent-teaching/README.md` when creating, training, maintaining, or refreshing task-specific agents, and follow its Notion-mirrored setup and training sequence.
- Use `skills/palette-normalizer/SKILL.md` for dry-run-first CSS palette drift audits and safe normalization passes.
- Use `skills/skill-mvp-security-audit/SKILL.md` when executing P0 security blockers from the MVP pre-tester remediation plan.
- Use `skills/skill-mvp-modularization-pass/SKILL.md` when splitting oversized files and enforcing modularity thresholds.
- Use `skills/skill-mvp-docs-sop-governance/SKILL.md` when resolving docs/SOP drift and archive/index hygiene.
- Use `skills/skill-media-storage-deploy-gate/SKILL.md` when the user is preparing to deploy and media storage integrity must be pass/fail gated.
- Use `skills/adaptive-parity-check/SKILL.md`, `skills/adaptive-surface-smoke/SKILL.md`, and `skills/adaptive-perf-audit/SKILL.md` only for transform-free Adaptive Media V2 validation and tuning. Supabase `/storage/v1/render/image/` usage is prohibited and must be treated as a regression, not as an acceptable adaptive outcome.
- Use `skills/adaptive-change-gate/SKILL.md` before merging any change that touches adaptive media or reference-grid adaptive delivery paths, and verify the change does not introduce Supabase image transformation usage.
