# Generation Pipeline Continuation: Client Demotion (2026-04-05)

Last updated: 2026-04-05  
Status: active
Parent plan: `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`
Tracker index: `docs/planning/generation-pipeline-continuation-tracker-2026-04-05.md`

## Purpose
This subplan removes lifecycle ownership from the client and leaves the client as an optimistic observer.

## Scope
In scope:
1. polling removal or demotion
2. timeout adjudication removal
3. background recovery timer removal
4. stale-output cleanup that invents failure state
5. client output-store composition and derivation layers
6. Reference Grid loading heuristics that infer state from absence

Out of scope:
1. server authority cutover
2. compatibility fallback deletion that depends on server cutover
3. Reference Grid canonical read-model simplification work that belongs to the grid bucket

## Keep
These surfaces stay in place and should be tightened, not removed:
1. `frontend/features/ai-studio/hooks/useAiStudioState.ts`
2. `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`
4. `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts`

## Execution Rows
| Row ID | Work Item | Authority Claim | Keep / Cut | User-visible Outcome | Deletion Trigger | Before / After | Entry Gate | Exit Gate | Targeted Validation | Full Gates | Rollback Note | Evidence Link | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CD-01` | Lock client demotion contract | client lifecycle truth must be removed without deleting shared composition helpers that are still useful | keep + temporary keep + remove classification | less drift between client/server state and less cleanup churn | active hooks and grid seams are classified as observer-only, remove, or temporary keep in the plan | Before: lifecycle ownership is still split across hooks and timers. After: the client is observational only. | Master plan published; server authority cutover stable enough to sequence demotion | Client surfaces are classified as observer-only or removable | docs review; hook inventory check | `npm -C frontend run docs:check` | Revert planning edits only | `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`, `frontend/features/ai-studio/hooks/taskPolling/useAiStudioTaskRecoveryController.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` | Complete |
| `CD-02` | Remove client timeout/recovery authority | the client must not decide recovery success or reclassify server lifecycle success/failure on its own | remove + temporary keep | fewer false success states and fewer client/server disagreements on stuck generations | raw-media recovery success, grid success-as-loading, and success-without-preview timeout paths are gone or explicitly guarded | Before: the client still adjudicates timeouts, stale states, or recovery success. After: those decisions are server-owned only. | Server post-submit contract stable | Client no longer declares terminal state, timeout, or recovery success except the named submit-start fail-closed seam | targeted hook tests; user-flow regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Restore observer behavior only | `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`, `frontend/features/ai-studio/hooks/taskPolling/useAiStudioTaskRecoveryController.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` | In progress |
| `CD-03` | Tighten output-store composition and lifecycle derivations | output-store layers must surface canonical state, not reclassify lifecycle truth | keep -> tighten | fewer hidden state mismatches across selectors and derived collections | store selectors and derivations can pass existing tests without mutating lifecycle semantics | Before: client state stores still compose output truth and lifecycle derivations in multiple layers. After: they only surface canonical server-backed state and no longer classify lifecycle truth. | Server lifecycle path stable; client hooks can stop acting as lifecycle source | Output-store selectors and derivations no longer reclassify lifecycle truth | targeted store-selector regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert store composition first | `frontend/features/ai-studio/hooks/useAiStudioState.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`, `frontend/features/ai-studio/hooks/useAiStudioOutputStoreSelectors.ts` | Complete |
| `CD-04` | Demote grid heuristics that belong to lifecycle state | the grid must reflect canonical settled state instead of preview-absence heuristics | remove + keep | fewer stuck loading cards after success and clearer settled-state rendering | success-as-loading and similar heuristics are removed while hydration visuals still pass grid tests | Before: grid loading and card state still infer truth from preview absence. After: the client only reflects canonical state. | Server lifecycle and canonical output read path stable | Grid-loading heuristics no longer invent lifecycle truth | targeted Reference Grid render regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Revert visual heuristics only | `frontend/features/ai-studio/reference-grid/logic/referenceGridLoadingState.ts`, `frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts` | In progress |
| `CD-05` | Validate and close out | client demotion should stop when only intentional fail-closed seams or presentation cleanup remain | temporary keep handoff | clearer user-visible boundary between real lifecycle bugs and optional polish | remaining client lifecycle behavior is explicitly named as keep, temporary keep, or next-bucket work | Before: client lifecycle ownership is still being removed. After: the client is observer-only and the bucket is closed. | Main client-demotion changes complete | No client hook remains a lifecycle authority beyond the named submit-start fail-closed seam | end-to-end flow validation; render regression checks | `npm -C frontend run lint`; `npm -C frontend run build`; `npm -C frontend run docs:check` | Roll back the smallest client change last | `docs/archive/planning/ai-studio-reference-grid-runtime-simplification-plan-2026-03-31.md` | Planned |

## Bucket Rules
1. Do not add new recovery logic while removing client authority.
2. Keep optimistic UI behavior if it does not adjudicate truth.
3. Treat remaining client heuristics as temporary only.

## Live Invariants For This Bucket
1. `useAiStudioTasks` must not mark success from raw provider media alone.
2. `useAiStudioTaskRecoveryController` must only settle success from canonical lifecycle data.
3. `useAiStudioOutputLifecycle` must not locally timeout server-success-without-preview rows.
4. grid loading must only reflect nonterminal lifecycle state or true media hydration.
5. shared output-store composition helpers stay in place unless a new repo-backed reason says otherwise.

## Current Audit Notes
1. `CD-03` audited clean: `useAiStudioState.ts`, `useAiStudioOutputCollectionState.ts`, `useAiStudioOutputDerivations.ts`, and `useAiStudioOutputStoreSelectors.ts` are composition/read layers, not lifecycle authority layers.
2. The correct action in this slice was boundary coverage, not further refactoring.
