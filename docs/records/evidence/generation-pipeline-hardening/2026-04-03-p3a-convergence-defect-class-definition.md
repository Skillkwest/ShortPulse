# Phase 3A Convergence Defect-Class Definition (2026-04-03)

1. `slice_id`
   - `p3a-convergence-defect-class-definition`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 3A`
4. `surface`
   - `sql/check_generation_convergence_defect_classes.sql`
   - `docs/sops/sop_generation_recovery_diagnostics.md`
   - `frontend/lib/server/falIntegration/recoveryExecution.ts`
   - `frontend/lib/server/api/generationPublications.ts`
   - `frontend/lib/server/api/generationProjection.ts`
   - `frontend/lib/server/api/generationObservationInbox.ts`
   - `frontend/lib/server/generationControlPlane/observationBatchExecution.ts`
5. `commands_run`
   - focused repo inspection for:
     - `frontend/lib/server/falIntegration/recoveryExecution.ts`
     - `frontend/lib/server/api/generationPublications.ts`
     - `frontend/lib/server/api/generationProjection.ts`
     - `frontend/lib/server/api/generationObservationInbox.ts`
     - `frontend/lib/server/generationControlPlane/observationBatchExecution.ts`
     - `sql/check_generation_recovery_media_visible_latency.sql`
     - `sql/check_generation_settlement_integrity.sql`
     - `sql/check_generation_pipeline_backfill_baseline.sql`
     - `sql/migrations/076_add_generation_projection_publication_and_observation_tables.sql`
   - docs validation:
     - `npm -C frontend run docs:check`
6. `results`
   - Gap confirmed:
     - the repo already had queue-latency, media-visible latency, and settlement-integrity diagnostics
     - it did not have a canonical read-only query for the active Phase 3A defect class:
       - outputs exist without publication convergence
       - publications exist but projection is missing or nonterminal
       - terminal observation evidence exists while consumer state remains nonterminal
       - ignored or `missing_generation` observation rows hide convergence failures
   - New diagnostic:
     - `sql/check_generation_convergence_defect_classes.sql`
   - The new SQL classifies and details:
     - success generations with canonical outputs but zero publication rows
     - success generations with partial publication coverage
     - published outputs with missing projection rows
     - published outputs with non-`success` projection state
     - terminal observation evidence paired with nonterminal projection state
     - ignored observation rows with `processing_error = generation_not_found`
     - other ignored terminal observations
     - failed terminal observations
   - SOP alignment:
     - the generation-recovery diagnostics SOP now includes this query in the required read-first diagnostic set
     - operator capture guidance now explicitly calls for convergence defect-class counts and worst-case rows
   - Architectural interpretation:
     - this slice does not change runtime behavior
     - it creates the measurement surface needed before any Phase 3B/3C recovery hardening work
7. `failure_codes_asserted`
   - no runtime failure code contract changed
   - this slice classifies `generation_not_found` observation downgrades as an explicit measurable bucket
8. `contract_parity_delta`
   - no browser/runtime authority change
   - no queue, billing, or recovery mutation change
   - adds only a read-only SQL diagnostic plus SOP discoverability
9. `rollback_note`
   - Revert:
     - `sql/check_generation_convergence_defect_classes.sql`
     - `docs/sops/sop_generation_recovery_diagnostics.md`
   - Expected rollback effect:
     - operators lose the canonical read-only Phase 3A defect-class query surface
     - convergence work falls back to anecdotal UUID inspection rather than repeatable classification
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` Phase 3A defect class is now represented by a canonical repo-local read-only diagnostic
     - `pass` the diagnostic covers outputs, publications, projection, and observation-inbox downgrade buckets
     - `pass` operator SOP now references the new diagnostic explicitly
   - Required gates:
     - `pass` no runtime code path changed
     - `pass` no staging or production environment used
     - `pass` unrelated AI Studio dirty files remained untouched
   - Docs/tracker/evidence parity:
     - `pass` evidence packet added to the governed evidence surface
12. `audit_findings`
   - `blocking`
     - none
   - `non-blocking`
     - the new query classifies current-state defects but does not yet reconstruct exact write-order breakpoints inside recovery execution
     - `generation_observation_inbox.processing_error` only partially distinguishes ignored causes, so some ignored rows remain a broader bucket
   - `deferred`
     - Phase 3B should run this query on approved dev data and use the resulting rows to identify the first concrete post-output breakpoint
     - if the query shows a clean system, Phase 3A can close quickly and Phase 3B should pivot to narrower diagnosis around the historical defect class
13. `parity_check`
   - `pass`
   - Notes:
     - the query matches the plan’s requested defect buckets
     - the slice stays read-only and is the right precondition for convergence hardening
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 3A Decision
This slice is worth keeping.

It turns the next convergence lane from anecdotal inspection into a repeatable defect-class measurement surface.

## Next Step
Run the new diagnostic on approved development data and use the resulting defect rows to choose the first Phase 3B diagnosis target.
