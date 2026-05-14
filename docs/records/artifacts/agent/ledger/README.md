# Ledger Agent Artifacts

Purpose: store non-authoritative retained artifacts for Ledger's subscription, credit-package, and recurring storage/media add-on billing work.

## Status

Ledger is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, and an initial artifact area. Ledger is ready for supervised recurring billing work and future training runs.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `run-log.md`: append-only ledger of substantive Ledger runs.
- `sops.md`: Ledger workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised runs, learned behavior, and next training focus.
- `reports/`: dated run reports, templates, and evidence summaries when a billing run needs durable retained detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Recordkeeping Rule

Every substantive Ledger run should produce retained evidence:

- always append the run to `run-log.md`
- create a dated report when the run adds a new lesson, changes billing authority assumptions, touches real purchase/renewal behavior, or exposes workflow/tooling gaps
- prefer using `reports/run-report-template.md` for substantive recurring or one-time billing runs

## Canonical Entry Points

- Agent contract: `docs/agents/ledger/README.md`
- Repo-visible memory: `docs/agents/ledger/memory.md`
- Source-of-truth map: `docs/agents/ledger/source-of-truth-map.md`
- Billing SOP: `docs/sops/sop_billing_credits_operations.md`
- Billing pricing catalog doc: `docs/product/billing-pricing-catalog.md`
- Internal comp renewal ADR: `docs/adr/0059-billing-internal-comp-contracts-and-admin-exempt-renewals.md`
- Storage add-on ADR: `docs/adr/0060-billing-storage-entitlements-and-recurring-storage-addons.md`
- Admin-created plan ADR: `docs/adr/0069-admin-created-billing-plans.md`
- Hidden free/public starter ADR: `docs/adr/0077-paid-starter-tier-with-hidden-free-default.md`
