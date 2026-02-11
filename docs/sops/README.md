# SOP Index

Purpose: operational runbooks for recurring engineering and product workflows.

## Scope
- AI Studio generation workflows.
- Billing and credits operations.
- Route/domain-specific UI workflows.
- Modularization and new-model ingestion procedures.

## Authoring rules
- Keep SOPs procedural and implementation-aware.
- Link to source-of-truth code paths instead of copying large code blocks.
- Prefer a stable structure: scope, prerequisites, workflow, error handling, maintenance.
- If the process is durable architecture (not only operation), add/update an ADR in `docs/adr/`.

## Naming
- Use `sop_<domain>.md`.
- Put new SOPs in this folder and add them to `docs/README.md`.
