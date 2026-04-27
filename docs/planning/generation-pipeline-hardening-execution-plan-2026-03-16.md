# Generation Pipeline Hardening Execution Plan (2026-03-16)

Last updated: 2026-03-17  
Status: complete  
Owner: Engineering  
Master plan: `docs/planning/generation-pipeline-hardening-master-plan-2026-03-16.md`  
Tracker spec: `docs/planning/generation-pipeline-hardening-tracker-spec-2026-03-16.md`  
Contact map: `docs/planning/generation-pipeline-hardening-contact-map-2026-03-16.md`  
Evidence root: `docs/planning/evidence/generation-pipeline-hardening/`

## Purpose
Convert Track P1 strategy into concrete slices for submit/dispatch contract hardening and queue reliability, with fail-closed correctness and rollback discipline.

## Scope Lock
In scope:
1. Shared payload contract gate for submit and queue dispatch.
2. Unknown-field rejection after completeness coverage.
3. Queue identity invariants and deterministic fail-closed handling.
4. Claim-collision remediation for queue claim RPC path.
5. Required ADR/SOP closeout for new failure codes.

Out of scope:
1. Lane B modularization/style work.
2. Product/UX behavior changes.
3. Broad schema redesign outside claim-collision fix.
4. Legacy route retirement programs.

## Slice Backlog
| Slice ID | Phase | Surface | Primary Goal | Primary Evidence Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| `P0-01` | P0 | baseline lock | Capture baseline gates and payload keyset inventory | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p0-01-baseline-lock.md` | Completed |
| `P1-01` | P1 | shared contract utility | Introduce contract utility + projected payload shape without enforcement drift | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p1-01-shared-contract-gate.md` | Completed |
| `P2-01` | P2 | model contract completeness | Complete allowlists for emitted payload keysets across model families | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p2-01-contract-completeness.md` | Completed |
| `P3-01` | P3 | submit hardening | Enforce submit gate and projected payload usage before downstream actions | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p3-01-submit-hardening.md` | Completed |
| `P3-02` | P3 | dispatch hardening | Enforce dispatch gate + deterministic fail-closed settlement | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p3-02-dispatch-hardening.md` | Completed |
| `P3-03` | P3 | identity invariants | Enforce queue/generation/reservation identity mismatch fail-closed path | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p3-03-identity-invariant-lock.md` | Completed |
| `P4-01` | P4 | queue claim collision | Harden claim RPC semantics and bounded app retry behavior | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p4-01-claim-collision-remediation.md` | Completed |
| `P5-01` | P5 | docs/adr closeout | Publish ADR + SOP updates and final convergence packet | `docs/planning/evidence/generation-pipeline-hardening/2026-03-17-p5-01-docs-adr-closeout.md` | Completed |

Policy:
1. One seam per PR.
2. Track P1 slices remain isolated from Lane B modularization PRs.
3. Fail-closed behavior changes require explicit rollback notes and targeted tests.

## Execution Detail
### P0-01 Baseline Lock
Commands:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run test`

Acceptance:
1. Baseline command bundle captured.
2. Payload keyset baseline snapshot is attached.
3. Non-goals and rollback posture are frozen.

### P1-01 Shared Contract Gate
Acceptance:
1. Shared utility returns deterministic `valid | violation` contract decisions.
2. Projected payload path is available for submit/dispatch consumers.
3. No enforce-mode behavior drift before P2 completeness.

### P2-01 Contract Completeness
Acceptance:
1. Current emitted payload keysets pass allowlist checks.
2. Unknown injected keys fail in dedicated tests.
3. Coverage packet includes all active model families.

### P3-01 / P3-02 / P3-03 Submit+Dispatch+Identity Hardening
Required tests:
1. Submit violation returns deterministic `GENERATION_PAYLOAD_CONTRACT_VIOLATION`.
2. Dispatch violation fails closed with `QUEUE_PAYLOAD_CONTRACT_VIOLATION` and deterministic settlement.
3. Identity mismatch fails closed with `QUEUE_IDENTITY_MISMATCH`.

Acceptance:
1. Enforcement behavior is deterministic and test-backed.
2. Rollback triggers are explicit per slice.
3. No mixed modularization scope is included.

### P4-01 Claim Collision Remediation
Acceptance:
1. Claim collision path includes deterministic retry bound.
2. Existing lease semantics and per-user dispatch invariants are preserved.
3. SQL/runtime evidence is attached.

### P5-01 Docs/ADR Closeout
Acceptance:
1. Required ADR is published for shared payload boundary contract.
2. SOP triage sections include new failure codes and operator actions.
3. Track closeout packet includes risk and rollback posture summary.

## Merge Gates (Per Slice)
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. targeted generation pipeline tests for touched seam

Lane-level closeout:
1. `npm -C frontend run test`
2. complete evidence packet set under `docs/planning/evidence/generation-pipeline-hardening/`
