# Copperknot May 30 Post-Redeploy Baseline Refresh

Purpose: re-freeze Copperknot launch-control truth after the latest AI Studio/media-authority commit and fresh production redeploy.

## Audit Target

- Branch: `production`
- Commit anchor: `ba7daff0f2fccfc1d653c101fab8e8010276d25f`
- Worktree included: yes
- Product-code worktree drift: none
- Remaining dirty files:
  - `docs/agents/gear-ball/README.md`
  - `docs/agents/gear-ball/hot-path-checklist.md`
  - `docs/agents/gear-ball/memory.md`
  - `docs/agents/gear-ball/runtime-load-policy.md`
  - `docs/records/artifacts/agent/gear-ball/training-history.md`
- Evidence mix:
  - `production durable`
  - `repo durable`
  - `local follow-up`

## What Was Audited

- Copperknot launch-control surfaces
- the latest deployed AI Studio/media-authority change set
- current queue and score posture for the AI Studio workflow cluster
- post-redeploy validation on the production alias

## Main Outcome

- The May 27 baseline reset and May 28 Create acceptance remain historically valid, but they are no longer the freshest possible control packet after commit `755fec94b`.
- The latest committed movement materially touched Create/runtime prompt surfaces, generated media authority, detail rendering, reference-card rendering, and project workspace support seams.
- Current proof is stronger than the May 27 red-state picture:
  - `npm -C frontend run build` passed
  - a targeted AI Studio/media-authority validation bundle passed at `18 files / 385 tests`
  - `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed after redeploy
- No queue reorder is justified from the May 30 proof.
- No score lift is justified from the May 30 proof.
- The exact next lane remains `Elements workflow`.

## Fresh Repo Facts

### Latest committed movement

- `755fec94b`
  - hardened generated media authority and prompt surface behavior across:
    - `frontend/features/ai-studio/components/DetailModal.tsx`
    - `frontend/features/ai-studio/components/promptStep/*`
    - `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
    - `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
    - `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`
    - `frontend/lib/server/projectWorkspaceStatesService.ts`
    - `frontend/pages/api/openai/image-generate.ts`
    - `frontend/pages/api/openai/image-edit.ts`
    - related tests and styles
- `ba7daff0f`
  - recorded Gear Ball score-loop evidence only

### Current worktree drift

- current uncommitted drift is limited to Gear Ball docs
- there is no active product-code worktree contradiction that should reopen the May 27 validation-red queue correction

## Validation Evidence

### Repo/local validation

- `npm -C frontend run build`
  - passed
- `npm -C frontend run test -- --run features/agent-runtime/__tests__/studioAgentPulseRuntime.test.ts features/ai-studio/components/__tests__/DetailModal.test.tsx features/ai-studio/components/__tests__/MediaLibraryPanelPreviewModal.test.tsx features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx features/ai-studio/components/create/__tests__/StandardCreatePropertiesPanel.single-mode.test.tsx features/ai-studio/hooks/__tests__/useAiStudioGeneratedOutputMaintenance.test.tsx features/ai-studio/hooks/__tests__/useAiStudioPageMediaReferenceRuntime.test.ts features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts features/ai-studio/hooks/__tests__/useMediaVideoBrowsePreviewUrls.test.ts features/ai-studio/hooks/taskSubmission/__tests__/seedreamSubmission.test.ts features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts features/ai-studio/logic/__tests__/projectWorkspaceApiClient.test.ts features/ai-studio/logic/__tests__/sessionSnapshot.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridCardRenderController.test.tsx lib/__tests__/agentPromptsConfig.test.ts lib/server/__tests__/projectWorkspaceStatesService.test.ts`
  - passed
  - result: `18 passed test files`, `385 passed / 385 total tests`
  - note: existing React `act(...)` warnings and jsdom media-method warnings appeared, but no test failed

### Production durable validation

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
  - passed
  - resolved deployment:
    - `https://shortpulse-qmm9isfp9-kirk-artmans-projects.vercel.app`
  - required internal routes verified:
    - `/api/internal/admin-user-health-fleet/run`
    - `/api/internal/generation-recovery/run`
    - `/api/internal/media-derivatives/run`

## Score Posture

- `Create workflow`
  - keep `6/10`
  - reason: the new AI Studio/media-authority commit materially improved validation confidence, but the proof still does not establish broader production maturity for the whole workflow
- `Elements workflow`
  - keep `5/10`
  - reason: the bounded Elements persistence closeout is real repo evidence, but Holomony's production approved-panel/runtime fragility still leaves the broader lane below floor
- `Project / workspace persistence`
  - keep `6/10`
  - reason: project/media/runtime support seams were touched again and validated cleanly, but the row still lacks enough broader production-trust proof to move above floor
- `Media delivery / signing / preview resolution`
  - keep `6/10`
  - reason: generated-media authority and detail/rendering seams hardened again, but the proof is still more trust-strengthening than maturity-lifting
- `Reference Grid`
  - keep `7/10`
  - reason: the latest reference-card rendering changes and targeted tests do not reopen the blocker class, and the May 25 production baseline still says `no clear blocker`

## Queue Decision

The exact next lane remains:

1. `Elements workflow`
2. `Project / workspace persistence`
3. `Characters workflow`

Why:

- the post-redeploy AI Studio/media-authority work validated green instead of reopening `Create workflow`
- the current product-code worktree no longer carries the active May 27 red-state drift
- Holomony's approved-panel/runtime production fragility still gives `Elements workflow` the highest remaining ROI

## Elements Lane Review Note

- A bounded closeout exists at:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-28-elements-workflow-hardening-closeout.md`
- Copperknot accepts that closeout as real repo-durable evidence for the Elements persistence seam.
- Copperknot does not treat that closeout as sufficient to clear the broader `Elements workflow` lane.
- The lane stays exact next because the production fragility signal is still wider than that one persistence patch.

## Control-Surface Corrections Made

- refreshed the queue snapshot to remove stale May 27 dirty-worktree framing
- refreshed the dispatch log to include the Elements closeout review status and May 30 post-redeploy refresh
- refreshed the scoreboard, checklist, operator brief, and retained measurement logs
- corrected the stale `P0 systems below floor` undercount in the previous May 28 checklist

## Recommended Next Step

Copperknot should stop at `dispatch-ready`:

- exact next lane: `Elements workflow`
- reason: still the highest-ROI below-floor lane after the post-redeploy green validation pass
- required user checkpoint: explicit approval before any execution dispatch
