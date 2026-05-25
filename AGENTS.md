# Agent Instructions (ShortPulse)

This folder contains the active ShortPulse product repo.

## Where to work

- App code: `frontend/`
- Product/engineering docs: `docs/`
- Supabase bootstrap SQL: `sql/`

## Commands

From `ShortPulse/`:

```bash
cd frontend
npm run dev
```

One-time setup (new environment or when dependencies change):

```bash
cd frontend
npm install
```

Optional checks:

```bash
cd frontend
npm run lint
npm run build
```

## Rules of engagement

- Always apply senior-level engineering best practices (clarity, maintainability, minimal diff, validate changes).
- Follow `docs/dev-ground-rules.md` and `docs/conventions.md`.
- Use `docs/agent-playbook.md` as the quick reference for working in this repo.
- Keep user data isolated (Supabase RLS + private storage); never expose service-role keys.
- Pre-launch branch policy: ShortPulse is in a pre-launch production-readiness phase through the Copperknot effective launch decision window ending `2026-07-02` (`docs/agents/copperknot/production-readiness-plan-2026-07-02.md` and `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`). During this pre-launch phase, all repo work must be performed on the local `production` branch, and any GitHub branch operations must target the GitHub `production` branch.
- Pre-launch branch isolation policy: work only on `production`. Do not switch branches, create feature branches, commit on another branch, push another branch, merge into another branch, promote work to another branch, or open GitHub work against another branch unless the user explicitly rewrites this pre-launch policy in the current thread. During this phase, the default GitHub coordination model is direct work on `production` plus checks/review reporting, not cross-branch PR flow. Never push directly to `main`.
- Branch enforcement policy: keep `git config --local shortpulse.allowedBranch` set to `production` during the pre-launch phase. Husky `pre-commit` and `pre-push` must block commit/push activity when the current branch or push target does not match `production`.
- Supabase operations policy: use Supabase CLI for Supabase access; do not use Docker-based Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).
- When adding routes, update `README.md` and the relevant SOP/architecture doc under `docs/`.
- For durable architecture decisions, add an ADR under `docs/adr/`.
- AI Studio global right-rail policy: `Reference Grid`, `Quick Slot Inventory`, and `Canvas` are workspace-global right-rail surfaces across all AI Studio workflows and Create modes. Do not fork them into per-workflow, per-mode, Standard-only, Pulse-only, or route-local state. Use `docs/adr/0083-create-mode-global-right-rail-authority.md`, `docs/sops/sop_ai_studio_pulse_mode.md`, and `docs/sops/sop_ai_studio_create_properties_generation_wiring.md` as the authority references.
- Prefer existing references first: `docs/README.md`, `docs/troubleshooting.md`, and `docs/glossary.md`.
- For system inventory, system rating, workflow-boundary, or panel-to-system mapping questions, use `docs/systems/README.md`, `docs/systems/catalog.md`, and `docs/systems/rating-rubric.md` as the primary references.
- Mini Ecosystem isolation policy: treat `mini-ecosystem/` as a separate entity and exclude it from default audits, inspections, and build-planning context unless the user explicitly requests Mini Ecosystem scope.
- Subagent audit/research policy: when the user asks to audit, inspect, investigate, or do online research, run `skills/skill-subagent-audit-research/SKILL.md` and use subagents for substantive audit/research lanes when they are available, allowed, and useful. The agent may decide subagents are unnecessary for narrow scopes and may close unused subagents at will.
- Cross-agent prompt policy: do not run a prompt from one agent's prompt library against a different agent by default. Interpret agent-scoped prompts as targeting the exact agent named by their containing folder unless the user explicitly instructs a different target in the same message.
- After completing a task, always audit your work to see if you have missed anything. Only continue into additional changes when there is a concrete repo-backed problem statement and better ROI than stopping. Then provide high level suggested next steps upon completion of your task.

## Workspace safety guardrails (mandatory)

- Never move or rename generated/build artifact directories (for example `frontend/.next`) to another path inside this repository as a backup.
- If build artifacts must be cleared, either delete them directly or move them outside the repo root (for example under `/tmp`).
- Before running repo-wide commands (for example `eslint .`, `git status`, broad `rg`), verify no large generated backup/artifact directories exist inside the repo.
- If unsure about operational approach (cleanup, tool invocation, filesystem-wide commands), pause and verify best practices from authoritative docs first; do not proceed on assumption.
- If risk remains unclear, ask the user before executing potentially high-impact workspace operations.
- Temporary files are never source of truth. Treat canonical environment/config files as authoritative; treat temporary copies (for example files in `/tmp`, `.tmp/`, or ad-hoc `.txt` exports) as non-authoritative scratch artifacts.
- Never use temporary env/text copies to decide, validate, or overwrite variable values unless the user explicitly says to use that specific temp file for that task.

## Session Startup Contract (mandatory)

Follow this startup sequence at the start of every new task/session in this repo:

1. **Session preflight (always first)**

- Confirm task mode (`brainstorm/no-edit` vs implementation).
- Run a workspace safety check before broad/repo-wide commands (artifact/backup guardrails).

2. **Core doc load (always)**

- Read this root `AGENTS.md`.
- Read `docs/dev-ground-rules.md`, `docs/conventions.md`, and `docs/agent-playbook.md`.
- Read `docs/README.md`, `docs/troubleshooting.md`, and `docs/glossary.md`.
- Read the scoped instructions for the touched areas (`frontend/AGENTS.md`, `docs/AGENTS.md`) instead of loading unrelated scoped surfaces by default.

3. **Task classification + targeted context load**

- SQL/migrations: read `docs/sops/sop_sql_migration_operations.md`, `docs/database-migrations.md`, `docs/security-checklist.md`, and impacted files under `sql/migrations/`.
- Routes/UI behavior: read `README.md`, `docs/routes.md`, and the relevant SOP(s).
- Pricing/credits changes: run `skills/skill-pricing-audit/SKILL.md`.
- New agent creation/training/maintenance: read `agent-teaching/README.md`, `agent-teaching/foundations/how-to-decide-what-your-agent-can-do.md`, `agent-teaching/setup/new-codex-project-setup.md`, `agent-teaching/setup/define-agent-identity.md`, `agent-teaching/operations/post-run-performance-analysis-interview.md`, `agent-teaching/operations/create-baseline-kpi.md`, and `agent-teaching/foundations/agent-maintenance-field-guide.md`; use `agent-teaching/prompts/agent-setup-prompt.md`, `agent-teaching/prompts/agent-contract.md`, and `agent-teaching/prompts/agentic-research-prompt-pattern.md` as needed; create/update the relevant `docs/agents/<agent-name>/` contract and `docs/records/artifacts/agent/<agent-name>/` memory/report area when durable agent state is needed.
- System inventory/rating/workflow-boundary work: read `docs/systems/README.md`, `docs/systems/catalog.md`, `docs/systems/rating-rubric.md`, plus the relevant product/route/operator docs for the system being rated.
- Docs/index drift: run `skills/skill-doc-index/SKILL.md` or `skills/skill-mvp-docs-sop-governance/SKILL.md`.
- Audit/inspection/online research: run `skills/skill-subagent-audit-research/SKILL.md`.

4. **Web research policy**

- Default to local repo sources first.
- Browse when explicitly requested, when "latest/current" matters, or for high-stakes/temporally unstable facts.

5. **No-edit gate**

- Do not edit files until core + task-specific context is loaded.
- In brainstorm/no-edit mode, do not mutate repository files.

6. **Execution/closeout defaults**

- Keep diffs minimal and scoped to the request.
- Do not continue by adjacency or momentum alone; each new lane must have a concrete repo-backed problem statement and better ROI than stopping.
- During the pre-launch phase, stay on `production` for all edits, commits, pushes, and GitHub branch operations unless the user explicitly rewrites the pre-launch branch policy in the current thread.
- Keep `git config --local shortpulse.allowedBranch production` set so local hooks enforce the active pre-launch branch contract.
- Do not push to `main` directly under any circumstances unless the user explicitly changes this rule.
- Run relevant validation checks for touched areas.
- Perform a final self-audit for missed high-value updates and provide suggested next steps.

Use the repo-local checklist at `skills/skill-session-startup-contract/SKILL.md` as the procedural helper for this contract. If that file is unavailable for any reason, follow the six-step startup contract in this document directly and call out that fallback in your startup summary instead of skipping startup discipline.
