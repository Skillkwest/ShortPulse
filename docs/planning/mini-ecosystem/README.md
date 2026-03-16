# Real Environment Delivery Mini-Project

Purpose: build a practical, production-style operating system for solo delivery work using explicit role hats, gate contracts, and reusable templates.

Status: Working, non-authoritative planning/lab docs.

## Why this exists
- Make delivery flow visible and repeatable.
- Reduce ambiguity for feature work and quality audits.
- Keep process lightweight but production-practical.

## Scope
- Feature delivery workflow (request -> release -> learning).
- Codebase audit workflow (role-based recurring health pass).
- Team-role charters, decision precedence, and definition of done.
- Checklist-first templates and dry-run examples.

## Core docs
- `handbook.md`: operator manual for running this ecosystem day-to-day.
- `quick-start-cheat-sheet.md`: one-page quick-start flow for daily use.
- `mini-production-sop.md`: governing process contract and gate model.
- `workflow-feature-delivery.md`: staged execution flow for new features.
- `workflow-codebase-audit.md`: recurring role-based codebase audit flow.
- `decision-precedence.md`: conflict resolution hierarchy.
- `definition-of-done.md`: global completion criteria.
- `cadence-and-rituals.md`: recurring solo rituals.

## Performable core (inactive)
- `performable-core/README.md`: entry point for dormant execution-grade contracts.
- `performable-core/system-charter.md`: mission/scope for future role-based execution.
- `performable-core/finding-and-packet-schema.md`: canonical finding + gate/handoff packet structures.
- `performable-core/severity-and-gate-policy.md`: severity taxonomy and hard gate-blocking behavior.
- `performable-core/role-execution-contracts.md`: deterministic role outputs, checks, and block authority.
- `performable-core/orchestration-contract-inactive.md`: future execution order/control rules (`enabled=false`).
- `performable-core/activation-readiness-checklist.md`: strict preconditions before activation.

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

## Dry runs
- `dry-runs/README.md`
- `dry-runs/feature-delivery-dry-run-001.md`
- `dry-runs/codebase-audit-dry-run-001.md`

## Usage
1. Start from `mini-production-sop.md`.
2. Use `workflow-feature-delivery.md` for new requests.
3. Use `workflow-codebase-audit.md` weekly.
4. Fill templates under `templates/`.
5. Record examples in `dry-runs/`.

## Promotion rule
Keep this package as planning/lab guidance until it proves stable across multiple runs, then promote selected docs to canonical SOPs.
