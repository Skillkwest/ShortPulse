# Create Composer Attachment Incident Audit

Purpose: retain a conversation-derived attempt ledger for the AI Studio Create composer image-attachment incident so future debugging starts from evidence instead of repeated guesswork.

## Scope

- Surface: AI Studio Create panel composer attachment chips
- Main symptom family:
  - broken image icon after drag
  - empty/dark chip after drag
  - image flashes briefly and then goes dark
  - send-time `failed to prepare` behavior on some paths
- Time window represented:
  - 2026-05-12 through 2026-05-16
- Source:
  - this supervised conversation plus repo-visible code changes and validation runs

## User-Observed Symptom Timeline

### 2026-05-12

- User reported:
  - dragging an image from Quick Slot / Reference Grid into the Create composer showed a broken image.
- Visual symptom:
  - broken image glyph in the small chip next to the composer.

### 2026-05-15

- User reported:
  - the chip was still broken after multiple fixes and deployments.
- Symptoms evolved across screenshots:
  - broken icon
  - empty framed slot
  - chip briefly showing and then going dark
  - `failed to prepare` for some actual send paths

### 2026-05-16

- User reported:
  - chip was "no longer broken but still doesn’t display"
  - then that it still flashed for a fraction of a second and went dark
  - then that actual image send also failed on one Pulse/Standard surface
  - then finally that after redeploys the chip was still dark on production

## What Was Tried

This section records the major hypotheses and implementation passes attempted during the conversation.

### 1. Single-source preview fallback audit

- Hypothesis:
  - The chip preview was rendering from one brittle URL with no error recovery.
- Evidence found:
  - preview component had one `<img>` and no fallback escalation.
  - composer payload path discarded fallback identity.
- Repo work attempted:
  - added preview candidate ladders and `onError` fallback escalation.
  - passed richer candidate data through preview projection.
- Validation:
  - targeted tests passed.
- Outcome:
  - did not solve the production symptom completely.

### 2. Preserve fallback identity across runtime and snapshot boundaries

- Hypothesis:
  - fallback candidates and durable identity were getting stripped during serialization/hydration/runtime projection.
- Repo work attempted:
  - preserved `imageFallbackUrls` through runtime/snapshot paths instead of zeroing them out.
- Validation:
  - targeted tests passed.
- Outcome:
  - reduced one contract gap but did not solve the live dark-chip symptom.

### 3. Borrowed output-preview lifecycle audit

- Hypothesis:
  - composer chips were borrowing output-owned `blob:` previews that later got revoked.
- Repo work attempted:
  - traced output object URL lifecycle and durability-repair split.
  - shifted toward composer-owned previews rather than output-owned previews.
- Outcome:
  - produced a better model direction, but still not sufficient by itself.

### 4. Drag snapshot thumbnail approach

- Hypothesis:
  - the chip should render from a self-contained drag snapshot rather than the live source URL.
- Repo work attempted:
  - changed composer drag payload logic to prefer drag-time snapshot artifacts.
- Outcome:
  - still not sufficient in production.

### 5. Internal resolver precedence over weak composer payload path

- Hypothesis:
  - internal app drags should resolve to real local image attachment authority first instead of trusting transferred preview URLs.
- Repo work attempted:
  - changed `useAiStudioAgentComposer.ts` so internal image resolution wins before the weaker payload path.
- Validation:
  - targeted composer tests passed.
- Outcome:
  - improved architecture, but production symptom remained.

### 6. Identity-backed repair path

- Hypothesis:
  - chip should repair from `previewStoragePath` / `fullStoragePath` / `referenceUrl` when the first preview source fails.
- Repo work attempted:
  - wired `resolveAgentAttachmentPreviewUrl()` into the preview component.
  - added signing refresh and API-first batch signing for private storage-backed assets.
- Outcome:
  - addressed "broken icon" class and missing signer mismatch, but not the persistent dark-chip outcome.

### 7. Non-image misclassification rejection

- Hypothesis:
  - audio/video references were sometimes being staged as image chips, yielding empty slots.
- Repo work attempted:
  - hard-rejected internal `audio` / `video` references in image-only intake paths.
- Validation:
  - regression tests added and passed.
- Outcome:
  - fixed a real adjacent bug, but not the image-darkening bug.

### 8. Tiny local preview blob for chip

- Hypothesis:
  - the chip should use a tiny local preview blob rather than a heavyweight preview source.
- Repo work attempted:
  - downscaled image bytes into small preview blobs for composer display.
- Outcome:
  - symptom still persisted in production.

### 9. Separate preview vs submission source

- Hypothesis:
  - using the same image source for both chip preview and send preparation was causing coupling and send failures.
- Repo work attempted:
  - added `submissionImageUrl` to `AgentAttachment`.
  - made send preparation prefer `submissionImageUrl`.
  - kept `imageUrl` for chip preview.
  - applied this contract to internal drags, file drops, and generic image/reference lanes.
- Validation:
  - targeted tests passed.
- Outcome:
  - improved send-path model and likely fixed some `failed to prepare` classes, but chip still went dark in production.

### 10. Standard send early-clear bug

- Hypothesis:
  - Standard send cleared attachments before preparation, revoking needed blob URLs too early.
- Repo work attempted:
  - moved clear to happen after preparation success, with restore on failure.
- Validation:
  - orchestration tests passed.
- Outcome:
  - fixed a real lifecycle bug, but did not solve the dark-chip symptom.

### 11. Data URL thumbnail preference

- Hypothesis:
  - even composer-owned preview blobs were still vulnerable to lifetime issues; inline `data:` previews should be more stable.
- Repo work attempted:
  - changed downscaled composer preview generation to prefer inline `data:image/...` thumbnails when available.
- Validation:
  - targeted tests passed.
- Outcome:
  - still did not resolve the production symptom.

### 12. Missing chip fallback to `submissionImageUrl`

- Hypothesis:
  - after introducing `submissionImageUrl`, the chip/preview stack still ignored it; if runtime dropped `imageUrl` but kept `submissionImageUrl`, the chip would go dark.
- Repo work attempted:
  - updated:
    - `frontend/features/ai-studio/logic/agentAttachmentImage.ts`
    - `frontend/features/ai-studio/logic/composerImageAttachment.ts`
    - `frontend/prefabs/agent/components/AgentImageAttachmentPreview.tsx`
  - added regression coverage to `frontend/features/ai-studio/logic/__tests__/agentAttachmentImage.test.ts`
- Validation:
  - targeted tests passed.
- Outcome:
  - latest repo-side attempt at time of this report.

## What Was Validated Locally

Repeatedly validated targeted lanes with commands of this family:

```bash
cd frontend
npm run test -- features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts features/ai-studio/hooks/agentOrchestration/__tests__/attachmentPreparation.test.ts features/ai-studio/hooks/__tests__/useAiStudioAgentOrchestration.test.ts
npx eslint 'features/ai-studio/hooks/useAiStudioAgentComposer.ts' ...
```

Latest reported focused validations in conversation:

- `66 passed` across:
  - `agentAttachmentImage.test.ts`
  - `useAiStudioAgentComposer.test.ts`
  - `attachmentPreparation.test.ts`
  - `useAiStudioAgentOrchestration.test.ts`
- lint clean on the touched lane after correcting one bad file path in an earlier lint command

## What Was Not Tried Or Not Completed

These are the highest-value missing evidence lanes.

### 1. Authoritative production attachment trace

Not completed.

Needed:

- staged attachment object immediately after drop
- staged attachment object after the chip turns dark
- final projected composer preview object
- final rendered `img.src`

This is the single biggest missing evidence gap.

## Tooling Added After This Audit

To reduce repeated blind patching on future runs, the repo now includes:

- runtime capture helper:
  - `frontend/features/ai-studio/logic/createWorkflowDebug.ts`
  - browser handle: `window.__shortpulseCreateWorkflowDebug`
- capture skill:
  - `skills/skill-create-workflow-incident-capture/SKILL.md`
- snapshot summarizer:
  - `frontend/scripts/create_workflow_debug_report.mjs`

These should be used before another speculative Create-composer preview fix when production still contradicts local validation.

### 2. Production DOM/CSS/state inspection on the exact failing live page

Not completed successfully.

What happened:

- runtime inspection attempted late in the conversation,
- but the active Chrome window was sitting on a dead localhost tab at one point,
- Playwright opened an unauthenticated `shortpulse.ai` tab separately,
- no authoritative authenticated production DOM trace of the failing chip was captured.

### 3. Direct proof of post-drop runtime overwrite

Not completed.

This remains a strong hypothesis:

- the attachment may render once,
- then another runtime write may replace it with an object missing the display preview,
- leaving only identity or submission state behind.

### 4. Exact DataTransfer payload capture from a failing production drag

Not completed.

Needed:

- transfer types
- composer payload fields
- internal reference payload fields
- media kind classification

### 5. Console/network error capture for the live production chip

Not completed.

Needed:

- console errors or warnings during drop
- failed image requests if any
- any runtime exceptions during staged attachment rewrite

### 6. Live differentiation between image-card repro and audio-card repro

Only partially explored.

The conversation did uncover that some failing screenshots were probably coming from audio-like cards in Quick Slot, and misclassification bugs were fixed. But there is still no single authoritative runtime capture showing:

- a pure image-card drag,
- a pure audio-card drag,
- and how those differ in the final staged attachment object.

## Hypotheses That Still Remain Plausible

Ranked highest to lowest based on the conversation evidence.

### 1. Runtime overwrite after successful first render

Most plausible unresolved hypothesis.

Reason:

- user repeatedly saw "shows briefly, then goes dark"
- many local fixes now support preview fallback and submission fallback
- this symptom still strongly suggests a second state write replacing the initial visible attachment

### 2. Production Create runtime is using a different path than the local tests fully cover

Still plausible.

Reason:

- the lane repeatedly passed local targeted tests while failing on production
- authenticated live-runtime inspection never produced a definitive state capture

### 3. The production chip is rendering from a valid object, but that object becomes preview-empty after projection

Plausible.

Reason:

- `submissionImageUrl` blind spot was real and only patched late
- other projection paths may still rebuild the visible attachment without the right field precedence

### 4. Hidden media-kind drift or mixed card-source behavior

Plausible but secondary.

Reason:

- audio/video misclassification was definitely present in some screenshots
- but the user still reported the dark-chip symptom on clearly image-looking cards

### 5. Pure CSS-only invisibility

Possible but weaker.

Reason:

- code inspection showed ordinary card CSS
- symptom timing still looked more like state/lifecycle than a static style bug

## What This Conversation Proved

- The original lane was not one simple broken-URL issue.
- Multiple real bugs existed in parallel:
  - no fallback escalation
  - stripped identity/fallback state
  - output-owned preview lifetime coupling
  - audio/video misclassification
  - send-path early clear
  - preview/send source coupling
  - missing chip fallback to `submissionImageUrl`
- Local targeted tests were able to verify many sub-problems.
- Production behavior still contradicted repo-side confidence, which means the next run must start with runtime capture instead of another speculative code patch.

## Recommended Next Step

Before any further code changes in this lane:

1. Capture the authenticated production Create page state during one failing drag.
2. Persist:
   - drag payload contents
   - staged attachment before darkening
   - staged attachment after darkening
   - projected preview candidates
   - final DOM `img.src`
3. Only then decide whether the next fix belongs in:
   - runtime state ownership
   - projection precedence
   - hydration/reset logic
   - or a still-missed media-kind/export path

## Subagent Note

Repo guidance prefers subagents for substantive audit lanes, but no subagents were used for this retained report because the current session policy only permits delegation when the user explicitly requests it.
