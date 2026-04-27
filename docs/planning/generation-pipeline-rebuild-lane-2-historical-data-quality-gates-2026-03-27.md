# Generation Pipeline Rebuild Lane 2 Historical Data Quality Gates (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document defines the historical data quality gates that must be satisfied before Lane 2 backfill and legacy fallback retirement can proceed.

Lane 2 is not a mandatory normalization lane. It is a data-classification and safety lane whose job is to keep historical compatibility from weakening the forward pipeline.

## Required Historical Row Classes
Every historical generation row must be classified into one of these buckets before fallback retirement:
1. canonical-ready
   - `ai_generation_outputs` already exists and is sufficient
2. output-backfill-needed
   - generation success exists but canonical output rows do not
3. media-link-backfill-needed
   - canonical output row exists but `media_file_id` is missing while durable media exists
4. compatibility-only
   - only legacy `ai_generations.metadata.result_urls` or `media_files.metadata.generation_output_index` linkage exists
5. inconsistent
   - conflicting or ambiguous lineage that cannot be safely auto-backfilled

## Inconsistency Classes
Lane 2 must explicitly measure and classify at least these conditions:
1. duplicate output-slot collisions for the same generation
2. success generations with no canonical outputs and no legacy result URLs
3. media rows with `generation_output_index` but no trustworthy generation linkage
4. multiple generation rows for the same `provider_request_id`
5. canonical output rows whose `provider_request_id`, `generation_id`, and linked media rows disagree
6. generations whose billing state implies success while outputs are absent

## Lane 2 Safety Gates
Targeted historical repair may begin only after:
1. historical row classes are queryable and measurable
2. the repo has a documented rule for each inconsistency class:
   - auto-fix
   - quarantine for operator review
   - retain compatibility fallback temporarily
3. there is a concrete forward-pipeline risk that justifies historical mutation work

Fallback retirement may begin only after:
1. canonical coverage is measured
2. inconsistent-row counts are measured
3. operator review flow exists for quarantined rows
4. rollback path exists for backfill regressions

## Required Evidence
Before retiring a legacy output-authority fallback, Lane 2 must produce:
1. backfill dry-run counts by row class
2. post-backfill counts by row class
3. mismatch counts for duplicate or ambiguous lineage
4. explicit list of fallback readers still relying on compatibility state

If no concrete forward-path risk exists, these gates should be treated as optional cleanup evidence rather than mandatory rebuild work.

## Relationship To Other Lanes
1. Lane 1 must lock request/attempt identity before Lane 2 begins implementation.
2. Lane 3 broad read-model cutover must wait for Lane 2 evidence only if historical compatibility still threatens forward read safety.
3. Lane 4 cleanup must wait until incompatible historical rows are either repaired or intentionally quarantined.
