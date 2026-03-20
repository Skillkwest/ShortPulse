# Generation Reliability Hardening Phase R4 Execution Plan (2026-03-20)

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Status: Planning Complete (implementation ready; no runtime changes started)

## Summary
Phase `R4` defines bounded retry, timeout, lease, and quarantine policy.

Primary objective:
1. Ensure stuck work cannot retry forever and cannot silently wedge critical queues.

Master references:
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`

## Scope Lock
In scope:
1. Provider error taxonomy (`retryable`, `terminal`, `quarantine`) for fal and Kie families.
2. Retry/backoff/timeout policy with bounded attempt and age limits.
3. Lease/deadline calibration methodology from observed latency percentiles.
4. Quarantine triage, replay, and evidence-capture rules.

Out of scope:
1. Fairness and load-shedding controls (reserved for `R5`).
2. Game-day execution (reserved for `R6`).
3. Full queue architecture replacement.

## Entry Criteria
1. `R3` planning baseline artifacts are published.
2. `R-M09` is `Completed`.
3. Program remains planning-only (no runtime implementation slices).

## Hard Blockers
1. Do not enable automatic quarantine actions without operator replay/rollback policy.
2. Do not set retry policies without explicit max-age boundary.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `R4-S1` | Lock provider error taxonomy | provider runbooks + policy docs | Error-class table with deterministic handling rules | Completed |
| `R4-S2` | Lock retry/backoff/timeout policy | runtime governance docs | Bounded retry policy matrix by failure class | Completed |
| `R4-S3` | Lock lease/deadline calibration method | monitoring + policy docs | Percentile-driven calibration procedure | Completed |
| `R4-S4` | Lock quarantine and replay operations contract | SOPs + evidence templates | Quarantine triage/replay runbook with audit fields | Completed |

## Planning-Only Gate
1. `R4` work is limited to planning docs, policy contracts, and evidence templates.
2. No retry engine changes, lease mutations, or quarantine automation changes are executed during planning.
3. Implementation may start under the approved implementation-entry checklist; runtime changes are still out of scope for this planning document.

## R4 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R4-S1` | `R4` | `WR-5` | Provider error taxonomy | Lock deterministic `retryable`/`terminal`/`quarantine` provider classification | R4 planning baseline complete + `R-M09` completed | Taxonomy approved with class-specific handling and escalation semantics | Before: provider failure classing varies by incident path. After: canonical taxonomy contract | Taxonomy review against fal and Kie failure-code inventory | `npm -C frontend run docs:check` | High | Revert taxonomy docs and restore prior provider incident guidance | Provider incident runbooks + policy docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s1-provider-error-taxonomy.md` | Completed |
| `R4-S2` | `R4` | `WR-5` | Retry/backoff/timeout policy | Lock bounded retry policy with attempt and max-age limits | `R4-S1` draft available | Retry policy matrix approved with jitter/backoff and terminal boundaries | Before: retry boundaries inconsistent across paths. After: bounded retry contract | Retry-to-terminal policy simulation checklist review | `npm -C frontend run docs:check` | High | Revert retry policy matrix and fallback to baseline recovery notes | Runtime governance docs + planning docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s2-retry-timeout-policy.md` | Completed |
| `R4-S3` | `R4` | `WR-5` | Lease/deadline calibration | Lock percentile-driven calibration with fallback defaults and review cadence | `R4-S2` approved | Calibration method approved with explicit percentile source and owner cadence | Before: lease/deadline tuning ad hoc. After: deterministic calibration method | Calibration-method walkthrough against observed latency distributions | `npm -C frontend run docs:check` | Medium | Revert calibration method docs and restore baseline timing guidance | Monitoring docs + policy docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s3-lease-deadline-calibration.md` | Completed |
| `R4-S4` | `R4` | `WR-5` | Quarantine/replay contract | Lock quarantine triage, replay, and ownership/audit rules | `R4-S3` drafted | Quarantine operations contract approved with replay guards and ownership fields | Before: quarantine handling inconsistent and owner-ambiguous. After: deterministic triage/replay contract | Quarantine replay checklist review with escalation ownership table | `npm -C frontend run docs:check` | Medium | Revert quarantine contract and linked runbook references | SOPs + evidence templates | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r4-s4-quarantine-replay-contract.md` | Completed |

## Operating Cadence
1. Daily R4 planning checkpoint: slice status, blockers, and evidence draft readiness.
2. Mid-phase gate: approve `R4-S1` and `R4-S2` before finalizing `R4-S3`.
3. Phase closeout review: complete `R-M09` evidence links before opening `R5` planning.

## Post-Closeout Actions
1. Preserve the locked policy contracts during implementation changes tied to this phase.
2. Re-open this phase if implementation introduces contract drift or unresolved blockers.
3. Attach implementation-phase evidence separately without mutating planning closeout records.

## Required Validation
1. `npm -C frontend run docs:check`
2. Provider taxonomy review against current failure-code inventory.
3. Policy simulation packet for retry-to-quarantine progression.

## Exit Criteria
1. `R-M09` has approved taxonomy and policy evidence links.
2. Retry policies include explicit attempt cap and max-age cap.
3. Lease/deadline calibration method includes fallback defaults and review cadence.
4. Quarantine operations contract is linked from core incident runbooks.

## Rollback Posture
1. Revert order:
   - `R4-S4` quarantine operations contract,
   - `R4-S3` calibration method,
   - `R4-S2` retry policy table,
   - `R4-S1` provider taxonomy.

## Risks
1. Misclassified provider errors can cause either retry storms or premature terminal failures.
Mitigation: require code-owner + ops-owner signoff on taxonomy table.

2. Quarantine policy can accumulate backlog without clear ownership.
Mitigation: require explicit quarantine owner and max-age escalation rule.
