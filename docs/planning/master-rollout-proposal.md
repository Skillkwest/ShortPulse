# ShortPulse Governance Realignment Master Rollout Plan (2026-02-20)

## Summary
This is the best path: a phased, auditable PR train with hard gates, compatibility windows, and machine-checkable evidence.  
It avoids big-bang risk by sequencing security/schema hardening first, then parity/governance closure, then decommission and structural cleanup, with clear rollback at every stage.

## Decision Locks
1. Migration policy is forward-only. Historical migration `018` is never edited.
2. `028` is the hardening migration for conversation state.
3. Retention bounds are DB-enforced and server-owned:
- `p_ttl`: min `1 day`, max `90 days`, default `30 days`.
- `p_user_cap`: min `1`, max `200`, default `200`.
4. `conversation_id` max length is `191`.
5. RPC name and return shape remain stable for app compatibility.
6. KEI API tombstones stay for one compatibility window before deletion.
7. New CI checks start in warn/evaluate mode, then move to enforce after two green release cycles.
8. Required status checks must map to exact CI job IDs.
9. Prototype-mode waiver: STG-06 enforcement completion is deferred for MVP iteration and remains mandatory before production readiness signoff.

## Governance Control Mapping
- COBIT 2019: EDM/BAI-aligned stage gates, ownership, measurable controls.
- ITIL 4: change enablement, release gating, rollback playbooks.
- ISO/IEC 38500:2024: accountability, strategy alignment, conformance evidence.
- NIST CSF 2.0: Govern function through policy-as-code, risk register, and traceable control outcomes.

## Stage Sequence
| Stage | Purpose | Primary Outputs | Depends On | Exit Gate |
| --- | --- | --- | --- | --- |
| STG-00 | Governance contract lock | `_inventory.md` seed, decision register, check-name registry | None | Decision lock approved |
| STG-01 | Inventory + overlap audit | `_inventory.md`, `overlap-audit.md` | STG-00 | Conflict resolutions locked |
| STG-02 | SQL/RPC security hardening | `028` migration + rollback + SQL evidence | STG-01 | SQL security/correctness pass |
| STG-03 | Schema/runtime/docs parity | `feasibility-report.md`, parity doc updates | STG-02 | Zero parity drift |
| STG-04 | KEI compatibility decommission | tombstones, replacement tests, then deletion | STG-03 | Compatibility + coverage gates pass |
| STG-05 | Structural modularization | hotspot splits + architecture evidence | STG-03 | No behavior regressions |
| STG-06 | CI/policy-as-code enforcement | `ci-policy-checks.md`, drift scripts, CI wiring | STG-04 | New checks active |
| STG-07 | Verbatim source preservation | `archive/original-plans/*`, `manifest.json` | STG-01 | Checksum verification pass |
| STG-08 | Final validation and signoff | `final-validation-summary.md` | STG-02..07 | All controls green |

## Stage Details

### STG-00 Governance Contract Lock
- Scope: freeze authoritative rules, ownership, and control vocabulary.
- Artifacts:
- `docs/planning/_inventory.md`
- `docs/planning/implementation-tracker.md`
- `docs/planning/ci-policy-checks.md` (initial registry section)
- Tasks:
- Define authority chain and controlled exception for `docs/planning/archive/original-plans/`.
- Register canonical CI job names and planned new unique names.
- Lock unresolved policy conflicts (row-cap bound, archive exception, enforcement timing).
- Validation:
- Cross-doc authority claims are non-contradictory.
- Tracker exists with stage-level status fields.
- Rollback:
- Revert STG-00 PR only; no runtime effect.

### STG-01 Plan Inventory And Overlap Audit
- Scope: formal source traceability and conflict register.
- Artifacts:
- `docs/planning/_inventory.md`
- `docs/planning/overlap-audit.md`
- Tasks:
- Catalog Foundational, KEI, Governance, and Modularization plans with Source IDs.
- Add risk register with severity, impact, mitigation, owner, due gate.
- Lock conflict resolutions for TTL/cap, migration ordering, CI naming, route/auth semantics.
- Validation:
- Every conflict maps to a resolution and stage.
- Every stage item maps back to source IDs.
- Rollback:
- Revert STG-01 PR only.

### STG-02 SQL/RPC Hardening (Migration `028`)
- Scope: secure `ai_agent_conversation_state` and `upsert_ai_agent_conversation_state`.
- Artifacts:
- `sql/migrations/028_harden_ai_agent_conversation_state_security.sql`
- `sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`
- `frontend/lib/server/api/agentConversationState.ts` (compat-safe runtime alignment only)
- Tasks:
- Keep RPC name/signature/return contract stable.
- Clamp `p_ttl`, `p_user_cap` in DB logic.
- Enforce `conversation_id` length guard.
- Make prune deterministic using stable tie-break ordering.
- Ensure current conversation row is not evicted in same upsert cycle.
- Add per-user concurrency serialization for upsert/prune cycle.
- Tighten `SECURITY DEFINER` hygiene with safe `search_path`.
- Restrict execute grants to required runtime role.
- Add stale-row cleanup function and operator scheduling guidance (daily cadence).
- Add default privilege guard for future-function exposure policy.
- Validation:
- Authenticated direct execute denied if service-role-only policy is selected.
- Service role path succeeds.
- Clamp tests pass for low/high/invalid inputs.
- Deterministic pruning under timestamp ties verified.
- Concurrency test shows no non-deterministic over-eviction.
- SQL lint passes: `supabase db lint --local --schema public --fail-on warning`.
- Rollback:
- Apply rollback migration for `028`; preserve data where feasible.
- Runtime kill switch remains: `STUDIO_AGENT_CANONICAL_DB_ENABLED=false`.

### STG-03 Schema/Runtime/Docs Parity
- Scope: eliminate code-doc-schema drift.
- Artifacts:
- `docs/planning/feasibility-report.md`
- `docs/database-migrations.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/data-dictionary.md`
- `docs/supabase_full_schema.sql` or explicit migration-first policy statement
- `README.md`
- `docs/routes.md`
- `docs/security-checklist.md`
- Tasks:
- Update migration run order to include `018` and `028`.
- Document table/RPC contract and retention policy.
- Align route protection docs with runtime prefix semantics from `frontend/lib/authGuard.ts` and `frontend/pages/_app.tsx`.
- Remove architecture contradiction text (“client-only/no backend”) where API routes are active.
- Validation:
- Route docs and runtime protected-route behavior match.
- API docs and `frontend/pages/api/**` inventory match.
- Migration docs and filesystem inventory match.
- Rollback:
- Docs-only reversion if needed; no DB changes.

### STG-04 KEI Compatibility Decommission
- Scope: remove KEI safely without auth/ownership coverage regression.
- Artifacts:
- Runtime/hook/type updates in AI Studio paths
- Temporary `/api/kei/*` tombstones (`410`) for compatibility window
- Replacement auth/ownership tests
- Final KEI surface deletions after hold
- Tasks:
- Phase A: remove runtime callers; keep tombstone routes.
- Phase B: merge replacement tests and CI fast-lane updates.
- Phase C: after compatibility window and low/no traffic, delete KEI API/client/tests and protected-path prefix.
- Hold-window Phase C gate (quantified):
- at least one production release after Phase B (`2026-02-20` baseline)
- trailing 14-day tombstone traffic is zero (`app_error_logs`, `source='api.kei_route_disabled'`, threshold `count=0`)
- last two base-branch runs for fast-lane auth/ownership suites are green
- any non-zero tombstone traffic resets the 14-day clock
- during tombstone hold, keep `410` behavior and add deprecation metadata (`Deprecation` and/or `Link: <...>; rel=\"deprecation\"`); add `Sunset` once Phase C target date is approved
- Validation:
- Build/lint/type-check/test/docs-check all pass.
- Auth boundary suites remain green after KEI test removal.
- No runtime imports/references to KEI remain.
- Hold-window evidence file exists: `docs/planning/evidence/kei/<date>-phase-c-hold-window-validation.md`.
- Rollback:
- Revert latest KEI phase PR only.
- Keep tombstones if Phase C fails.

### STG-05 Structural Debt Reduction
- Scope: modular split of high-risk oversized files with no feature changes.
- Artifacts:
- Concern-based splits for selected hotspot files.
- Architecture boundary evidence and size budget reports.
- Tasks:
- Split by concern: render/UI, state wiring, side effects, provider adapters.
- Preserve behavior; prohibit product changes in split PRs.
- Apply per-file budget policy and exception recording.
- Validation:
- Regression tests green.
- File-size budget check green or documented ADR exception.
- Rollback:
- Revert offending split PR only.

### STG-06 CI And Policy-As-Code Enforcement
- Scope: automate anti-drift and enforce governance.
- Artifacts:
- `docs/planning/ci-policy-checks.md`
- `scripts/check_docs_semantic_drift.js`
- `scripts/check_migration_doc_parity.js`
- `scripts/check_archive_manifest.js`
- CI workflow updates in `.github/workflows/ci.yml`
- Tasks:
- Add checks for route-doc parity, protected-route parity, API inventory parity, migration-doc parity, skill path validity, changelog chronology/date format.
- Add SQL lint job for DB-touching changes.
- Ensure unique job names across workflows.
- Wire branch protection to exact required check names.
- Validation:
- Seeded drift fixture fails checks intentionally.
- Aligned state passes.
- Enforce mode only after two green cycles.
- STG-06 cannot be marked `Completed` until:
- STG-04 Phase C is complete
- warn/evaluate checks are green for two release cycles
- branch-protection mapping proof with exact required check names is archived at `docs/planning/evidence/docs/<date>-branch-protection-required-check-mapping.md`
- Prototype-mode waiver:
- MVP feature development may continue while STG-06 stays `In Progress`
- production readiness still requires full STG-06 completion
- Rollback:
- Downgrade new checks to warn/evaluate mode and revert latest CI policy PR.

### STG-07 Preserve Original Plans Verbatim
- Scope: immutable preservation of source plans.
- Artifacts:
- `docs/planning/archive/original-plans/*` (verbatim copies)
- `docs/planning/archive/original-plans/manifest.json`
- Tasks:
- Copy source plans verbatim without frontmatter edits.
- Store hash, byte size, source commit, archive timestamp, copier in manifest.
- Add manifest verification script.
- Chat-sourced provenance convention:
- `source_path` uses `user-provided-plan:<exact plan title>`
- `source_commit` is the commit introducing archive entries
- `notes` includes: `Verbatim copy from user-provided plan text (conversation source, 2026-02-20).`
- Validation:
- Hash and byte counts match manifest.
- No transformed text in archived originals.
- Rollback:
- Rebuild archive from source and regenerate manifest.

### STG-08 Final Validation And Signoff
- Scope: closeout and control attestation.
- Artifacts:
- `docs/planning/final-validation-summary.md`
- Updated `docs/planning/implementation-tracker.md`
- Tasks:
- Verify no migration ordering conflicts.
- Verify no enforcement before compatibility windows.
- Verify no CI job collisions.
- Verify machine-checkable evidence for all controls.
- Capture Engineering + Security + Ops signoffs.
- Validation:
- All required checks green.
- All stage exit criteria marked complete with evidence links.
- Rollback:
- Reopen only failing stage; do not unwind completed unrelated stages.

## CI Contract (Current + Planned)
- Current jobs:
- `deadcode`
- `frontend`
- `adaptive_media_gate`
- `ai_studio_perf_gate`
- `security`
- Planned jobs:
- `docs_semantic_drift`
- `migration_parity`
- `architecture_boundary`
- `size_budget`
- `sql_lint`
- `archive_manifest_check`
- `conversation_state_hardening_gate` (manual, environment-gated)

## PR Train
1. PR-01: STG-00 + STG-01
2. PR-02: STG-02
3. PR-03: STG-03
4. PR-04: STG-04 Phase A/B
5. PR-05: STG-04 Phase C
6. PR-06+: STG-05 incremental split PRs
7. PR-07: STG-06
8. PR-08: STG-07
9. PR-09: STG-08 closeout

## Important Public API / Interface / Type Changes
1. SQL RPC `public.upsert_ai_agent_conversation_state`:
- Name unchanged.
- Return shape unchanged.
- Behavior hardened (TTL/cap clamp, deterministic pruning, length guard, privilege scope).
2. Privileges:
- Execute scope reduced to required role path (service-side).
3. Internal API:
- `/api/kei/*` tombstones retained for compatibility window, then removed in decommission phase.
4. Docs/CI contract:
- `docs:check` expands to semantic parity controls via additional CI checks.

## Test Cases And Scenarios
1. SQL security:
- Direct non-required-role execute denied.
- Required role execute succeeds.
2. SQL correctness:
- insert/update/turn increment behavior.
- deterministic pruning under timestamp ties.
- current conversation row non-eviction in same cycle.
- stale-row cleanup operation verified.
3. Runtime compatibility:
- canonical read/write path unchanged at call site.
- safe fallback when DB/RPC unavailable.
4. KEI retirement:
- replacement coverage exists before deletion.
- no runtime KEI references after final phase.
5. Docs/governance:
- route/API/migration parity checks fail on seeded drift and pass on aligned state.
6. CI governance:
- unique job names and required-check mapping validated.
- warn/evaluate to enforce promotion tracked.

## Assumptions And Defaults
1. Runtime canonical conversation state is server-owned.
2. Default retention TTL remains 30 days.
3. Default per-user cap remains 200.
4. `conversation_id` max length is 191 unless explicit product requirement changes via ADR.
5. Compatibility window for KEI tombstones is at least one production release window before deletion.
6. Cleanup remains non-feature work except explicit hardening behavior changes.
7. Forward migrations are preferred with rollback scripts where feasible.
