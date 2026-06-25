# Abismia Agent Artifacts

Purpose: store non-authoritative retained artifacts for Abismia's UI/UX stewardship, intended runtime behavior reviews, human-experience audits, training continuity, and helper tooling.

## Artifact Layout

- `training-history.md`: training and maintenance lessons that should influence future operation.
- `run-log.md`: concise retained ledger of substantive Abismia runs.
- `tools.md`: Abismia-specific helper inventory only.
- `reports/`: dated UI/UX audit reports, human-experience audits, runtime-behavior reviews, proposal briefs, and retained summaries that should not stay in startup surfaces.
- `training-data/`: sanitized examples and reusable lessons that are worth retaining for future training.

## Load Policy

- These artifacts are non-default load.
- Load them only for retained continuity, training maintenance, or when the user explicitly asks for prior evidence.
- Keep route-specific detail here instead of in Abismia's core contract or memory surfaces.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, user instructions, current code, current docs, ADRs, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/abismia/README.md`
- Agent instructions: `docs/agents/abismia/AGENTS.md`
- Repo-visible memory: `docs/agents/abismia/memory.md`
- Standing SOP: `docs/agents/abismia/standard-operating-procedure.md`
- Runtime code hardening SOP: `docs/agents/abismia/sop-runtime-ui-code-hardening.md`
- Human-experience feel SOP: `docs/agents/abismia/sop-human-experience-psychological-feel.md`
- Temporary workspace: `docs/agents/abismia/workspace/`
