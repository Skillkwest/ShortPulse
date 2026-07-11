# AI Studio Standard Chat-Mode Image Attachment Boundary Plan

**Status:** Implemented and locally validated; production proof deferred  
**Date:** 2026-07-10  
**Plan owner/lane:** Create Workflow Agent, Standard Create mode composer/runtime  
**Plan source:** This document is the canonical plan for this change.

## Objective

Make Standard Create composer image attachments a Chat Mode ON-only capability:

- Chat Mode ON accepts up to 10 composer images through every supported image-ingress path.
- Chat Mode OFF does not expose or accept composer image attachments.
- Turning Chat Mode OFF clears staged chat-composer attachments so they cannot remain hidden, block generation, reappear later, or enter a payload created after the transition.
- Chat Mode OFF generation continues to use the authored Standard prompt and its existing generation properties only.

## Planning frame

### Source of truth

The behavior is jointly owned by these current canonical paths:

- `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts` — Standard chat-mode state, composer attachment lifecycle, agent dispatch, and mode transition.
- `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts` — shared ephemeral attachment collection, preparation, cleanup, and 10-image cap.
- `frontend/prefabs/agent/attachmentPolicy.ts` — canonical agent image-count limit and capacity message.
- `frontend/features/ai-studio/components/PromptStep.tsx` — composer-shell image/drop intake and staged attachment presentation.
- `frontend/features/ai-studio/components/create/StandardCreatePanelView.tsx` — panel-wide drop intake and Canvas drop-target eligibility.
- `frontend/features/ai-studio/createRuntime/standardPanel/standardCreatePanelContract.ts` — Standard runtime-to-view contract.
- `frontend/features/ai-studio/createRuntime/standardPanel/standardCreatePrimaryActionPolicy.ts` and `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts` — Generate/Send decision and payload boundary.
- `docs/sops/sop_ai_studio_agent.md` and `docs/sops/sop_ai_studio_agent_chat_ops.md` — Standard agent/chat behavior.
- `docs/sops/sop_ai_studio_internal_drag_drop_intake.md` — structured drag/drop behavior.
- `docs/adr/0083-create-mode-global-right-rail-authority.md` — global Reference Grid, Quick Slot Inventory, and Canvas ownership.
- `docs/planning/ai-studio-create-agent-ten-image-attachments-buildout-plan-2026-07-10.md` — approved 10-image attachment-cap behavior.

### Approved scope

- Standard Create mode only.
- Image ingress from desktop files, internal media payloads, panel drops, composer drops, and Canvas tear-out/direct payloads.
- Standard chat-mode transition lifecycle and agent-send boundary.
- Standard primary-action policy where stale chat attachments currently influence Chat Mode OFF generation.
- Focused tests and directly affected SOP documentation.

### Protected contracts

- Pulse remains forced into Chat Mode and retains its existing attachment behavior and 10-image cap.
- Chat Mode ON retains the current image chip, preparation, retry/error, removal, and send behavior.
- Text and prompt drops continue to target agent input when Chat Mode is ON and the authored Standard prompt when it is OFF.
- Reference Grid, Quick Slot Inventory, Canvas, character/model/reference-property inputs, and generated media remain workspace-global or generation-owned; they are not composer attachments and must not be cleared or disabled.
- Chat Mode OFF keeps its current Generate UX and authored-prompt semantics.
- Composer attachments remain ephemeral and are not added to project/session persistence.
- No changes to mobile scope, security/privacy posture, billing/credits, branch policy, launch posture, commit, push, or deploy state.

### Non-goals

- Retrofitting a server-side `chatModeEnabled` authority or creating a second attachment-policy system.
- Parking hidden attachments for later restoration when Chat Mode is turned back on.
- Cancelling or rewriting a chat request that was validly dispatched while Chat Mode was ON.
- Changing the global right rail or generation reference-image behavior.
- Refactoring the shared composer hook beyond what is necessary to enforce the Standard boundary.
- Broad Create panel cleanup or unrelated chat-surface work.

### Proof requirements

Implementation is complete only when focused automated tests prove the state, ingress, UI-contract, primary-action, and dispatch boundaries; existing Standard/Pulse attachment tests remain green; lint/type/build validation for touched surfaces passes; and the diff contains no unrelated behavior changes. Deployment and production browser/network verification are a separate proof boundary.

### Stop condition

Stop implementation when all planned local changes and focused checks pass. Do not commit, push, deploy, or claim production behavior. Stop earlier if the correct fix requires changing protected UX/product semantics, persistence, global right-rail authority, security/privacy, billing, or another owner lane.

## Current repo truth and discovered failure modes

The 10-image limit already exists in the shared composer attachment state and is not the missing boundary. The missing boundary is Standard Chat Mode OFF:

1. `useStandardCreateAgentRuntime.ts` retains staged attachments when the toggle changes from ON to OFF.
2. `PromptStep.tsx` continues to expose image drop handlers and render staged attachment chips while OFF.
3. `StandardCreatePanelView.tsx` continues to accept panel-wide image/media drops and reports Canvas image targets as eligible while OFF.
4. `standardCreatePanelContract.ts` always forwards attachments and image handlers, regardless of mode.
5. `standardCreatePrimaryActionPolicy.ts` evaluates preparing/failed image blockers before the Chat Mode branch, so stale chat attachments can block an otherwise valid OFF-mode Generate.
6. `handleAgentSend` can still construct an agent request with attachments if invoked programmatically while OFF, even though the visible Send control is unavailable.

Ready composer images do not currently enter the normal OFF-mode generation call: `handleGenerate` receives the authored prompt and generation options, not the agent attachment collection. That is useful but insufficient because ingress, lifecycle, blockers, and the callable agent-send path remain open.

## Approaches considered

| Approach                                   | Source boundary                                                          | Benefits                                                                                                          | Risks / what it could break                                                                                | Validation path                                                | Decision                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| UI-only disable/hide                       | `PromptStep.tsx`, `StandardCreatePanelView.tsx`                          | Small visible change                                                                                              | Programmatic ingress/send remains open; stale state can still block Generate or reappear                   | Component tests only cannot prove payload safety               | Reject                                                                            |
| Clear on toggle only                       | Standard toggle handler                                                  | Removes the common stale-state case                                                                               | Other false-state transitions and callable ingress/send paths remain open; async preparation may race      | Runtime transition tests                                       | Reject alone                                                                      |
| Filter images only at payload construction | Send/generate callers                                                    | Strong last-mile payload protection                                                                               | Leaves misleading chips, hidden state, preparation work, and OFF-mode generation blockers                  | Request/policy tests                                           | Reject alone                                                                      |
| Add mode policy to shared composer hook    | `useAiStudioAgentComposer.ts`                                            | Centralizes intake enforcement                                                                                    | Expands a shared Pulse/generic abstraction with Standard-only product semantics; larger regression surface | Broad hook, Standard, and Pulse suite                          | Reserve only if implementation proves mode-owned wrappers cannot close an ingress |
| Layered Standard-owned invariant           | Standard runtime, panel contract/view, PromptStep, primary-action policy | Closes lifecycle, every known ingress, presentation, decision, and dispatch while keeping product ownership local | Requires coordinated narrow edits and race tests                                                           | Runtime + component + policy + submit + Pulse regression tests | **Recommend**                                                                     |

## Recommended behavior contract

1. When Standard Chat Mode is ON, composer attachments work exactly as today, including the 10-image limit.
2. When it is OFF, the view contract exposes no staged composer attachments and no enabled image-ingress affordance.
3. Any image/media drop while OFF is safely intercepted and rejected; browser default navigation is prevented. Text/prompt drops still follow the existing OFF-mode authored-prompt path.
4. Transitioning ON to OFF clears the entire staged agent-composer attachment collection, not only images. This collection is chat-agent-owned and ephemeral; clearing it prevents hidden prompt attachments or future attachment types from becoming a second parked lifecycle.
5. Returning to ON starts with an empty attachment collection; nothing is silently restored.
6. An async image preparation that finishes after the OFF transition cannot resurrect an attachment. Existing object-URL/resource cleanup remains intact.
7. The Standard agent-send function refuses to dispatch while OFF, even if called outside the visible UI path.
8. OFF-mode primary-action policy ignores agent-composer attachment preparation/failure state and evaluates the authored Standard prompt normally.
9. A request already dispatched while ON is not retroactively cancelled. The guarantee applies to payloads constructed after the OFF transition.

## Implementation plan

### Batch 1 — Establish the Standard runtime invariant

Owning file: `frontend/features/ai-studio/createRuntime/useStandardCreateAgentRuntime.ts`

- Make `chatModeEnabled === false` an attachment-empty invariant, including toggle, hydration/reload, and any other false-state transition.
- Reuse the existing composer-state reset/cleanup authority; do not add a parallel attachment store or manual object-URL cleanup path.
- Ensure late async attachment preparation cannot repopulate state after the invariant is active. If the existing reset generation/token mechanism already provides this, preserve and test it rather than adding a second cancellation system.
- Guard `handleAgentSend` at the callable source boundary so OFF mode cannot dispatch an agent request or attachments.
- Expose mode-aware image ingress callbacks from the Standard runtime: OFF calls must be no-ops/rejections while ON calls retain existing behavior.

Focused proof:

- ON → OFF clears staged ready, preparing, failed, and non-image chat attachments.
- Late completion after OFF does not restore an item.
- OFF → ON starts empty.
- Direct/programmatic send while OFF does not call `runStandardCreateAgentSend`.
- ON send still includes staged attachments and preserves the 10-image contract.

### Batch 2 — Close all UI ingress and presentation paths

Owning files:

- `frontend/features/ai-studio/createRuntime/standardPanel/standardCreatePanelContract.ts`
- `frontend/features/ai-studio/components/PromptStep.tsx`
- `frontend/features/ai-studio/components/create/StandardCreatePanelView.tsx`

Changes:

- Derive the Standard panel contract from chat mode: while OFF, pass an empty staged-attachment view and inactive image drop state/handlers. This makes hidden chips impossible even during transition timing.
- In `PromptStep`, accept composer image/media drops only while ON. While OFF, prevent the browser default and do not call the attachment handler. Preserve text/prompt drop routing.
- In `StandardCreatePanelView`, make Canvas image-target eligibility false while OFF and block panel-wide desktop/internal image or media intake. Preserve text, prompt, and other non-composer drag/drop behavior.
- Keep the current visual design. Do not introduce a new toast, modal, disabled icon, copy, or layout unless existing component behavior requires one for accessibility.

Focused proof:

- OFF-mode desktop image drop, internal media drop, and Canvas image drop never call image attachment intake.
- Rejected file drops prevent browser navigation.
- OFF-mode text/prompt drops still update the authored Standard prompt.
- No attachment chips or drop-active styling appear while OFF.
- ON-mode composer/panel/Canvas image intake remains functional.

### Batch 3 — Seal the Generate decision boundary

Owning files:

- `frontend/features/ai-studio/createRuntime/standardPanel/standardCreatePrimaryActionPolicy.ts`
- `frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts`

Changes:

- Consult agent-composer attachment preparation/failure blockers only for Chat Mode ON agent sends.
- In Chat Mode OFF, decide Generate solely from the authored Standard prompt and existing generation rules/options.
- Keep `handleGenerate` free of agent-composer attachments. Do not add a filtered attachment parameter or server-side fallback.

Focused proof:

- Ready, preparing, and failed stale attachments cannot block OFF-mode Generate.
- OFF-mode `handleGenerate` receives only the authored prompt and existing options.
- ON-mode Send remains blocked for preparing/failed images as today.

### Batch 4 — Regression coverage and contract documentation

Update the nearest existing tests rather than creating a duplicate test harness:

- `useStandardCreateAgentRuntime.test.tsx`
- `useAiStudioAgentComposer.test.ts`
- `standardCreatePrimaryActionPolicy.test.ts`
- `useStandardCreatePrimarySubmit.test.tsx`
- `useStandardCreatePanelProps.test.ts`
- `StandardCreatePanelView.test.tsx`
- `PromptStep.actions.test.tsx`
- the existing Pulse panel/runtime attachment contract tests

Test matrix:

| Mode / transition | Ingress                                  | Expected state           | Expected action/payload                     |
| ----------------- | ---------------------------------------- | ------------------------ | ------------------------------------------- |
| Standard ON       | 1–10 images                              | Visible/staged           | Agent send may include them                 |
| Standard ON       | 11th image                               | Existing cap behavior    | Rejected by canonical cap                   |
| Standard OFF      | Composer file/internal image drop        | Empty                    | No attachment intake; no browser navigation |
| Standard OFF      | Panel/Canvas image drop                  | Empty                    | No target resolution or intake              |
| Standard OFF      | Text/prompt drop                         | No attachment change     | Authored prompt updates normally            |
| ON → OFF          | Ready/preparing/failed/mixed attachments | Cleared; no resurrection | Later Generate excludes/ignores them        |
| OFF → ON          | None                                     | Empty                    | No hidden restoration                       |
| Standard OFF      | Programmatic agent send                  | Empty/no dispatch        | No agent request                            |
| Pulse             | 1–10 images                              | Existing behavior        | Existing send behavior unchanged            |

Update the Standard agent/chat SOP only where necessary to state that composer attachments are Chat Mode ON-only and are discarded on OFF transition. Do not alter right-rail or generation-reference documentation.

## Validation sequence

Run from `frontend/` in this order:

1. Focused Vitest files for the Standard runtime, composer state, panel contract/view, PromptStep actions, primary-action policy, and primary submit.
2. Existing Pulse attachment/panel/runtime tests to prove the shared 10-image behavior is unchanged.
3. Targeted lint for touched source/test files.
4. Typecheck/build according to the repo's current scripts if focused tests and lint pass.
5. Repo documentation check from the documented command surface.
6. Final `git diff --check`, scoped diff review, and status review to prove no unrelated or concurrent changes were absorbed.

Manual local component proof, if the existing test harness supports it without changing launch posture:

- Toggle ON, stage images, toggle OFF, observe immediate removal, generate, toggle ON, verify no restoration.
- Repeat each ingress class: desktop file, internal media, Canvas, and text/prompt.

## Risks and mitigations

- **Async preparation race:** clearing state while file preparation resolves could resurrect an item or leak an object URL. Mitigate by using the existing composer reset/cancellation authority and proving late completion behavior.
- **Drag/drop regression:** a broad OFF guard could accidentally block text drops. Classify payload type first and test image/media separately from text/prompt.
- **Pulse regression:** shared composer changes could affect forced-chat Pulse. Prefer Standard-owned gates and run Pulse regressions.
- **Generation regression:** stale attachment blockers currently run before mode selection. Move the condition, not the generation payload architecture, and test all attachment statuses in both modes.
- **Concurrent-work collision:** the worktree currently contains unrelated edits, including nearby chat-surface/runtime files. Preserve them, re-read touched files immediately before implementation, and avoid `StandardPromptStepChatSurface.tsx` unless fresh evidence makes it necessary.
- **False safety from hidden UI:** view hiding alone is not payload proof. Keep runtime dispatch and decision guards even after UI ingress is closed.

## Implementation stop and proof boundary

The local implementation stop condition is reached when all batches are complete, the focused and regression checks pass, the scoped diff is clean, and no protected contract changed. At that point:

- **Proven locally:** state lifecycle, ingress rejection, UI contract, primary-action behavior, agent-dispatch guard, 10-image ON behavior, and Pulse regression behavior.
- **Still unproven:** deployed production behavior, browser-specific drag/drop integration on `https://www.shortpulse.ai`, and actual production network payloads.
- **Required production proof after an authorized deploy:** on the production desktop surface, exercise all ON/OFF ingress and transition cases and inspect network requests to confirm no agent attachment request is constructed after OFF and OFF-mode generation contains only the intended generation request data.

Do not cross the commit, push, deploy, or production-validation boundary without separate authorization.

## Local completion evidence

Completed locally on 2026-07-10 without commit, push, deploy, production mutation, persistence, storage, billing, security, right-rail, or Pulse behavior changes.

- Standard Chat Mode ON → OFF resets the canonical composer attachment state while preserving composer text and invalidating in-progress attachment preparation.
- Standard runtime event/direct-drop handlers and agent dispatch independently reject calls while Chat Mode is OFF.
- The Standard panel contract exposes no staged attachments, drop-active state, or image-ingress callbacks while OFF.
- Prompt composer, wider-panel, and Canvas image ingress are rejected while OFF; existing text/prompt drop behavior remains active.
- Preparing or failed chat attachments do not block or enter OFF-mode generation; generation remains authored-prompt plus existing options only.
- Focused Standard/Pulse/chat-composer regression result after closeout remediation: 12 files passed, 193 tests passed.
- Targeted ESLint, repo-clean touched-file type checking, Generate CTA contract checking, full docs checking, production build, and `git diff --check` passed.
- The production build passed through TypeScript, optimized compilation, page generation, finalization, and trace collection.
- Repository documentation checks passed, including links, semantic drift, migration parity, archive manifest, model catalog parity, naming drift, and operator-map drift.

The remaining proof boundary is an authorized deployed production check at `https://www.shortpulse.ai`, including desktop drag/drop and network inspection. This lane still stops before commit, push, deploy, or production validation.

## Second-pass authorization remediation

A broader post-build audit invalidated the initial local completion claim until these three related issues were resolved:

1. Render-time Chat Mode closures could remain permissive briefly after OFF.
2. A send awaiting image preparation could construct and dispatch its attachment payload after OFF.
3. An already-dispatched request's failure/discard path could restore attachments cleared by OFF.

The canonical remediation is complete locally:

- Standard runtime now maintains a synchronous Chat Mode authorization mirror and transition epoch. Retained callbacks consult the mirror, and each send captures an epoch that remains revoked even if Chat Mode is subsequently turned back on.
- `runStandardCreateAgentSend` requires current authorization, rechecks it after each asynchronous attachment-preparation boundary and immediately before payload construction/dispatch, and discards the optimistic turn if authorization was revoked.
- Composer restoration is authorization-aware, so a later failure or discarded response cannot restore attachments after OFF. Requests already passed to transport while ON are not retroactively cancelled.
- Deferred-promise tests prove revocation during preparation prevents `sendToAgent`, revocation after dispatch prevents attachment restoration, stale callbacks are rejected immediately, and OFF → ON does not revive the originating send epoch.

## Closeout audit update

A final lane closeout audit on 2026-07-10 found one additional in-scope build-time issue: the legacy/shared `useAiStudioAgentOrchestration` caller still imported `runStandardCreateAgentSend` without the required `isSendAuthorized` contract. That caller is not the active Standard Create panel runtime, but it remains type-checked and tested, so it now passes an explicit Standard-runtime authorization predicate instead of weakening the strict send contract.

Updated local proof:

- Focused Standard/Pulse/chat-composer regression sweep passed: 12 files, 193 tests.
- Targeted ESLint for touched lane files passed.
- `npm run type-check:touched` passed with a repo-wide clean type-check result.
- `npm run docs:check` passed.
- `npm run build` passed through TypeScript, production compilation, page generation, and trace collection.
- `npm run check:generate-cta-contract` passed.
- `git diff --check` passed.

The remaining proof boundary is unchanged: no commit, push, deploy, or production browser/network validation has been performed in this lane.
