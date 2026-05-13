# Lever Agent Artifacts

Purpose: store non-authoritative retained artifacts for Lever's model onboarding, contract reverification, and retirement work.

## Status

Lever is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, and an initial artifact area. It has already completed one real retired-model workflow and is ready for recurring model maintenance work.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `run-log.md`: append-only ledger of substantive Lever runs.
- `baseline-kpi.md`: frozen baseline for future model maintenance quality comparisons.
- `sops.md`: Lever workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised runs, learned behavior, and next training focus.
- `reports/`: dated run reports, templates, and evidence summaries when a model change needs durable retained detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Recordkeeping Rule

Every substantive Lever run should produce retained evidence:

- always append the run to `run-log.md`
- create a dated report when the run adds a new lesson, touches a picker-visible model, changes lifecycle state, or exposes workflow/tooling gaps

These records are part of Lever's training data and may also be reused to train future model-maintenance agents.

## Canonical Entry Points

- Agent contract: `docs/agents/lever/README.md`
- Repo-visible memory: `docs/agents/lever/memory.md`
- Lever SOP: `docs/sops/sop_lever_model_management.md`
- Model ingestion SOP: `docs/sops/sop_new_model_ingestion.md`
- Model API contract reverification SOP: `docs/sops/sop_model_api_contract_reverification.md`
- Model retirement SOP: `docs/sops/sop_model_retirement.md`
- Inventory boundary ADR: `docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md`
