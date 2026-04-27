# AI Studio Session Persistence Rebuild Plan (Reference-Only, 2026-03-04)

Status: draft

## Purpose
Document a decision-complete rebuild plan for AI Studio session persistence that stores and restores only reference-grid and quick-slot state, while explicitly excluding workspace settings and agent/chat state.

This packet is documentation-only and intentionally pauses implementation.

## Current State Snapshot
1. Baseline branch for this packet: `second-foundational-overhaul`.
2. Session-persistence runtime was intentionally hard-disabled in prior stabilization work using local flags.
3. SQL hotfix `053_fix_ai_studio_session_upsert_ambiguity.sql` remains valid and should stay applied.
4. Existing `/api/ai/sessions*` routes and SQL RPCs remain in repo and are reusable.

## Problem Summary
The earlier broad session snapshot approach coupled too many surfaces (workspace/tool/model/panel/agent), causing noisy regressions and difficult rollback boundaries. We need a narrower contract that only persists reference artifacts relevant to creative continuity.

## Goals
1. Persist and restore only:
   - reference-grid outputs
   - quick-slot inventory (`curatedReferenceIds`)
   - all-refs suppression (`removedFromAllRefsIds`)
2. Keep AI Studio generation workflow behavior independent from session restore.
3. Eliminate settings/chat rehydration side effects.
4. Preserve existing backend route contracts unless a change is strictly required.

## Non-Goals
1. Persisting Create/Edit/Video property panel values.
2. Persisting `selectedTool`, `mode`, model selection, or other workspace preferences.
3. Persisting agent transcript/input/chat-mode state.
4. Session search/rename/delete UX expansion in this wave.

## Locked Decisions
1. Runtime strategy: recover from a full-off baseline and re-enable in narrow slices.
2. API strategy: keep `/api/ai/sessions*` route contracts unchanged.
3. DB strategy: no schema rollback; keep existing session RPC/table assets.
4. Restore strategy: hydrate reference projection only.
5. Durability strategy: non-durable references (no storage paths) are not guaranteed and must fail-soft.

## Target Contract

### Snapshot envelope
1. Keep session envelope saved through existing `save` API.
2. Move to `schemaVersion: 2` for reference-only writer payloads.
3. Reader remains backward-compatible with v1 snapshots.

### Reference-only payload (v2)
```json
{
  "schemaVersion": 2,
  "sessionId": "<sid>",
  "updatedAt": "<iso>",
  "outputs": {
    "active": [/* reference-safe output projection */],
    "archived": [/* reference-safe output projection */],
    "activeOutputId": "<id|null>",
    "curatedReferenceIds": ["..."],
    "removedFromAllRefsIds": ["..."]
  }
}
```

### Output projection fields retained
1. `id`
2. `mode`
3. `status`
4. `timestamp`
5. `prompt` (optional for labeling only)
6. `model` (optional for labeling only)
7. `previewUrl`
8. `previewStoragePath`
9. `fullStoragePath`
10. `hiddenInReferenceGrid`
11. `archivedAt`
12. `archiveReason`
13. `mediaSource`
14. `previewText` (for text cards)

## Implementation Slices

### Slice A: Read/Restore Only (No Writes)
1. Reintroduce `sid` identity and restore-candidate loading only.
2. Add a new state hydrator path that applies only output/reference projection.
3. Do not call workspace or agent hydration.
4. Keep session write shadow disabled.

Primary files:
1. `frontend/pages/ai-studio.tsx`
2. `frontend/features/ai-studio/hooks/useAiStudioState.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreCandidate.ts`
4. `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts` (if parser updates are required)

### Slice B: Reference-Only Writer
1. Add v2 reference-only snapshot builder.
2. Replace write-shadow payload source with reference-only builder.
3. Keep write cadence/debounce semantics unchanged.

Primary files:
1. `frontend/features/ai-studio/logic/sessionSnapshot.ts` (or split to a `sessionReferenceSnapshot.ts`)
2. `frontend/features/ai-studio/hooks/useAiStudioSessionWriteShadow.ts`
3. `frontend/pages/ai-studio.tsx`

### Slice C: Restore Safety + Telemetry
1. Sign storage-backed references at restore time.
2. Skip non-durable refs deterministically.
3. Emit stable diagnostics breadcrumbs for skip/failure paths.

Primary files:
1. `frontend/features/ai-studio/logic/sessionRestoreMediaSigning.ts`
2. `frontend/features/ai-studio/hooks/useAiStudioState.ts`
3. `docs/troubleshooting.md`

### Slice D: Session Selector Re-enable (Optional in this wave)
1. Re-enable sessions list/switch UX only after A-C are green.
2. Switch operation may save/load only reference projection.
3. Keep confirm-before-switch policy.

Primary files:
1. `frontend/features/ai-studio/components/AiStudioSessionsModal.tsx`
2. `frontend/features/ai-studio/hooks/useAiStudioSessionSwitcher.ts`
3. `frontend/features/ai-studio/components/AiStudioToolbar*.tsx`

## Risk Controls
1. Keep old runtime flags defaulted to off during A/B implementation.
2. Add one explicit reference-only apply gate before any write re-enable.
3. Preserve manual rollback: disable restore/write flags to return to hard-off state.
4. Keep branch-level checkpoints after each slice.

## Validation Gate
1. Targeted tests for session restore/write/state effects and toolbar/page integration.
2. `npm -C frontend run lint`
3. `npm -C frontend run build`
4. Manual QA checklist:
   - no model/tool/panel state mutation from restore
   - reference grid + quick-slot restore deterministic
   - generate flow unaffected in Create/Edit/Video
   - character panel interactions unaffected
   - no silent failures in console/network

## Acceptance Criteria
1. Previous session restore only affects reference-grid and quick-slot state.
2. No agent transcript/input restoration.
3. No property panel/default model overrides from session restore.
4. No regression in generation submit UX.
5. Session API errors are recoverable and visible.

## Rollback Strategy
1. Immediate rollback: set restore/write feature flags to false.
2. Keep session API disabled if needed while preserving local functionality.
3. Keep DB migration `053` and existing session RPCs intact.

## Dependencies
1. Existing session API helper layer (`frontend/lib/server/api/aiStudioSessions.ts`).
2. Existing restore-candidate loader (`sessionRestoreCandidate.ts`).
3. Existing output signing helper (`sessionRestoreMediaSigning.ts`).

## Open Follow-Ups (Post-Rebuild)
1. Optional search/rename/delete session UX.
2. Optional durable-local upload strategy for non-storage references.
3. Longer-term storage lifecycle/cleanup policy for session-only artifacts.
