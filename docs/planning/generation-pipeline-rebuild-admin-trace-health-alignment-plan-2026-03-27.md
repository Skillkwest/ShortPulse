# Generation Pipeline Rebuild Admin Trace And Health Alignment Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document defines the next explicit follow-on job after the current Lane 4 operator/SOP alignment checkpoint.

It is a new job with a different objective:
1. align operator-facing admin trace and health views with the rebuilt request/attempt/output model
2. reduce admin diagnostics dependence on legacy `request_id` and `source_ref` heuristics where canonical attempts and outputs now exist
3. keep scope on admin/operator read surfaces, not broader user-facing Lane 3 cutover or another mutation-path refactor

## Why This Job Exists
The current branch now has:
1. canonical attempt lineage in `generation_attempts`
2. canonical outputs in `ai_generation_outputs`
3. explicit staged recovery control-plane ownership
4. aligned operator SOP and route docs for those rebuilt boundaries

But the admin diagnostics layer still lags behind:
1. `frontend/pages/api/admin/generation-trace.ts` still centers trace lookup on `ai_generations.request_id` and metadata `source_ref` first
2. `frontend/lib/server/adminUserHealth/deepReport.ts` and `frontend/lib/server/adminUserHealth/fleet.ts` still reason primarily from generation rows plus reservation `source_ref` / `provider_request_id` linkage
3. `/admin/generation-trace`, `/admin/user-health`, and `/admin/user-health-fleet` do not yet clearly surface canonical attempt/output-backed evidence as first-class operator context

## Scoped Objective
Define and implement one explicit admin/operator read-model alignment for generation trace and health diagnostics.

The job should answer:
1. how admin trace lookup should use generations, attempts, outputs, reservations, and ledger together
2. how per-user health and fleet health should incorporate canonical attempt/output evidence without reopening billing or recovery design
3. which admin surfaces remain compatibility-first and which should become canonical-first now

## In Scope
1. admin generation trace lookup posture and evidence ordering
2. per-user admin health linkage posture
3. fleet health linkage posture where canonical attempts materially improve operator diagnosis
4. operator-facing docs and route docs only where they need parity with the new admin trace posture
5. narrow implementation changes only where the contract removes real operator ambiguity

## Explicitly Out Of Scope
1. broader Lane 3 user-facing read/reuse cutover
2. lifecycle mutation redesign
3. billing settlement redesign
4. historical normalization/backfill
5. broad admin UI redesign unrelated to generation trace/health evidence

## Primary Surfaces
1. `frontend/pages/api/admin/generation-trace.ts`
2. `frontend/pages/admin/generation-trace.tsx`
3. `frontend/pages/api/admin/user-health.ts`
4. `frontend/lib/server/adminUserHealth/deepReport.ts`
5. `frontend/lib/server/adminUserHealth/fleet.ts`
6. `frontend/pages/api/admin/user-health-fleet.ts`
7. `docs/sops/sop_admin_user_health_fleet_operations.md`
8. `docs/api/api-internal-routes.md`

## Exit Gate
This job is done when:
1. admin trace and health surfaces have an explicit canonical-vs-compatibility posture
2. operator diagnostics use attempts/outputs where they materially reduce ambiguity
3. remaining legacy `request_id` / `source_ref` usage is narrow, intentional, and documented
4. the next remaining work would widen into broader admin UX redesign, Lane 3 user-facing cutover, or historical repair work

## Done State
1. `/api/admin/generation-trace` has explicit attempt/output-aware lookup and evidence ordering where canonical rows exist
2. `/api/admin/user-health` and fleet health logic document and apply canonical attempt/output linkage where it materially improves diagnosis
3. operator next-step guidance references canonical evidence, not only legacy request-id/source-ref seams
4. any remaining compatibility fallbacks are explicit and bounded

## Proposed Execution Slices
### `GPR-AH-S1`
Status:
1. Completed

Goal:
1. write the admin trace and health alignment contract from current repo behavior

Exit gate:
1. one planning artifact defines canonical-vs-compatibility posture for trace and health surfaces before code changes

Artifact:
1. `docs/planning/generation-pipeline-rebuild-admin-trace-health-alignment-contract-2026-03-27.md`

Implemented checkpoint:
1. `/api/admin/generation-trace` is explicitly classified as generation-entry with canonical attempt/output expansion still missing
2. `/api/admin/user-health` is explicitly classified as generation-first diagnostics with canonical attempt/output linkage as the next bounded improvement
3. fleet health is explicitly classified as compact compatibility-aware scan logic, not bulk deep diagnostics
4. the next code slice is now clearly `GPR-AH-S2`, not another broad trace/health audit

### `GPR-AH-S2`
Status:
1. Completed

Goal:
1. make `/api/admin/generation-trace` attempt/output-aware where canonical evidence exists

Exit gate:
1. the trace route no longer relies primarily on `ai_generations.request_id` and metadata `source_ref` when canonical attempt/output records are available

Implemented checkpoint:
1. `/api/admin/generation-trace` now expands request-oriented trace lookup through `generation_attempts`
2. admin trace now returns canonical `generationAttempts` and `generationOutputs` collections
3. media-file evidence now expands through canonical output `media_file_id` linkage, not only `media_files.source_ref`
4. `/admin/generation-trace` now renders attempt/output evidence as first-class operator sections

### `GPR-AH-S3`
Status:
1. Completed at the current checkpoint

Goal:
1. align per-user and fleet health read models with canonical attempt/output evidence where it materially improves operator diagnosis

Exit gate:
1. admin health linkage logic prefers canonical attempt/output evidence where available and leaves only bounded compatibility seams

Implemented checkpoint:
1. `/api/admin/user-health` now loads canonical attempts and outputs for the current user's generation set
2. `deepReport.ts` now treats attempts as provider-identity evidence when `request_id` is absent
3. `deepReport.ts` now treats canonical output rows as persisted-success evidence, reducing false charge-without-success diagnosis
4. fleet health remains intentionally compact and compatibility-aware in this checkpoint rather than widening into bulk canonical joins

## Current Checkpoint
1. `GPR-AH-S1` is completed.
2. `GPR-AH-S2` is completed.
3. `GPR-AH-S3` is completed at the current checkpoint.
4. the next remaining work would widen into fleet-scale canonical joins, broader admin UX redesign, or a different Lane 4 cleanup job.
5. this job is now done at its current checkpoint.

## Validation Bundle
1. targeted admin trace tests
2. targeted admin user-health and fleet-health tests
3. docs parity checks
4. self-audit confirming we reduced operator ambiguity instead of adding a second diagnostics model

## Stop Rules
Stop this job when:
1. the next step would widen into broader admin UI redesign
2. the next step would widen into Lane 3 user-facing cutover
3. the next step would widen into historical repair or migration cleanup
4. remaining work is mostly optional operator convenience rather than authority reduction
