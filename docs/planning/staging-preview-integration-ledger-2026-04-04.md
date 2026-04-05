# Staging Preview Integration Ledger (2026-04-04)

Purpose: working checkpoint for the current `staging-preview` consolidation effort. This document records what has landed from `origin/codex/full-unified-layers`, which local commits were created to stabilize that work on `staging-preview`, which rollback anchors still matter, and what remains intentionally deferred.

## Current Status

- Active integration target: `staging-preview`
- Non-target branch for this lane: `main`
- Primary source branch being consolidated: `origin/codex/full-unified-layers`
- Current stable code checkpoint: `4b1af481e`
- Last pushed remote checkpoint: `4b1af481e`
- Local/remote delta: runtime lane in progress after the done-state closeout checkpoint
- Whole-branch merge status: attempted once, then rolled back after broad `type-check` failure
- Active strategy: lane-based integration with validation after each lane

## Integration Done-State Contract

The `staging-preview` consolidation can be called complete only when the fixed comparison set for this effort, `origin/codex/full-unified-layers`, satisfies all of the following:

1. every relevant source commit or remaining source-diff bucket has exactly one disposition:
   - `absorbed`
   - `superseded`
   - `excluded`
   - `rejected`
2. every `absorbed` item is mapped to local `staging-preview` commit(s) and validated on the target branch
3. no relevant product/runtime diff remains uncategorized
4. any remaining raw diff against the source branch is non-relevant only and explicitly documented as `excluded` or `rejected`
5. `staging-preview` is pushed, clean, and backed by the recorded rollback refs/checkpoints

Disposition definitions:

- `absorbed`: the source behavior is present locally on `staging-preview`
- `superseded`: the source commit is no longer needed because equivalent or better local behavior already landed through a different lane
- `excluded`: the remaining source delta is intentionally outside this integration target, such as docs, evidence, design collateral, or mixed non-product payloads we are not bringing over wholesale
- `rejected`: the source delta was evaluated and intentionally not landed because it regresses current branch behavior, widens scope incorrectly, or conflicts with the chosen local contract

## Reconciliation Status

Comparison set:

- fixed source branch: `origin/codex/full-unified-layers`
- tracker status: `in_progress`
- closeout status: `not done`

Current blocking condition:

- relevant source work still remains, but it is now small enough to track as explicit branch-truth buckets instead of raw source commit names

Current relevant uncategorized buckets:

- `RT-1A` queue/sourceRef and polling-authority alignment
  - status: `absorbed locally`
  - target surface: `frontend/features/ai-studio/hooks/taskSubmission/outputLifecyclePatches.ts`, `frontend/features/ai-studio/hooks/taskSubmission/queueStatusPolling.ts`, `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`, `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`, related hook tests
  - why relevant: queued `sourceRef` carry-through, dispatch-handoff initial delay parity, and server-lifecycle-first polling authority are product/runtime behavior and are now validated locally on `staging-preview`
- `RT-1B` advanced KIE Kling payload parity
  - status: `remaining`
  - target surface: `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`, `frontend/features/ai-studio/hooks/taskSubmission/videoPayloads.ts`, plus `frontend/lib/model-runtime/modelCatalog.ts`, `frontend/lib/server/providerIntegration/kieModelContracts.ts`, and related contract tests if full multi-shot/element parity is still desired
  - why relevant: the remaining source delta is specifically the multi-shot/element KIE Kling contract expansion, which is no longer a hook-only slice on current branch truth
- `VP-1` reference-video and Kling advanced-panel follow-on
  - status: `remaining`
  - target surface: `frontend/features/ai-studio/components/ReferenceKlingAdvancedSteps.tsx`, `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`, `frontend/features/ai-studio/components/useReferencePropertiesDerivedState.ts`, related tests
  - why relevant: panel copy, control visibility, and KIE/Kling workspace affordances remain different from the source branch
- `SA-1` small safety/authority cleanup lane
  - status: `remaining`
  - target surface: `frontend/features/ai-studio/components/style-creator/styleSourceNormalization.ts`, `frontend/features/ai-studio/logic/referenceDownload.ts`, `frontend/features/ai-studio/logic/staleOutputCleanup.ts`, related tests
  - why relevant: these are still product/runtime correctness deltas, but they are independent from the panel redesign surface

Current excluded remainder:

- docs, ADRs, evidence packets, design specs, and change-log collateral that are not required to prove product/runtime parity on `staging-preview`
- mixed source commits whose remaining raw diff is mostly docs, `skills/`, or planning material and should not be merged by source commit name alone

Current rejected remainder:

- `044b9d82f`
- `33741df86`

Reason:

- these were evaluated on current `staging-preview` and intentionally not landed because they move persisted-success handling from recovery-pending to completed, which is not the chosen local runtime contract

## Stable Checkpoints

| Checkpoint | Meaning |
| --- | --- |
| `543c36442` | Pre-`codex/full-unified-layers` integration baseline on `staging-preview` |
| `f88eeb777` | Lane 1 foundation stabilized |
| `1a34b7190` | Lane 2 lifecycle-first polling bridge stabilized |
| `a0f7bec48` | Restore/resume core stabilized |
| `57d15acf4` | Queued `not_found` alignment stabilized |
| `4c2f7fa4f` | Handoff timing compatibility backport stabilized |
| `991bc5587` | Status-poll concurrency lane stabilized |
| `d9488839f` | Unresolved task-backed polling resume stabilized |
| `a4264f072` | Ledger refreshed and pushed checkpoint established |
| `00dcbe7a8` | Convergence hardening lane stabilized locally |
| `b1e86f1b8` | Video properties lane stabilized locally |
| `7c83fae98` | Shared sound/TTS properties lane stabilized locally |
| `abe07804c` | Reference/media-authority lane stabilized locally |
| `861d3ac0d` | Modal/runtime trim lane stabilized locally |
| `61a444825` | Recovery visibility/convergence lane stabilized locally |
| `504e4a723` | Diagnostics/operator tooling lane stabilized locally |
| `c2eda59e7` | UI properties extraction plan checkpoint established |
| `8f231fa01` | UI-1 checkpoint docs and sourceRef coverage refreshed |

## Landed Lanes

### Lane 1: generation/runtime/control-plane foundation

Representative landed commits:

- `a46984835` Collapse queued post-submit dispatch into RPC
- `f88eeb777` Align lane-1 control plane integration

Checkpoint result:

- control-plane/runtime foundation is stable on `staging-preview`
- targeted runtime suite passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 2: lifecycle-first polling bridge

Representative landed commits:

- `185e8018c` Remove raw polling failure authority
- `bc7793899` Isolate legacy polling success fallback
- `6b529d0a4` Shift queue resume provider authority to server
- `7ea0ce36f` Trust normalized lifecycle status in AI Studio polling
- `d722a6c12` Trust nonterminal lifecycle hints over transient poll errors
- `1a34b7190` Stabilize lifecycle-first polling bridge

Checkpoint result:

- lifecycle/status authority moved toward server-authored hints
- focused tests passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 3: restore/resume runtime lane

Representative landed commits:

- `768c32a86` Normalize restored queue lifecycle posture
- `19034b0b7` Persist source refs for queued output resume
- `6ecf22aa4` Run restore queue resume immediately on hydration
- `77924891e` Share queue status contract in resume watchdog
- `f7456a62e` Reduce restore-time queue resume browser authority
- `a0f7bec48` Trust lifecycle-first recovery status polling
- `514f9764d` Align queued not_found recovery policy
- `57d15acf4` Align not-found recovery lane tests

Checkpoint result:

- restore/resume path is stable
- queued `not_found` escalation moved to shared policy
- focused tests passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 4: resumed handoff timing

Representative landed commits:

- `ef78440cf` Speed up resumed queued polling handoff
- `4c2f7fa4f` Backport handoff timing polling options

Checkpoint result:

- resumed queue handoff timing is stable on `staging-preview`
- source commit required a narrow `useAiStudioTasks` API compatibility backport
- focused tests passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 5: status-poll concurrency

Representative landed commits:

- `991bc5587` Raise AI Studio status poll concurrency

Checkpoint result:

- concurrent status polling budget increased on `staging-preview`
- focused tests passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 6: unresolved task-backed polling resume

Representative landed commits:

- `d9488839f` Resume unresolved task-backed AI Studio polling

Checkpoint result:

- unresolved task-backed outputs now resume polling when no active timer exists
- queue resume and stuck-spinner retry behavior were preserved during integration
- focused tests passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 7: convergence hardening

Representative landed commits:

- `a66dbe9f0` Harden recovery publication sync against stale output rereads
- `cebee9a23` Backfill convergence for already persisted recovery
- `00dcbe7a8` Align convergence hardening projection sync

Checkpoint result:

- recovery publication sync now tolerates stale output rereads
- already persisted recovery convergence is backfilled on the same runtime surface
- source commits required one local projection-sync contract bridge on current `staging-preview`
- focused recovery tests passed
- `npm run docs:check` passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 8: video properties redesign

Representative landed commits:

- `b1cd34ee1` Redesign AI Studio video properties panel
- `7a8c7bcc6` Polish video properties panel controls
- `60972d1e2` Polish video properties panel layout
- `3c8022f52` Refine video properties panel layout
- `0d4a226c8` Refine video panel toggle sizing
- `b1e86f1b8` Stabilize video properties lane integration

Checkpoint result:

- video-only properties redesign is stable on `staging-preview`
- source lane required a narrow local compatibility pass for current panel/test contracts
- focused video/panel suite passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 9: shared sound and TTS properties

Representative landed commits:

- `7c83fae98` Add shared sound and TTS properties panels

Checkpoint result:

- sound workflow now opens nested sound child tools instead of a placeholder panel
- shared sound inspector and dedicated text-to-speech inspector are stable on `staging-preview`
- source lane was integrated as frontend product code only, intentionally excluding docs payload and skill deletions
- focused toolbar/panel/routing suite passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 10: reference/media authority

Representative landed commits:

- `2b1ab9df2` Prefer generation publications for internal reference media
- `9d8cbd08f` Prefer generation publications for reference downloads
- `8406f227a` Recover generation ids from request-backed save state
- `a73cbb641` Consolidate generated media authority lookups
- `e85bb54b5` Recover download authority from request-backed generation state
- `8727591e0` Prefer publication-owned media for generated save reuse
- `abe07804c` Stabilize reference media authority lane

Checkpoint result:

- generated reference downloads and save reuse now prefer publication-owned or request-backed authority before older fallbacks
- the source lane stayed in frontend product code and tests only
- a narrow local stabilization pass was required to restore a missing download helper and align one test input with current `StudioOutput` typing
- focused persistence/reference suite passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 11: modal/runtime trim

Representative landed commits:

- `f73eda26b` Trim inactive AI Studio edit and detail modal runtime
- `fc2e10fca` Trim inactive AI Studio modal and shell resize runtime
- `fab84f1b2` Trim redundant AgentInputBar resize listeners
- `861d3ac0d` Stabilize modal runtime trim lane

Checkpoint result:

- inactive AI Studio modal/edit runtime is trimmed behind current active surfaces
- shell resize listeners and shared agent input resize listeners are reduced without changing current product behavior
- the source lane stayed in frontend product code and tests only
- a narrow local stabilization pass was required to satisfy strict DOM nullability in one existing expert-edit test
- focused modal/resize suite passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 12: recovery visibility and convergence

Representative landed commits:

- `61a444825` Improve recovery visibility and convergence

Checkpoint result:

- background recovery no-media polling now retries more aggressively on current `staging-preview`
- status/result probing and recovery media persistence now perform their provider work concurrently while preserving current ordering guarantees
- recovery execution now emits the newer visibility/convergence runtime behavior without importing the unrelated frontend collateral from the source lane
- focused recovery-visibility suite passed
- `npm run type-check` passed
- `npm run build` passed

### Lane 13: diagnostics and operator tooling

Representative landed commits:

- `46b104571` Add recovery visibility diagnostics
- `1af955f7d` Include recovery visibility in diagnostics runner
- `704e0a753` Add recovery visibility diagnostics guardrails
- `c7bbe9822` Add Phase 3A convergence defect diagnostics
- `504e4a723` Add bounded convergence backlog replay tool

Checkpoint result:

- recovery visibility diagnostics now include canonical SQL checks, runner wiring, and a focused regression test
- convergence defect classification and bounded backlog replay tooling are now present in scripts, SQL, and operator runbooks
- the lane stayed additive and operator-facing, with no product-runtime code changes
- focused diagnostics suite passed
- `npm run type-check` passed
- `npm run build` passed
- `npm run docs:check` passed

## Local Stabilization Commits

These commits were created locally because the imported runtime work was not fully self-contained on `staging-preview`:

| Commit | Purpose |
| --- | --- |
| `f88eeb777` | Align lane-1 control plane integration |
| `1a34b7190` | Stabilize lifecycle-first polling bridge |
| `19034b0b7` | Persist source refs for queued output resume |
| `57d15acf4` | Align not-found recovery lane tests |
| `4c2f7fa4f` | Backport handoff timing polling options |
| `00dcbe7a8` | Align convergence hardening projection sync |
| `b1e86f1b8` | Stabilize video properties lane integration |
| `abe07804c` | Stabilize reference media authority lane |
| `861d3ac0d` | Stabilize modal runtime trim lane |

## Source Commits Already Represented Locally

These source commits from `origin/codex/full-unified-layers` are already represented on local `staging-preview`, either directly or by stable local equivalents:

- `45c187bc6`
- `10e2c745b`
- `04f54ea2f`
- `3f380e0ea`
- `bae14076e`
- `b8383723c`
- `8577b81ef`
- `4875e3e0b`
- `d68559372`
- `0ee7762e1`
- `d5375d247`
- `eb64b561c`
- `751df4cf3`
- `2954e8e78`
- `b3a62c47b`
- `414d4d74f`
- `cece1993f`
- `7d4d483c7`
- `f90c73062`
- `d636d295b`
- `c34ef729c`
- `a18c800c1`
- `ceccd6e07`
- `0b2933dd4`
- `734ba6ba5`
- `01e97c71f`
- `955003e76`
- `08a953a93`
- `40bc83637`
- `e1b34eec4`
- `bc1e68fe8`
- `64204a43f`
- `d18bdcda3`

Note:

- `8577b81ef` and `4875e3e0b` should not be treated as still-pending raw source commits
- their behavior is already captured by the landed runtime lane plus the local stabilization commits listed above

## Source Work Partially Subsumed

The following source commit should not be planned as a standalone remaining lane:

- `476cd804e`
- `b55a631a2`
- `a57630d0b`
- `044b9d82f`
- `33741df86`

Reason:

- the relevant handoff-timing behavior is already present locally through:
  - `ef78440cf`
  - `4c2f7fa4f`
- its remaining source delta mostly reflects the newer `useAiStudioTasks` API shape from the source branch, not missing product behavior on current local `staging-preview`
- `b55a631a2` now has its frontend product-code subset represented locally through `7c83fae98`; remaining source delta is docs/skill collateral that should not be merged blindly
- `a57630d0b` is no longer a UI lane candidate; its UI cleanup is already represented locally, while its runtime/doc collateral should be evaluated separately
- `044b9d82f` and `33741df86` were evaluated on current `staging-preview` and rejected as a direct lane because they flip persisted-success behavior from recovery-pending to completed

## Rollback Anchors

Still-useful local safety refs:

- `refs/keep/main-pre-staging-integration`
- `refs/keep/staging-preview-pre-followon-integration`
- `refs/keep/staging-preview-pre-full-unified-layers`
- `refs/keep/staging-preview-pre-lane1-foundation`
- `refs/keep/staging-preview-pre-lane2-status-bridge`
- `refs/keep/staging-preview-post-lane2-stable`
- `refs/keep/staging-preview-pre-restore-resume-lane`
- `refs/keep/staging-preview-post-restore-resume-core`
- `refs/keep/staging-preview-post-not-found-alignment`
- `refs/keep/staging-preview-pre-status-poll-concurrency`
- `refs/keep/staging-preview-post-status-poll-concurrency`
- `refs/keep/staging-preview-post-unresolved-task-polling`
- `refs/keep/staging-preview-pre-video-properties-lane`
- `refs/keep/staging-preview-pre-shared-properties-lane`
- `refs/keep/staging-preview-pre-reference-media-authority-lane`
- `refs/keep/staging-preview-pre-status-authority-cleanup-lane`
- `refs/keep/staging-preview-pre-modal-runtime-trim-lane`
- `refs/keep/staging-preview-pre-recovery-visibility-lane`
- `refs/keep/staging-preview-pre-diagnostics-operator-lane`
- `refs/keep/staging-preview-pre-ui1-product-extraction`
- `refs/keep/staging-preview-pre-rt1-video-runtime-lane`

## Remaining Work

### Next product-code decision

Current recommendation:

1. close and push the validated RT-1A runtime lane
2. decide whether the remaining relevant delta should continue as `RT-1B`, `VP-1`, or `SA-1`
3. only reopen KIE Kling payload parity work if the server contract files are intentionally admitted to scope

Decision note:

- the recovery visibility/convergence lane is complete
- the diagnostics/operator lane is complete
- current branch audit still shows the old UI-1 routing/session-hydration posture is largely present locally
- the bounded hook/runtime slice of RT-1 is now locally validated:
  - queued `sourceRef` survives the queued submission patch path
  - direct dispatches use the same handoff-delay polling contract as resumed queue handoffs
  - task polling now trusts lifecycle-authored success/failure authority and hands raw terminal states back to server recovery instead of forcing local success
  - KIE Kling standard submits now carry the contract-safe `mode`, `sound`, and `multi_shots` fields already supported by current `staging-preview`
- the remaining KIE Kling multi-shot/element parity is not a hook-only change on current branch truth; it requires submit-contract/model-catalog files and should be tracked as `RT-1B` instead of being pulled in by momentum

### Deferred UI/docs collateral remainder

Still intentionally deferred:

- `a57630d0b`
- `b55a631a2`

Reason:

- both commits still mix product code with docs and `skills/` collateral
- any remaining UI or runtime value should be extracted from current branch truth, not merged by source commit name

### Docs/evidence tail

- evidence/program closeout docs remain last
- do not treat docs/evidence commits as runtime blockers unless they are required for parity or governance gates

## Update Rules

When this ledger changes:

1. update the stable checkpoint SHA if a new lane has fully passed validation
2. move newly landed source commits out of the remaining-work section
3. record any local stabilization commit that was required to make source work coherent on `staging-preview`
4. do not mark a source commit as absorbed unless its behavior is actually present locally and validated
