# Mini Ecosystem

Purpose: provide a standalone, professional, role-based operating system for building and shipping this app.

Status: Active standalone operational docs (separate from canonical product docs).

## Why this exists
- Keep a practical, repeatable request-to-production workflow.
- Make role-based decisions explicit while one operator wears all hats.
- Prepare execution-grade contracts for future agent activation without enabling automation yet.

## Scope
- Feature delivery workflow (request -> release -> post-release closure).
- Codebase audit workflow (role-based recurring health pass).
- Team-role contracts, gate policy, decision precedence, and definition of done.
- Execution-grade schemas and orchestration contracts (inactive until explicitly activated).

## Core docs
- `AGENTS.md`: operating guardrails for Mini Ecosystem changes.
- `agent-export-contract.md`: contract for exporting Mini Ecosystem decisions to external execution-agent conversations.
- `handbook.md`: operator manual for day-to-day execution.
- `quick-start-cheat-sheet.md`: 5-minute operational flow reference.
- `mini-production-sop.md`: governing lifecycle and gate model.
- `real-delivery-flow.md`: company-baseline feature delivery flow.
- `workflow-feature-delivery.md`: staged feature execution flow.
- `workflow-codebase-audit.md`: recurring role-based audit flow.
- `decision-precedence.md`: conflict-resolution hierarchy.
- `definition-of-done.md`: completion contract.
- `cadence-and-rituals.md`: recurring operating rhythms.

## Performable core (inactive)
- `performable-core/README.md`
- `performable-core/system-charter.md`
- `performable-core/finding-and-packet-schema.md`
- `performable-core/severity-and-gate-policy.md`
- `performable-core/role-execution-contracts.md`
- `performable-core/orchestration-contract-inactive.md`
- `performable-core/activation-readiness-checklist.md`

## Team model
- `team-model/README.md`
- `team-model/roles/*`

## Templates
- `templates/README.md`
- `templates/feature-intake-template.md`
- `templates/implementation-pr-template.md`
- `templates/review-template.md`
- `templates/qa-release-template.md`
- `templates/post-release-template.md`
- `templates/codebase-audit-template.md`

## Operational records
- `operations-records/README.md`

## Usage
1. Start from `mini-production-sop.md`.
2. Use `workflow-feature-delivery.md` for new requests.
3. Use `workflow-codebase-audit.md` for recurring audits.
4. Fill templates under `templates/`.
5. Capture real execution records under `operations-records/`.
