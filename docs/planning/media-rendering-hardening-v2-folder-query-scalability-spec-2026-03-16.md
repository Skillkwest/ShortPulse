# Media Rendering Hardening v2 Folder Query Scalability Spec (2026-03-16)

Last updated: 2026-03-18
Status: Active

## Problem Statement
Current folder-filter path materializes membership IDs and applies `.in("id", ids)` fan-in, which does not scale with large folder memberships.

## Design Goals
1. Remove unbounded client/server id fan-in for folder-scoped listing.
2. Preserve existing folder ownership and visibility constraints.
3. Keep cursor pagination semantics unchanged.

## Contract Requirements
1. Query shape must remain user-scoped and folder-scoped.
2. Empty-folder semantics remain deterministic (`rows=[]`, `hasMore=false`).
3. Query-shape change must not alter result ordering or duplicates behavior.

## Implemented Query Shape
1. Folder-scoped `media_files` listing uses `folder_membership:media_folder_media_items!inner()` and filters on:
- `folder_membership.folder_id`
- `folder_membership.user_id`
2. Folder-scoped `media_prompts` listing uses `folder_membership:media_folder_prompt_items!inner()` and filters on:
- `folder_membership.folder_id`
- `folder_membership.user_id`
3. Folder existence/ownership is still validated before the list query runs so `404` remains distinct from an empty folder.
4. Embedded membership rows are stripped before API responses are returned; response payload shape stays unchanged.

## Benchmark Dataset Tiers
1. Tier S: `<= 200` memberships
2. Tier M: `~2,000` memberships
3. Tier L: `>= 10,000` memberships

## Benchmark Gates
1. No timeout/error-rate increase vs baseline.
2. P95 query latency must be non-regressive at Tier S and improved at Tier M/L.
3. Memory/response overhead must not grow with membership fan-in patterns.

## Validation Requirements
1. Folder list/prompt list scalability characterization tests.
2. Cursor parity tests before vs after query-shape migration.
3. Staging benchmark packet attached before rollout ring progression.
