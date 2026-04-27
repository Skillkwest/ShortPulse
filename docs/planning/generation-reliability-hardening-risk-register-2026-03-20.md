# Generation Reliability Hardening Risk Register (2026-03-20)

Last updated: 2026-03-20  
Status: active  
Program anchor: `docs/planning/generation-reliability-hardening-master-plan-2026-03-20.md`

## Purpose
Track planning and rollout risks for the reliability hardening program with explicit mitigation and ownership.

## Risk Register
| Risk ID | Risk | Severity | Trigger | Mitigation | Owner | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| `GRH-R01` | Status-model drift between phase docs and tracker spec | High | Slice rows use unsupported status tokens | Enforce spec-compliant statuses (`Not Started|In Progress|Blocked|Completed`) across all phase plans | Engineering | R0-R6 |
| `GRH-R02` | Callback signature contract omitted from execution-ready planning | High | Idempotency policy defined without signature controls | Bind signature verification requirements to `R3-S4` and provider contract matrix | Engineering | R3 |
| `GRH-R03` | Evidence link rot from non-existent packet files | High | Tracker references packet paths that do not exist | Pre-create packet stubs or require packet creation in same planning PR | Engineering | R0-R6 |
| `GRH-R04` | Scheduler cadence changes shipped without parity checks | High | Route alias drift or auth mismatch after cadence update | Keep route-parity and secret-rotation gates mandatory in `R2` policies | Engineering | R2 |
| `GRH-R05` | Retry policy creates churn or premature terminal failures | High | Incorrect retry taxonomy by provider outcome | Lock provider taxonomy + bounded retry + max-age + quarantine contract | Engineering | R4 |
| `GRH-R06` | Fairness controls starve high-value traffic | Medium | Over-restrictive budgets or jitter windows | Define override policy, starvation detection metrics, and rollback criteria | Engineering | R5 |
| `GRH-R07` | Closeout recommendation hides unresolved blockers | Medium | Generic closeout language without explicit blockers | Enforce explicit `ready_for_implementation` vs `hold_with_blockers` recommendation in `R6` | Engineering | R6 |
| `GRH-R08` | Supporting-doc drift across indexes and master docs | Medium | New docs added without index updates | Run `docs:check` and keep index updates in same PR | Engineering | R0-R6 |

## Review Cadence
1. Review risk table at each phase planning checkpoint.
2. Promote/de-escalate severity only with rationale in tracker notes.
3. Carry unresolved high risks into implementation-entry checklist as blocking items.

## References
1. `docs/planning/generation-reliability-hardening-master-tracker-2026-03-20.md`
2. `docs/planning/generation-reliability-hardening-implementation-entry-checklist-2026-03-20.md`
