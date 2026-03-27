# Generation Pipeline Rebuild Phase 3 Canonical Output Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: Active

## Summary
Phase 3 starts the additive schema transition to canonical server-owned generation output records.

This phase introduces `ai_generation_outputs` as the durable output authority for generation success, without removing compatibility fields yet. The immediate goal is to stop relying on `ai_generations.metadata.result_urls` and `media_files.metadata.generation_output_index` as the only durable output model.

## Scope
In scope:
1. additive `ai_generation_outputs` schema introduction
2. recovery dual-write for canonical generation outputs
3. persisted status/read paths preferring canonical output rows
4. output-slot idempotency and output-level linkage to `media_files`
5. directly related tests and documentation updates

Out of scope:
1. full `generation_attempts` introduction
2. full reconciler unification
3. broad Reference Grid cutover to canonical output rows
4. metadata compatibility removal or backfill cleanup

## Objective
By the end of Phase 3, the server should own a first-class output record for each recovered generation slot, including cases where autosave is skipped and no `media_files` row exists yet.

## Slice Tracker
| Slice ID | Goal | Primary Surfaces | Exit Gate | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| `GPR-P3-S1` | Introduce canonical output schema and first recovery dual-write | `sql/migrations/071_add_ai_generation_outputs.sql`, recovery success paths, persisted status helpers | recovered generations create `ai_generation_outputs` rows on both autosave-persisted and autosave-skipped success | targeted recovery/status vitest bundle + docs parity checks | Completed |
| `GPR-P3-S2` | Prefer canonical outputs in persisted server reads | persisted status/result helpers and adjacent server readers still using metadata-first output reads | persisted status APIs read canonical outputs first with metadata fallback only for compatibility | targeted status proxy/persisted results vitest bundle | Completed |
| `GPR-P3-S3` | Extend canonical outputs into manual-save and downstream server persistence lanes | manual save/copy flows, recovery media persistence, and adjacent persistence helpers | later persistence can attach `media_file_id` to existing output rows instead of inventing new output authority | targeted AI Studio persistence/api vitest bundle | Completed |
| `GPR-P3-S4` | Prepare compatibility contraction | backfill strategy, metadata fallback audit, and read-path contraction plan | concrete removal/backfill checklist exists before any compatibility-field cleanup | docs/checklist updates + targeted drift audit | In Progress |

## Execution Order
1. Land `GPR-P3-S1` and `GPR-P3-S2` first so new generations have canonical output rows and server readers can consume them.
2. Later/manual persistence and recovery media persistence are now connected to canonical output rows instead of creating another output authority.
3. Do not start compatibility removal until `GPR-P3-S4` has a concrete backfill and cutover checklist.

## Constraints
1. Keep the change additive and fail-closed.
2. Do not remove metadata compatibility fields in this phase.
3. Do not let `ai_generation_outputs` become a second uncontrolled authority; readers should prefer it intentionally.
4. Preserve autosave-skipped success semantics while still recording canonical output rows.

## Compatibility Contraction Inventory
Remaining compatibility surfaces confirmed on this branch:
1. [falStatusPersistedResults.ts](../../frontend/lib/server/api/falStatusPersistedResults.ts) still falls back to `ai_generations.metadata.result_urls` and `media_urls` when canonical output reads are empty or fail.
2. [mediaLibraryPersistence.ts](../../frontend/features/ai-studio/logic/mediaLibraryPersistence.ts) still uses `media_files.source_ref + metadata.generation_output_index` to discover existing AI Studio rows before save.
3. [copy-from-url.ts](../../frontend/pages/api/media/copy-from-url.ts) still uses the same legacy metadata-index lookup in the server copy fallback.
4. [recoveryMediaPersistence.ts](../../frontend/lib/server/falIntegration/recoveryMediaPersistence.ts) now prefers canonical output rows, but still retains legacy `media_files` metadata-index fallback for historical coverage.
5. [recoveryLifecycleTransitions.ts](../../frontend/lib/server/falIntegration/recoveryLifecycleTransitions.ts) still writes `result_urls` and `media_file_ids` into `ai_generations.metadata` for compatibility.
6. [data-dictionary.md](../data-dictionary.md) and [022_generation_persist_idempotency.sql](../../sql/migrations/022_generation_persist_idempotency.sql) still document/support the legacy `metadata.generation_output_index` uniqueness path.

## Compatibility Contraction Checklist
Before removing compatibility fields or legacy read paths:
1. Inventory every remaining server/client reader that still consumes `ai_generations.metadata.result_urls`, `media_file_ids`, or `media_files.metadata.generation_output_index` as an output-authority signal.
2. Convert the highest-value remaining server readers to canonical-first, compatibility-fallback behavior, starting with persisted status fallback and AI Studio existing-row discovery.
3. Define a backfill plan for historical generations that have `media_files` rows but no `ai_generation_outputs` rows, including duplicate-slot handling.
4. Define a backfill plan for historical success generations that only retain `metadata.result_urls` and do not yet have canonical output rows.
5. Add an explicit cutover gate for when it is safe to stop writing `result_urls` and `media_file_ids` into `ai_generations.metadata`.
6. Keep the legacy uniqueness/indexed lookup path until the historical backfill and read-path conversion are both complete and verified.

## Validation Bundle
1. targeted recovery execution vitest suites
2. targeted persisted status/status proxy vitest suites
3. `npm -C frontend run docs:check`

## Exit Criteria
1. New recovered successes always create `ai_generation_outputs` rows for each output slot.
2. Persisted status reads prefer canonical output rows over metadata snapshots.
3. Output-slot identity is durable even when autosave is skipped.
4. Phase tracking and data-dictionary docs match the runtime reality on this branch.
5. A concrete compatibility-contraction checklist exists before any legacy metadata removal begins.
