# Generation Pipeline Rebuild Compatibility Retirement Evidence Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document defines the next explicit Lane 4 job after the generated reuse authority cutover checkpoint.

Its job is to answer the last practical rebuild question:
1. which generation-pipeline compatibility paths are still required
2. which are now only legacy carry-forward
3. what evidence and rollback posture are required before any retirement or decommission work

## Why This Job Exists
The current branch has already completed the main authority-hardening work:
1. request/attempt lifecycle authority is centralized enough to stop Lane 1
2. recovery/control-plane ownership is staged and explicit
3. webhook ingress/replay is isolated
4. user-facing generated reuse surfaces are aligned under canonical output/storage authority
5. operator/admin surfaces read attempts and outputs where that materially improves diagnosis

What is still missing is retirement evidence.

The roadmap done state requires:
1. legacy metadata and request-id fallbacks are not primary runtime paths
2. historical compatibility is intentionally bounded
3. cleanup and legacy removal are rollback-aware

Right now those points are directionally true, but not yet locked by one explicit retirement-evidence lane.

## Objective
Produce the compatibility-retirement evidence needed to decide whether the overall rebuild can be called done at its current checkpoint.

This job should:
1. inventory the remaining generation-pipeline compatibility paths
2. classify each path as:
   - retain
   - retire later
   - retire now
3. define rollback/canary posture for any path that would be removed
4. separate “overall rebuild done” from “all legacy code deleted”

## In Scope
1. generation-pipeline compatibility reader inventory
2. request-id and metadata fallback inventory on server/admin surfaces
3. user-facing compatibility reader inventory where canonical output/storage authority already exists
4. rollback and canary evidence requirements for retirement
5. explicit done-state decision criteria for the overall rebuild roadmap

## Explicitly Out Of Scope
1. broad new runtime refactors
2. historical normalization/backfill expansion beyond bounded containment
3. user-facing layout or interaction redesign
4. mass deletion of compatibility code in the same planning step
5. branch promotion or rollout execution

## Primary Surfaces
1. `frontend/lib/server/api/generationSubmitPersistence.ts`
2. `frontend/lib/server/falIntegration/recoveryExecution.ts`
3. `frontend/lib/server/falIntegration/recoveryGenerationLookup.ts`
4. `frontend/pages/api/admin/generation-trace.ts`
5. `frontend/pages/api/admin/user-health.ts`
6. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
7. `frontend/features/ai-studio/logic/referenceDownload.ts`
8. `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
9. roadmap and active rebuild planning docs under `docs/planning/`

## Done State
This job is done when:
1. the remaining compatibility paths are inventoried and classified
2. each path has an explicit disposition:
   - keep as bounded compatibility
   - retire in a future removal lane
   - safe to retire now
3. rollback/canary requirements are documented for any future retirement work
4. the roadmap can honestly state whether the overall rebuild is done at the current checkpoint
5. the next remaining work, if any, is a deliberate cleanup/removal job rather than more authority discovery

## Execution Slices
### `GPR-CR-S1`
Goal:
1. inventory the remaining compatibility paths across server, admin, and user-facing generation surfaces

Status:
1. Done

Exit gate:
1. one inventory artifact names the remaining compatibility readers and their authority role

Artifact:
1. `docs/planning/generation-pipeline-rebuild-compatibility-retirement-inventory-2026-03-27.md`

### `GPR-CR-S2`
Goal:
1. classify each compatibility path by retention posture and risk

Status:
1. Done

Exit gate:
1. each path has a concrete disposition and rationale tied to rebuild done-state criteria

Artifact:
1. `docs/planning/generation-pipeline-rebuild-compatibility-retirement-classification-2026-03-27.md`

### `GPR-CR-S3`
Goal:
1. define rollback/canary requirements for any future compatibility retirement work

Status:
1. Done

Exit gate:
1. future removal work has an explicit evidence packet shape and the roadmap can decide whether the broader rebuild is done now or still open

Current checkpoint:
1. no inventoried compatibility path requires immediate retirement for rebuild closeout
2. the first future retirement candidate is the recovery lookup request-id fallback
3. any future removal work should run under a separate cleanup/removal lane with rollback evidence

## Validation Bundle
1. docs parity checks
2. repo-backed inventory references for each classified path
3. self-audit confirming the lane produces a go/no-go rebuild closeout signal rather than another generic cleanup backlog

## Stop Rules
Stop this job when:
1. the next step would become actual deletion/removal work rather than retirement evidence
2. the next step would widen into a different lane
3. the overall rebuild done-state decision is explicit enough to stop safely
