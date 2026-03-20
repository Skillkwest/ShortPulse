# Generation Reliability Hardening Phase R3 Execution Plan (2026-03-20)

Date: 2026-03-20  
Authority: Working  
Owner: Engineering  
Status: Planning Complete (implementation ready; no runtime changes started)

## Summary
Phase `R3` locks deterministic state and idempotency governance.

Primary objective:
1. Prevent duplicate, out-of-order, or ambiguous callback/state transitions from corrupting generation lifecycle outcomes.

Master references:
1. `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-master-roadmap-2026-03-20.md`
3. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`

## Scope Lock
In scope:
1. Generation-state transition matrix with allowed edges only.
2. Compare-and-set mutation policy for reliability-critical transitions.
3. Idempotency/uniqueness strategy for callbacks, artifact persistence, and credit mutations.
4. Duplicate and out-of-order callback handling policy.
5. Callback signature verification contract and replay-window policy.

Out of scope:
1. Provider model catalog changes.
2. Scheduler cadence policy changes.
3. Quarantine operational policy (reserved for `R4`).

## Entry Criteria
1. `R2` planning baseline artifacts are published.
2. `R-M07` and `R-M08` are `Completed`.
3. Program remains planning-only (no runtime implementation slices).

## Hard Blockers
1. Do not apply broad state-model migrations before transition matrix contract is approved.
2. Do not alter billing mutation semantics without explicit idempotency constraint design.

## Slice Backlog
| Slice ID | Goal | Primary Surfaces | Deliverable | Status |
| --- | --- | --- | --- | --- |
| `R3-S1` | Lock generation transition matrix | planning + SOP docs | Allowed transition graph with failure-code mapping | Completed |
| `R3-S2` | Lock CAS mutation requirements | API/runtime docs | Compare-and-set policy for state and settlement mutations | Completed |
| `R3-S3` | Lock idempotency key strategy | schema/policy planning docs | Unique-key matrix and duplicate handling contract | Completed |
| `R3-S4` | Lock callback ordering and signature policy | provider incident runbooks | Deterministic duplicate/out-of-order callback handling plus signature/replay requirements | Completed |

## Planning-Only Gate
1. `R3` work is limited to planning docs, state contracts, and evidence templates.
2. No state migrations, billing mutation rewires, or callback behavior changes are executed during planning.
3. Implementation may start under the approved implementation-entry checklist; runtime changes are still out of scope for this planning document.

## R3 Execution Tracker Rows
| Slice ID | Phase | Workstream | Surface | Goal | Entry Gate | Exit Gate | Before And After | Targeted Validation | Full Gates | Risk Class | Rollback Note | Runbooks/Docs Updated | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R3-S1` | `R3` | `WR-4` | Transition matrix | Lock deterministic state transition graph and illegal-edge fail-closed rules | R3 planning baseline complete + `R-M07` completed | Transition matrix approved with allowed edges and illegal transition handling | Before: transition semantics vary across paths. After: canonical state transition contract | Transition matrix parity review against recovery and callback flows | `npm -C frontend run docs:check` | High | Revert transition matrix contract docs and restore previous state notes | Planning docs + reliability SOP references | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s1-transition-matrix-contract.md` | Completed |
| `R3-S2` | `R3` | `WR-4` | CAS mutation contract | Lock compare-and-set mutation policy for reliability-critical state and settlement updates | `R3-S1` draft available | CAS policy approved with guarded update requirements and failure handling | Before: mutation guardrails implicit. After: deterministic CAS mutation standard | CAS policy walkthrough on retry and duplicate callback scenarios | `npm -C frontend run docs:check` | High | Revert CAS policy docs and fallback to baseline mutation guidance | Runtime contract docs + planning docs | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s2-cas-mutation-policy.md` | Completed |
| `R3-S3` | `R3` | `WR-4` | Idempotency key strategy | Lock unique key/constraint model for callbacks, artifacts, and credit mutations | `R3-S2` approved | Idempotency strategy approved with duplicate/replay handling contract | Before: idempotency coverage partial. After: explicit key strategy per mutation surface | Constraint inventory review and duplicate-path checklist | `npm -C frontend run docs:check` | High | Revert idempotency strategy docs and remove incomplete key matrix | Planning docs + schema governance references | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s3-idempotency-key-matrix.md` | Completed |
| `R3-S4` | `R3` | `WR-4` | Callback ordering + signature policy | Lock deterministic out-of-order/duplicate callback handling with signature verification and replay-window rules | `R3-S3` drafted | Callback ordering/signature policy approved and linked in incident runbooks | Before: callback ordering and authenticity guarantees vary by path. After: deterministic ordering, signature, and replay policy | Callback duplicate/out-of-order simulation plus signature-policy checklist review | `npm -C frontend run docs:check` | Medium | Revert callback ordering/signature policy and linked runbook references | Provider incident + recovery runbooks + provider contract matrix | `docs/planning/evidence/generation-reliability-hardening/2026-03-20-r3-s4-callback-ordering-policy.md` | Completed |

## Operating Cadence
1. Daily R3 planning checkpoint: slice status, blockers, and evidence draft readiness.
2. Mid-phase gate: approve `R3-S1` and `R3-S2` before finalizing `R3-S3`.
3. Phase closeout review: complete `R-M07` and `R-M08` evidence links before opening `R4` planning.

## Post-Closeout Actions
1. Preserve the locked policy contracts during implementation changes tied to this phase.
2. Re-open this phase if implementation introduces contract drift or unresolved blockers.
3. Attach implementation-phase evidence separately without mutating planning closeout records.

## Required Validation
1. `npm -C frontend run docs:check`
2. Transition matrix review and invariant checklist signoff.
3. Duplicate-callback simulation plan with expected outcomes.
4. Per-provider callback authenticity checklist:
   - fal JWKS + timestamp freshness policy,
   - Kie HMAC + timestamp freshness policy.

## Exit Criteria
1. `R-M07` and `R-M08` have approved matrix/constraint evidence links.
2. Transition matrix includes explicit fail-closed behavior for illegal edges.
3. Idempotency contract covers callback, artifact, and credit mutation surfaces.
4. Callback ordering and signature verification policy are linked from provider incident runbook.

## Rollback Posture
1. Revert order:
   - `R3-S4` callback ordering policy,
   - `R3-S3` idempotency strategy,
   - `R3-S2` CAS policy,
   - `R3-S1` transition matrix lock.

## Risks
1. Overly strict state policy may block legitimate recovery transitions.
Mitigation: include exception-review path with explicit owner signoff.

2. Incomplete idempotency scope leaves hidden duplicate mutation paths.
Mitigation: require surface inventory checklist across callback/artifact/credit flows.
