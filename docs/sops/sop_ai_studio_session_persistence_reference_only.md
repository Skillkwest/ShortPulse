# SOP: AI Studio Session Persistence (Reference-Only)

## Scope
Operational runbook for rebuilding and validating AI Studio session persistence in reference-only mode.

This SOP governs staged rollout, validation, and rollback of the reference-only session feature.

## Prerequisites
1. Baseline hard-off checkpoint is validated.
2. SQL hotfix `053_fix_ai_studio_session_upsert_ambiguity.sql` remains applied.
3. Branch-level checkpoints are available before each slice.

## Runtime Flags
Use existing flags during staged re-enable:
1. `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED`
2. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED`
3. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED`
4. `NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED`
5. `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED`

Recommended rollout posture:
1. Slice A (restore-only): enable API + restore flags, keep write flags off.
2. Slice B (write): enable write flags after Slice A passes.
3. Slice C/D: enable switcher/session selector only after A/B/C validation.

## Workflow

### Phase 1: Restore-Only Enablement
1. Enable:
   - API route flag,
   - restore candidate/apply flags.
2. Keep write flags off.
3. Verify that restore only hydrates reference outputs + quick-slot projection.
4. Confirm no workspace/model/tool/agent state mutation.

### Phase 2: Reference-Only Write Enablement
1. Enable write-shadow + remote-shadow flags.
2. Confirm writer payload excludes workspace and agent state.
3. Validate save/read round trip on same `sid`.

### Phase 3: Durable Media Restore Hardening
1. Validate signed URL refresh for storage-backed outputs.
2. Validate skip behavior for non-durable references (no crash, diagnostic breadcrumb).
3. Confirm no stale async re-apply overwrites current user edits.

### Phase 4: Optional Session Selector Re-enable
1. Re-enable sessions selector only after prior phases pass.
2. Ensure switch flow only loads reference projection.
3. Confirm no panel/model/chat rehydration side effects.

## Validation Matrix
1. Targeted tests for restore/write/session state hooks.
2. `npm -C frontend run lint`
3. `npm -C frontend run build`
4. Manual smoke:
   - generate flow unaffected,
   - model defaults/filtering stable,
   - character panel interactions stable,
   - reference restore deterministic.

## Error Handling
1. If restore mutates non-reference state:
   - disable restore apply flags immediately,
   - capture `sid` + console/network traces,
   - revert last slice commit.
2. If write path causes regressions:
   - disable write flags,
   - keep restore-only active if stable.
3. If session API errors recur:
   - disable API flag and return to hard-off baseline.

## Rollback
Immediate rollback path:
1. `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED=false`
2. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_SHADOW_ENABLED=false`
3. `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED=false`
4. `NEXT_PUBLIC_AI_STUDIO_SESSION_WRITE_SHADOW_ENABLED=false`
5. `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=false`

Then:
1. Restart frontend dev server.
2. Re-run lint/build.
3. Execute baseline manual smoke.

## Maintenance
1. Keep this SOP aligned with:
   - `docs/planning/ai-studio-session-persistence-reference-only-plan-2026-03-04.md`
   - `docs/planning/ai-studio-session-persistence-reference-only-tracker-2026-03-04.md`
   - `docs/adr/0029-ai-studio-reference-only-session-persistence.md`
2. Record notable rollout/rollback events in `docs/change_log.md`.
