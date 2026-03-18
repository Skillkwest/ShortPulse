# Generation Pipeline Hardening Master Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`  
Tracker spec: `docs/planning/generation-pipeline-hardening-tracker-spec-2026-03-16.md`  
Contact map: `docs/planning/generation-pipeline-hardening-contact-map-2026-03-16.md`

## Summary
This is a separate hardening track for generation-pipeline correctness and safety. It is intentionally outside Lane B modularization scope.

Rebuild method contract:
1. This track is incremental hardening by default, not a from-scratch replacement track.
2. If any slice proposes replacing a legacy generation seam end-to-end, that slice is blocked until it satisfies:
   - `docs/planning/foundation-rebuild-playbook-2026-03-16.md`
   - explicit rebuild entry scorecard evidence in tracker artifacts.

Locked objectives:
1. One shared server payload contract gate for submit and queue dispatch.
2. Strict unknown-field rejection, enforced only after contract coverage is complete.
3. Fail-closed queue dispatch when payload or identity invariants are violated.
4. Queue claim-collision remediation without unrelated schema churn.

## Scope
In scope:
1. Submit and dispatch payload contract enforcement.
2. Model contract allowlist completeness for emitted payload keys.
3. Queue dispatch identity invariants.
4. Claim collision hardening for `claim_generation_submit_queue_batch`.
5. ADR + SOP updates for new error codes and triage actions.

Out of scope:
1. Legacy route retirement.
2. Idempotency redesign.
3. Provider/schema redesign outside claim collision fix.
4. UI/UX behavior changes.

## Implementation Phases
### P0: Baseline Lock
1. Capture baseline runs for `lint`, `type-check`, `build`, `test`, `docs:check`.
2. Snapshot current submit payload keysets per model family from tests.
3. Freeze no-bloat rule for this track: no new runtime dependencies and no opportunistic refactors.

### P1: Shared Contract Gate
1. Add shared server utility that returns `valid | violation` and projected allowlisted payload.
2. Extend `ModelPayloadValidationSpec` with `allowedTopLevelFields?: string[]`.
3. Preserve current required/type/enum checks with no numeric coercion.
4. Standardize violation code: `GENERATION_PAYLOAD_CONTRACT_VIOLATION`.

### P2: Contract Completeness Before Enforcement
1. Ensure each submit route model has complete allowlist coverage for currently emitted keys.
2. Keep existing model custom validators and run generic contract gate in the same path.
3. Add parity tests that prove current emitted payload keysets pass.

### P3: Submit/Dispatch Hardening
1. Submit path (`createFalSubmitHandler`): run contract gate after safety rewrite and before billing/queue/provider calls.
2. Submit path must use projected payload, not raw `req.body`, for downstream steps.
3. Dispatch path: re-run the same gate on queued payload before provider submit.
4. On dispatch violation, fail closed with deterministic settlement path and `QUEUE_PAYLOAD_CONTRACT_VIOLATION`.
5. Enforce queue/generation/reservation linkage invariants; mismatch fails closed with `QUEUE_IDENTITY_MISMATCH`.

### P4: Queue Claim Collision Remediation
1. Add migration that hardens `claim_generation_submit_queue_batch` with per-user advisory claim lock semantics.
2. Add bounded app retry (single retry + jitter) for claim conflict failures.
3. Keep existing lease semantics and per-user active dispatch invariant.

### P5: Docs, ADR, And Closeout
1. Add ADR: strict shared payload boundary for submit + dispatch.
2. Update SOPs with new failure codes and triage guidance:
   - `docs/sops/sop_generation_recovery_diagnostics.md`
   - `docs/sops/sop_provider_incident_response.md`
3. Record tracker evidence and closeout notes.

## Required Tests And Merge Gates
Per slice, required:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. Targeted generation pipeline tests for touched seams

Additional required coverage for this track:
1. Contract completeness coverage across submit models.
2. Client/server payload parity test (known keysets pass, injected unknown keys fail).
3. Submit violation response test (`400`, deterministic code/detail).
4. Dispatch fail-closed settlement test (`QUEUE_PAYLOAD_CONTRACT_VIOLATION`) with exactly-once semantics.
5. Identity mismatch fail-closed test (`QUEUE_IDENTITY_MISMATCH`).
6. Claim-conflict reliability test (`23505`-shape path with bounded retry).

Final gate:
1. `npm -C frontend run test`

## Assumptions And Defaults
1. Unknown top-level generation payload fields are disallowed.
2. Enforcement is immediate after contract completeness tests are green.
3. Pre-existing queued rows that violate contract are fail-closed.
4. Scope remains minimal-diff and behavior-preserving except intentional security fail-closed behavior.
