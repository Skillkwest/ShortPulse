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
npm install
npm run dev
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
- Supabase operations policy: use Supabase CLI for Supabase access; do not use Docker-based Supabase workflows (`supabase start/stop`, `supabase db reset --local`, `supabase db lint --local`, or direct `docker` commands).
- When adding routes, update `README.md` and the relevant SOP/architecture doc under `docs/`.
- For durable architecture decisions, add an ADR under `docs/adr/`.
- Prefer existing references first: `docs/README.md`, `docs/troubleshooting.md`, and `docs/glossary.md`.
- After completing a task, always audit your work to see if you have missed anything. Make any new high value changes you see fit. Then provide high level suggusted next steps upon completion of your task.

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
- Read scoped instructions for touched areas (`frontend/AGENTS.md`, `docs/AGENTS.md`).

3. **Task classification + targeted context load**
- SQL/migrations: read `docs/sops/sop_sql_migration_operations.md`, `docs/database-migrations.md`, `docs/security-checklist.md`, and impacted files under `sql/migrations/`.
- Routes/UI behavior: read `README.md`, `docs/routes.md`, and the relevant SOP(s).
- Pricing/credits changes: run `skills/skill-pricing-audit/SKILL.md`.
- Docs/index drift: run `skills/skill-doc-index/SKILL.md` or `skills/skill-mvp-docs-sop-governance/SKILL.md`.

4. **Web research policy**
- Default to local repo sources first.
- Browse when explicitly requested, when "latest/current" matters, or for high-stakes/temporally unstable facts.

5. **No-edit gate**
- Do not edit files until core + task-specific context is loaded.
- In brainstorm/no-edit mode, do not mutate repository files.

6. **Execution/closeout defaults**
- Keep diffs minimal and scoped to the request.
- Run relevant validation checks for touched areas.
- Perform a final self-audit for missed high-value updates and provide suggested next steps.

Use `skills/skill-session-startup-contract/SKILL.md` as the procedural checklist for this contract.
