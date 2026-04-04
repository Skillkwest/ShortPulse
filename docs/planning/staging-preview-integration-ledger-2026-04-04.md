# Staging Preview Integration Ledger (2026-04-04)

Purpose: working checkpoint for the current `staging-preview` consolidation effort. This document records what has landed from `origin/codex/full-unified-layers`, which local commits were created to stabilize that work on `staging-preview`, which rollback anchors still matter, and what remains intentionally deferred.

## Current Status

- Active integration target: `staging-preview`
- Non-target branch for this lane: `main`
- Primary source branch being consolidated: `origin/codex/full-unified-layers`
- Current local checkpoint: `8e165e899`
- Last pushed remote checkpoint: `a4264f072`
- Local/remote delta: docs-only planning update for the next runtime lane
- Whole-branch merge status: attempted once, then rolled back after broad `type-check` failure
- Active strategy: lane-based integration with validation after each lane

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

## Local Stabilization Commits

These commits were created locally because the imported runtime work was not fully self-contained on `staging-preview`:

| Commit | Purpose |
| --- | --- |
| `f88eeb777` | Align lane-1 control plane integration |
| `1a34b7190` | Stabilize lifecycle-first polling bridge |
| `19034b0b7` | Persist source refs for queued output resume |
| `57d15acf4` | Align not-found recovery lane tests |
| `4c2f7fa4f` | Backport handoff timing polling options |

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

Note:

- `8577b81ef` and `4875e3e0b` should not be treated as still-pending raw source commits
- their behavior is already captured by the landed runtime lane plus the local stabilization commits listed above

## Source Work Partially Subsumed

The following source commit should not be planned as a standalone remaining lane:

- `476cd804e`

Reason:

- the relevant handoff-timing behavior is already present locally through:
  - `ef78440cf`
  - `4c2f7fa4f`
- its remaining source delta mostly reflects the newer `useAiStudioTasks` API shape from the source branch, not missing product behavior on current local `staging-preview`

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

## Remaining Work

### Next runtime lane

Current recommendation:

1. create a fresh rollback anchor from current `staging-preview`
2. land `d5375d247` first
3. land `eb64b561c` second if the first commit validates cleanly
4. validate focused recovery/runtime tests, then `npm run type-check`, then `npm run build`
5. update this ledger only after that lane is stable

Recommended lane definition:

| Commit | Status | Notes |
| --- | --- | --- |
| `d5375d247` | next candidate | hardens recovery publication sync against stale output rereads; touches `generationOutputs`, `recoveryExecution`, and recovery tests |
| `eb64b561c` | follow-on candidate | backfills convergence for already persisted recovery; builds directly on the same recovery execution surface |

Decision note:

- this lane is smaller and cleaner than the remaining UI redesign work
- it avoids dragging in skill deletions, broad design-doc churn, and properties-panel surface changes
- the two commits are tightly related and form the best next server/runtime slice from the current branch state

### Deferred runtime/docs operator tail

Still intentionally deferred after the convergence hardening lane:

- `d636d295b`
- `c34ef729c`
- `a18c800c1`
- `ceccd6e07`
- `0b2933dd4`

Reason:

- these commits are useful, but they are primarily diagnostics, SQL checks, scripts, and operator/docs tooling
- they should not lead the next product-code lane while recovery publication hardening is still pending

### Deferred UI/properties lane

Still intentionally deferred:

- `751df4cf3`
- `2954e8e78`
- `b3a62c47b`
- `414d4d74f`
- `cece1993f`
- `b55a631a2`
- `a57630d0b`

Reason:

- these commits are broader UI/property-surface redesign work
- they are not required to keep the runtime lane coherent

### Docs/evidence tail

- evidence/program closeout docs remain last
- do not treat docs/evidence commits as runtime blockers unless they are required for parity or governance gates

## Update Rules

When this ledger changes:

1. update the stable checkpoint SHA if a new lane has fully passed validation
2. move newly landed source commits out of the remaining-work section
3. record any local stabilization commit that was required to make source work coherent on `staging-preview`
4. do not mark a source commit as absorbed unless its behavior is actually present locally and validated
