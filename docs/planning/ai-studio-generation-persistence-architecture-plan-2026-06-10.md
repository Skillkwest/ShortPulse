# AI Studio Generation Persistence Architecture Plan

## Status

Ready for implementation.

## Date

2026-06-10

## Objective

Make generated media delivery durable when a user leaves AI Studio, changes projects, refreshes, closes the browser, or returns later. A provider-accepted generation must continue under server authority until the provider reaches terminal success or terminal failure. Successful media must become durable and discoverable through the project Reference Grid. Failed provider generations must produce an error reference instead of disappearing.

## Source Of Truth

This plan is the implementation source of truth for the generation persistence fix.

Primary repo authorities:

- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/adr/0065-project-generated-output-association-and-restore-refresh.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/lib/server/api/generationAbandonment.ts`
- `frontend/lib/server/api/generationReconcile.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`

## Owner And Lane

Owner/lane: AI Studio generation persistence and server recovery architecture.

This is a backend lifecycle, recovery, projection/publication, and project-restore lane. UI changes are limited to preserving existing Reference Grid behavior and error-card visibility. No visual redesign is in scope.

## Problem Statement

Production evidence showed Kie tasks that succeeded at the provider but did not appear in the Reference Grid after AI Studio navigation. The project association layer was not the root failure: affected rows had `generation_projection.project_id` and `project_generation_items` association.

The stronger root cause is lifecycle authority drift:

- `/api/generation/abandon` records `generation_abandonments`.
- `recordGenerationAbandonment` currently marks active `ai_generations` rows as `status='fail'`, `failure_reason_code='user_abandoned'`, `recovery_state='exhausted'`, and marks attempts `abandoned`.
- The provider job is not canceled by that route.
- Later provider success cannot recover because `fail -> success` is blocked except for the narrow `terminal_success_no_media` case.
- `syncTerminalSuccessViewState` and `syncTerminalFailureViewState` also suppress projection visibility when abandonment metadata exists.

This makes a local UI removal/session cleanup primitive too powerful. It can override the provider truth and strand paid media.

## Architecture Decision

Do not build a second generation pipeline.

Use the existing server-owned pipeline as the canonical architecture:

1. Submit writes durable server state.
2. Provider-accepted request ids attach to `ai_generations`, `generation_attempts`, `generation_projection`, and project association when a project is present.
3. The server control plane and `/api/generation/reconcile` run the same recovery engine.
4. Recovery probes the provider, persists outputs, settles billing, updates projection/publication, and wakes follow-up work.
5. Reference Grid hydration renders `generation_projection` and associated project rows.

The implementation must harden lifecycle boundaries inside that architecture:

- Browser/session/project navigation is never terminal lifecycle authority.
- Reference Grid deletion/suppression is visibility authority only unless provider cancellation is actually supported and confirmed.
- Provider terminal state is the source of truth for generation success/failure.
- Billing settlement follows provider terminal state, not UI visibility.
- Project reopen reconcile must be allowed to recover any project-bound provider-accepted job that is still provider-recoverable.

## Approved Scope

In scope:

- Generation lifecycle state machine and transition guards.
- Abandonment/removal endpoint semantics.
- Recovery execution success/failure handling.
- Project reopen reconcile eligibility.
- Projection/publication visibility rules.
- Focused tests for navigation-away, explicit remove, provider success, provider failure, and project reopen.
- Documentation and ADR updates for the new lifecycle contract.
- A bounded repair path for rows already stranded by `user_abandoned` when the provider can still prove success or failure.

Out of scope:

- New external backend services.
- UI redesign.
- Changing provider pricing or credit costs.
- Replacing Supabase Cron with a different scheduler.
- Commit, push, deploy, or production mutation unless explicitly requested.
- Broad Reference Grid refactors unrelated to lifecycle authority.

## Target Invariants

1. A provider-accepted generation remains recoverable while the provider is running.
2. UI removal cannot mark a provider-running generation as local terminal failure.
3. Provider success with media can always converge to persisted outputs unless a real provider cancellation or policy failure exists.
4. Provider failure can always converge to a visible project error reference unless the user explicitly suppressed that specific output.
5. Project reopen can trigger reconciliation for project-bound running, pending, recovering, suppressed-but-recoverable, or terminal-no-media rows.
6. Billing success/failure settlement is independent of whether the Reference Grid card is visible.
7. Existing right-rail global authority remains intact.
8. There is one canonical server recovery path. No hidden fallback worker, duplicate projection writer, or client-only completion path.

## Implementation Plan

### Batch 1: Freeze The Lifecycle Contract

Objective: write the durable contract before code changes so implementation does not drift.

Steps:

1. Add ADR `docs/adr/0091-generation-provider-lifecycle-vs-reference-visibility.md`.
2. Define lifecycle terms:
   - provider accepted
   - provider terminal success
   - provider terminal failure
   - provider canceled
   - reference-grid suppressed
   - user removed from view
   - abandoned legacy row
3. State that `generation_abandonments` is not provider-cancel authority.
4. State that active provider jobs must not be terminalized by UI visibility actions.
5. Update `docs/sops/sop_generation_recovery_diagnostics.md` with the new contract and diagnostic expectations.

Proof:

- `npm -C frontend run docs:check`
- Review that the ADR has one owner, one source of truth, and no alternate implementation lane.

### Batch 2: Replace Active Abandonment With Visibility Suppression

Objective: stop the current root cause at the source.

Steps:

1. Introduce canonical server helper `frontend/lib/server/api/generationVisibilitySuppression.ts` for Reference Grid visibility suppression.
2. Make `/api/generation/abandon` delegate to the new helper for compatibility, but change behavior:
   - For `pending`, `submitted`, `running`, or `recovering` provider-backed rows, do not set `ai_generations.status='fail'`.
   - Do not set `failure_reason_code='user_abandoned'`.
   - Do not set `recovery_state='exhausted'`.
   - Do not mark attempts `abandoned`.
   - Do update projection/publication visibility to suppressed when the user explicitly removes the output.
   - Do record suppression metadata that does not imply provider cancellation.
3. For already terminal rows, keep visibility suppression behavior, but still do not rewrite provider lifecycle truth.
4. Add reason validation:
   - accepted reasons include explicit user UI actions such as `reference_grid_clear`, `reference_grid_delete`, and `quick_slot_detach_finalize`;
   - navigation, project switch, refresh, and pagehide must not call this endpoint.
5. Add telemetry for suppression calls with reason, generation status, and whether lifecycle was preserved.

Proof:

- Unit tests for active row suppression preserving lifecycle.
- API route test for `/api/generation/abandon`.
- Existing explicit delete tests updated to assert lifecycle preservation, not terminal failure.

### Batch 3: Make Recovery Override Legacy Local Abandonment Safely

Objective: allow server recovery to repair paid provider successes already stranded by old local abandonment semantics.

Steps:

1. Update recovery transition logic in `recoveryExecutionRuntime.ts` or a dedicated policy module so provider success may recover rows with legacy `failure_reason_code='user_abandoned'` only when all are true:
   - provider probe returns terminal success with media;
   - request id belongs to the same user/generation;
   - row has no explicit provider-canceled marker;
   - row has no provider terminal failure evidence newer than the success evidence.
2. Preserve explicit visibility suppression if the row was deliberately removed, but still persist outputs and settle billing correctly.
3. For project-bound rows where the suppression came from old accidental abandonment, prefer restoring Reference Grid visibility when the suppression reason is not a verified user deletion.
4. Add metadata to identify `legacy_abandonment_recovered_at` and `legacy_abandonment_recovery_actor`.
5. Keep `fail -> success` blocked for real provider failures, moderation failures, and future confirmed provider cancellations.

Proof:

- Recovery tests for `user_abandoned + provider success with media -> success`.
- Recovery tests for `provider_error + later success probe -> blocked`.
- Recovery tests for `terminal_success_no_media` still passing.
- Billing settlement tests confirm one charge and no duplicate capture.

### Batch 4: Strengthen Project Reopen Reconcile Eligibility

Objective: project reopen must ask the server to recover every project-bound generation that can still change visible outcome.

Steps:

1. Expand `generationReconcile.ts` project identity lookup beyond visible pending/running projection rows.
2. Include project-bound identities from:
   - `project_generation_items`;
   - direct `generation_projection.project_id`;
   - `ai_generations.metadata.shortpulse_context.project_id` if needed as a repair source.
3. Reconcile rows in these classes:
   - `pending` / `running`;
   - `recovery_state in ('queued', 'recovering')`;
   - `failure_reason_code='terminal_success_no_media'`;
   - legacy `failure_reason_code='user_abandoned'` with provider request id and project association.
4. Keep a bounded batch size, but sort by newest and active project association first.
5. Return enough reconcile state for diagnostics without exposing provider payloads or secrets.
6. Ensure client hydration still first lists existing visible rows, then calls reconcile, then relists.

Proof:

- `generationReconcile` tests for project-bound hidden legacy rows.
- `useAiStudioGeneratedOutputMaintenance` tests for project reopen triggering reconcile and relist.
- Production-safe manual proof after deploy: create Kie video, leave AI Studio, return after provider terminal state, verify Reference Grid converges.

### Batch 5: Guarantee Error References For Provider Failure

Objective: if the provider fails while the user is away, AI Studio should show an error reference on return.

Steps:

1. Audit `syncTerminalFailureViewState` visibility policy.
2. Ensure provider failure produces `generation_projection.task_state='fail'`, `status='ready'`, `reference_grid_visible=true`, and clear error text when no explicit user suppression exists.
3. Ensure explicit visibility suppression stays respected for deliberately removed rows.
4. Ensure project reopen list includes terminal failure projections for the current project.
5. Keep the error card non-billable if settlement released the reservation.

Proof:

- Projection tests for provider failure visibility.
- Generated-output authority tests for failed rows in project Reference Grid.
- API/reconcile tests for provider failure while away.

### Batch 6: Validate The Background Control Plane

Objective: prove the existing server worker is healthy rather than adding a new worker.

Steps:

1. Run or document the hosted diagnostic path from `docs/sops/sop_generation_recovery_diagnostics.md`.
2. Use `sql/check_control_plane_scheduler_health.sql`, `sql/check_pg_net_failure_taxonomy.sql`, and `sql/check_generation_recovery_media_visible_latency.sql` through the approved Supabase CLI or hosted diagnostics path.
3. Verify the Supabase Cron job named `shortpulse_generation_recovery_every_minute` exists and calls `/api/internal/generation-recovery/run`.
4. Verify `SHORTPULSE_FAL_RECONCILER_ENABLED=true` and `SHORTPULSE_FAL_RECONCILER_CRON_SECRET` is configured.
5. Decide whether runtime defaults are acceptable for long Kie video:
   - current max attempts default is 5;
   - running exhaustion min age default is 7200s;
   - no hard timeout by default.
6. If needed, plan an environment-only tuning change, but do not encode retry hacks in UI code.

Proof:

- Diagnostic outputs captured in closeout.
- No old eligible project-bound Kie rows remain unrecovered after a drain window.

### Batch 7: Bounded Production Data Repair Plan

Objective: repair already stranded rows without hiding a code defect behind one-off manual edits.

Steps:

1. Add a dry-run operator script or admin replay extension that lists candidate rows:
   - provider `kie%` or `fal%`;
   - request id present;
   - `failure_reason_code='user_abandoned'`;
   - project-bound by projection or project generation association;
   - no persisted output rows.
2. Dry-run reports request id, generation id, project id presence, status, recovery state, and suppression reason only.
3. Execute mode should call the canonical recovery engine, not write media/projection directly.
4. If provider returns success, recover through the canonical success path.
5. If provider returns failure, recover through the canonical failure path.
6. If provider still returns running or unavailable, requeue with a bounded next recovery time.

Proof:

- Script dry-run test with mocked Supabase/provider.
- Manual dry-run against production only after user approval.
- Execute against production only after user approval.

### Batch 8: End-To-End Validation Matrix

Objective: prove the architecture against the user-reported behaviors.

Scenarios:

1. Start Kie video generation, navigate to dashboard, return before completion: card still running and recoverable.
2. Start Kie video generation, close browser, return after provider success: media appears in project Reference Grid.
3. Start Kie video generation, change projects, return after provider success: media appears only in original project Reference Grid.
4. Start Kie video generation, provider fails while away: error reference appears in original project Reference Grid.
5. Explicitly delete a running card: provider job is not locally marked failed; on completion it is persisted and either remains suppressed or is available through the agreed durable surface.
6. Existing legacy `user_abandoned` success row: replay/reconcile can recover it when provider still has media.
7. Existing provider failure row: no success override occurs.

Proof:

- Targeted unit/API tests.
- `npm -C frontend run lint`
- `npm -C frontend run build`
- Production URL smoke after deployment when deployment is explicitly in scope.

## Stop Condition For Implementation

Stop implementation when all are true:

1. UI/session navigation cannot terminalize provider-accepted jobs.
2. Explicit Reference Grid removal no longer rewrites provider lifecycle truth.
3. Project reopen reconcile can recover paid provider success and provider failure outcomes.
4. Failed provider jobs produce error references when not explicitly suppressed.
5. Tests cover the lifecycle contract and project reopen path.
6. Docs/ADR/SOP describe the architecture and proof path.

Stop earlier if:

- provider cancellation becomes a required product decision;
- production repair requires direct data mutation or replay without user approval;
- scheduler proof requires credentials unavailable in the current environment;
- implementation would require a UI/UX change outside this approved scope.

## Autonomous Implementation Notes

Start with Batch 1 and Batch 2. Do not begin data repair before the lifecycle fix is merged locally and tested. Do not tune scheduler defaults until diagnostics prove scheduler timing is the bottleneck. Do not add a second background system unless the existing control plane is proven unavailable or structurally incapable after diagnostics.

The highest-ROI canonical fix is to remove terminal lifecycle authority from UI abandonment and then strengthen recovery/reconcile around that corrected lifecycle model.
