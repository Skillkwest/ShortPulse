# Generation Pipeline Rebuild Lane 2 Backfill Execution Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Purpose
This plan turns Lane 2 from a gate document into an executable workstream.

Lane 2 exists to:
1. classify historical generation/output rows
2. backfill canonical output and media linkage safely
3. retire legacy output-authority fallbacks in a bounded order

## Scope
In scope:
1. historical `ai_generations` success rows
2. historical `ai_generation_outputs` coverage gaps
3. historical `media_files` linkage gaps
4. fallback-reader inventory and retirement order
5. quarantine rules for ambiguous historical rows

Out of scope:
1. request/attempt state-transition redesign
2. broad Reference Grid cutover
3. unrelated Media Library redesign
4. provider API behavior changes

## Preconditions
Lane 2 may execute because:
1. Lane 1 planning is complete
2. Lane 1 implementation is paused at a defined done-state boundary
3. `ai_generation_outputs` already exists and is the canonical target for outputs

## Execution Slices
### `GPR-L2-S1`
Status:
1. In progress

Goal:
1. produce the historical row classification queries and baseline counts

Deliverables:
1. query set for each historical row class
2. mismatch query set for each inconsistency class
3. baseline evidence packet with counts

Exit gate:
1. every required historical row class is measurable
2. every inconsistency class is measurable
3. the repo has a concrete fallback-reader inventory for output authority
4. `generation-pipeline-rebuild-lane-2-classification-query-set-and-fallback-inventory-2026-03-27.md` exists
5. the repo has an approved fixed read-only execution path for baseline counts without relying on local temp files or ad hoc DB access

Current blocker:
1. the hosted workflow `.github/workflows/generation-pipeline-backfill-baseline.yml` is not dispatchable until that workflow file exists on the default branch; GitHub Actions resolves manual workflow identifiers from the default branch, so a branch-only workflow cannot yet produce the first staging evidence packet

### `GPR-L2-S2`
Status:
1. Pending

Goal:
1. backfill canonical output rows for historical success generations

Deliverables:
1. migration or controlled script for output-row backfill
2. duplicate-slot protection rules
3. dry-run and post-run count evidence

Exit gate:
1. historical success generations can be represented in canonical output rows without guessing ambiguous lineage

### `GPR-L2-S3`
Status:
1. Pending

Goal:
1. backfill `media_file_id` linkage onto canonical output rows where durable media already exists

Deliverables:
1. backfill logic for canonical output -> durable media linkage
2. duplicate and mismatch handling rules
3. post-run mismatch evidence

Exit gate:
1. saved historical generated media can be discovered from canonical outputs first

### `GPR-L2-S4`
Status:
1. Pending

Goal:
1. define and implement quarantine handling for inconsistent historical rows

Deliverables:
1. explicit quarantine criteria
2. operator-facing query/report path
3. rollback and re-run posture

Exit gate:
1. ambiguous rows are quarantined intentionally rather than silently guessed

### `GPR-L2-S5`
Status:
1. Pending

Goal:
1. retire legacy output-authority fallbacks in bounded order

Deliverables:
1. ordered fallback-retirement checklist
2. explicit coverage threshold for each fallback reader
3. rollback trigger for each retirement step

Exit gate:
1. legacy output fallbacks are no longer primary reads for covered historical rows

## Required Evidence
Each slice must produce:
1. exact query or script entrypoints
2. dry-run counts before mutation
3. post-run counts after mutation
4. mismatch or quarantine counts
5. rollback posture

## Validation Bundle
1. `npm -C frontend run docs:check` for planning/doc parity
2. targeted SQL lint or migration validation for any migration-based slice
3. targeted runtime tests for any reader cutover touched by fallback retirement
4. explicit before/after counts for row classes and inconsistency classes

## Stop Rules
Stop Lane 2 when:
1. the next step would widen into Lane 3 read-model cutover
2. the next step depends on unresolved historical ambiguity that needs operator policy first
3. canonical coverage is good enough that the remaining work becomes pure cleanup

## Immediate Next Move
1. land `.github/workflows/generation-pipeline-backfill-baseline.yml` on the default branch through the normal merge path
2. execute `GPR-L2-S1`
3. use the fixed hosted read-only baseline runner to capture the first count packet in staging
