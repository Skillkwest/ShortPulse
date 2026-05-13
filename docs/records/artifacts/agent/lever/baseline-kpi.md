# Lever Baseline KPI

Purpose: define the fixed historical baseline for Lever's model maintenance workflow so future add/retire runs can be compared against a stable standard.

## Baseline Status

- Baseline date: 2026-05-11
- Scope: model onboarding, model API contract reverification, and model retirement with app-surface audit
- Authority: non-authoritative local performance record
- Change rule: do not rewrite the KPI categories, weights, or thresholds after creation; append observations or create a new dated baseline instead

## Baseline Workload

This baseline measures a full Lever run:

1. Classify the task correctly.
2. Load the correct canonical model SOP.
3. Make the smallest safe model-platform change.
4. Keep route authority and inventory invariants intact.
5. Validate visible app surfaces when picker-visible models are affected.
6. Update docs and retained artifacts only where needed.

## Fixed KPI Scorecard

Total score: 100 points.

| KPI | Weight | Baseline standard |
| --- | ---: | --- |
| SOP routing fidelity | 14 | Chooses the correct canonical SOP and follows it instead of improvising a parallel flow. |
| Inventory boundary discipline | 14 | Preserves operator-only inventory and server-allowlisted execution authority. |
| Catalog/runtime correctness | 14 | Leaves lifecycle, replacement, route inventory, and compatibility state internally consistent. |
| App-surface cleanup quality | 14 | Removes or verifies visible picker/modal residue when lifecycle state changes. |
| Validation quality | 14 | Runs the smallest relevant tests and tooling checks that prove the changed contract. |
| Docs and operator clarity | 10 | Updates SOP/API/index docs when model state or workflow expectations changed. |
| Scope control | 8 | Keeps the diff tied to the active model maintenance problem. |
| Communication clarity | 6 | States what changed, what remains compatibility-only, and what is deferred. |
| Memory and artifact upkeep | 6 | Records durable lessons without bloating the repo with low-value notes. |

## Baseline Performance

- Baseline rating: 10/10
- Baseline score: 95/100 or higher
- Minimum acceptable future run: 90/100
- Degradation warning: any single run below 90/100, or two consecutive runs below 93/100

## Non-Negotiable Failure Conditions

Any future run fails the baseline regardless of numeric score if it:

- re-exposes a retired picker-visible model as active,
- lets unsupported model ids remain executable through an affected route,
- hard-removes a model before compatibility requirements are addressed,
- leaves docs materially contradicting runtime lifecycle state,
- or touches unrelated model families without a concrete requested reason.
