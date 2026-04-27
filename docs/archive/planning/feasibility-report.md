# Feasibility And Dependency Validation

> Archived on 2026-04-27 during docs cleanup because this governance-baseline feasibility report is complete and the remaining active governance work lives in `docs/planning/master-rollout-proposal.md`, `docs/planning/implementation-tracker.md`, and `docs/planning/final-validation-summary.md`.

Date: 2026-02-20
Status: complete
Authority: Working
Owner: Engineering

## Critical path

1. Governance contract lock (`STG-00`).
2. Inventory + overlap closure (`STG-01`).
3. SQL/RPC hardening migration `028` (`STG-02`).
4. Schema/runtime/docs parity alignment (`STG-03`).
5. KEI compatibility decommission phases (`STG-04`).
6. CI/policy enforcement and archive validation (`STG-06`, `STG-07`).
7. Final validation + signoff (`STG-08`).

## Dependency graph

- `STG-00 -> STG-01 -> STG-02 -> STG-03 -> STG-04 -> STG-06 -> STG-08`
- `STG-05` depends on `STG-03` (parity baseline) and `STG-06` guardrails.
- `STG-07` depends on `STG-01` source freeze and runs before `STG-08`.

## Validation outcomes

| Check | Status | Notes |
| --- | --- | --- |
| Forward migration safety | Pass | `028` added as new migration; `018` untouched |
| Compatibility windows before enforcement | Pass | KEI hold and warn/evaluate mode documented |
| CI job uniqueness viability | Pass | Existing job IDs inventoried; new IDs reserved |
| Branch protection integration viability | Pass | Exact required-check mapping documented |
| Policy-as-code artifact feasibility | Pass | Node scripts align with current docs tooling |
| SQL lint gate feasibility | Pass with env caveat | Uses CLI command; can start warn-mode until environment convergence |

## Blockers and mitigations

| Blocker | Severity | Mitigation |
| --- | --- | --- |
| No pre-existing semantic drift automation | Medium | Add `check_docs_semantic_drift.js` and migration parity scripts |
| Archive policy ambiguity for source-plan copies | Medium | Add explicit policy exception in documentation governance |
| KEI compatibility window not yet elapsed | High | Keep tombstones + defer destructive KEI deletion phase |

## Change control gates

- Gate A (Design lock): inventory + overlap + feasibility approved.
- Gate B (SQL hardening): migration `028` validated in staging/local.
- Gate C (Parity): route/api/migration docs parity checks green.
- Gate D (Compatibility): KEI hold window completed before deletion.
- Gate E (Enforcement): two green cycles before promote checks to enforce.
