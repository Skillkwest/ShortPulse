# D-Bug SOP Index

Purpose: index the canonical SOPs and reference docs D-Bug should load for recurring debugging work.

## Core startup

- `AGENTS.md`
- `skills/skill-session-startup-contract/SKILL.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`

## Debugging references

- `docs/troubleshooting.md`
- `docs/known-issues.md`
- `docs/testing-guide.md`

## Use by lane

- Route and UI failures:
  - `README.md`
  - `docs/routes.md`
  - relevant SOPs under `docs/sops/`
- SQL and migration failures:
  - `docs/sops/sop_sql_migration_operations.md`
  - `docs/database-migrations.md`
  - `docs/security-checklist.md`
- AI Studio runtime failures:
  - `docs/sops/sop_ai_studio_index.md`
  - lane-specific AI Studio SOPs under `docs/sops/`
- Provider and hosted incident triage:
  - `docs/sops/sop_provider_incident_response.md`
  - `docs/sops/sop_generation_recovery_diagnostics.md`

## Emerging SOP needs

- Add a D-Bug-specific debug-plan SOP after a few real handoff cycles expose stable patterns.
