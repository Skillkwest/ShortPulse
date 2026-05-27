# Copperknot May 27 Production Baseline Reset Audit

Purpose: establish a fresh repo-plus-worktree launch-control baseline after the heavy post-May-19 change wave on `production`.

## Audit Target

- Branch: `production`
- Commit anchor: `1d46e8473d366f1892a4a7f76d525427bf1ce35a`
- Worktree included: yes
- Evidence mix:
  - `production durable`
  - `repo durable`
  - `local follow-up`

## What Was Audited

- Copperknot launch-control surfaces
- AI Studio workflow, runtime, panel, and persistence cluster
- security and SQL grant posture
- current validation posture on the live branch/worktree

## Main Outcome

- The May 19 baseline refresh remains historically valid, but it is no longer current launch-control truth.
- The repo moved substantially between May 20 and May 27 across AI Studio shell/runtime, panel composition, persistence restore flows, and media handling.
- The current worktree also contains live frontend and SQL/security changes, so this pass had to treat the branch and the dirty tree as one mixed audit target.
- No broad score lifts are justified today.
- The old `Characters workflow -> Elements workflow` exact-next queue order is stale.
- The exact next launch-control need is current-state validation convergence on the live AI Studio/runtime surface before dispatching older queued handoffs.

## Fresh Repo And Worktree Facts

### Post-May-19 committed movement

Recent `production` commits materially changed the older queue basis:

- `95f974d23`, `d38698a78`, `f16c6cbd9`, `8cdfa5cff`, `2a1762eb1`, `8431eb112`
  - workspace restore, media rails, media-delete cleanup, motion intake, detail authority, and panel polish all moved again
- `01a156b73`, `7518ca1b7`, `812e8ba2c`, `365802159`, `33b95520f`
  - character-mode recovery, right-rail authority, AI Studio entrypoints, workspace save behavior, and character assignment all changed again
- `69c2a72a5`
  - signed-in issue report runtime landed
- `616e4069d`
  - secret-exposure cleanup and stronger security guardrails landed

### Active worktree movement now in scope

The dirty tree includes real repo-backed changes in the areas the failing tests touch:

- frontend motion/video recording UI:
  - `frontend/features/ai-studio/components/MotionRecorderModal.tsx`
  - `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/VoiceChangerSourceDropzone.tsx`
  - `frontend/features/ai-studio/components/AiStudioRecordPanelPrefab.tsx`
  - related tests and styles
- SQL/security grant hardening:
  - `sql/migrations/132_harden_public_data_api_default_privileges.sql`
  - `sql/migrations/133_restore_model_pricing_policy_function_grants.sql`
  - `docs/security-checklist.md`
  - `docs/sops/sop_sql_migration_operations.md`
  - `docs/database-migrations.md`

## Validation Evidence

### Passed

- `node scripts/check_secret_exposure.js`
- `npm -C frontend run build`

### Failed

Focused failing rerun:

- Command:
  - `cd frontend && npx vitest run features/ai-studio/components/__tests__/MotionRecorderModal.test.tsx tests/api/error-logging-coverage.test.ts tests/api/media-stage-voice-changer-source-route.test.ts features/ai-studio/hooks/__tests__/useAiStudioOutputCollectionState.test.ts tests/api/studio-agent.runtime.workflow-bypass.test.ts tests/api/media-stage-voice-clone-source-route.test.ts features/ai-studio/logic/__tests__/perfProfileFlags.test.ts features/ai-studio/components/style-creator/__tests__/internalDropResolver.test.ts lib/__tests__/agentPromptsConfig.test.ts`
- Result:
  - `8 failed / 26 total tests`
- Passing file inside the failing bundle:
  - `features/ai-studio/components/__tests__/MotionRecorderModal.test.tsx`
- Failing files:
  - `tests/api/error-logging-coverage.test.ts`
  - `tests/api/media-stage-voice-changer-source-route.test.ts`
  - `tests/api/media-stage-voice-clone-source-route.test.ts`
  - `features/ai-studio/hooks/__tests__/useAiStudioOutputCollectionState.test.ts`
  - `tests/api/studio-agent.runtime.workflow-bypass.test.ts`
  - `features/ai-studio/logic/__tests__/perfProfileFlags.test.ts`
  - `features/ai-studio/components/style-creator/__tests__/internalDropResolver.test.ts`
  - `lib/__tests__/agentPromptsConfig.test.ts`

### What The Failing Set Means

- This is not one flaky seam.
- The current branch/worktree is red across:
  - prompt-structure policy
  - telemetry instrumentation coverage
  - sanitized media-route failure behavior
  - output ordering compatibility
  - workflow bypass behavior
  - feature-flag default posture
  - internal media-drop fallback resolution

## Production Backtests That Matter

- `docs/records/artifacts/agent/holomony/reports/current/2026-05-21-approved-panel-runtime-check.md`
  - approved AI Studio and Elements media panels still classify as `6/10 fragile`
  - shared open-phase sign cost is still too high
  - Elements still has a visible missing-preview gap
- `docs/records/artifacts/agent/holomony/reports/current/2026-05-25-reference-grid-production-baseline.md`
  - production baseline says `Reference Grid` currently has `no clear blocker`
- `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-05-23-prod-storage-state-exposure.md`
  - historical production storage-state exposure was real
  - repo guardrails improved
  - hosted session cleanup and history-purge judgment still remain open outside the local code path

## Score Decisions

- `Create workflow`
  - keep `6/10`
  - reason: the branch has moved heavily and the exact next need is now validation convergence, but the current evidence does not earn a score lift
- `Elements workflow`
  - keep `5/10`
  - reason: Holomony still shows an approved-panel runtime gap on production
- `Project / workspace persistence`
  - keep `6/10`
  - reason: substantial repo hardening landed, but the branch still needs cleaner proof on current restore/save trust
- `Characters workflow`
  - keep `5/10`
  - reason: the old queue basis is stale, but the newer repo movement has not yet been rerated into a score change
- `Media delivery / signing / preview resolution`
  - keep `6/10`
  - reason: still at floor, but not healthy enough to disappear from the active follow-up picture
- `Reference Grid`
  - keep `7/10`
  - reason: the May 25 production baseline explicitly does not support reopening it as a blocker lane
- `Security boundaries`
  - keep `7/10`
  - reason: repo guardrails are stronger, but hosted follow-through remains open and should be tracked operationally rather than hidden

## Queue Correction

The exact next lane is now:

- `Create workflow`
  - lane: `AI Studio validation convergence`

Why:

- the current branch/worktree has a confirmed red validation set
- multiple failures now sit closer to active AI Studio/runtime authority than the older Characters-first queue assumed
- dispatching older workflow handoffs first would ignore fresher, higher-ROI repo truth

After that:

1. `Elements workflow`
2. `Project / workspace persistence`
3. `Characters workflow`

## Control-Surface Corrections Made

- replaced the May 19 queue as the live exact-next source
- superseded the May 19 operator brief and launch checklist with May 27 versions
- refreshed the operating package snapshot
- refreshed the dispatch log so it no longer treats `Characters workflow` as the unquestioned next lane
- refreshed Copperknot health metrics to reflect the new backtests and the current validation red state

## What Stayed Stable

- `Reference Grid` should stay closed as a blocker lane
- `Billing / credits`, `Security boundaries`, and `Generation submission / polling` still remain at floor
- `Generation recovery / settlement` remains reviewed complete but not rerated up
- the launch target window still points at `2026-07-02`, but the date only remains credible if the new validation-first queue is honored

## Recommended Next Step

Do not paste the May 19 `Characters workflow` handoff first.

Use the updated queue and operator brief to treat the current AI Studio/runtime validation red state as the exact next launch-control problem.
