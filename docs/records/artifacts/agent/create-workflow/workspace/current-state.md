# Current State

Last updated: 2026-05-18

## Active Incident

Surface:

- AI Studio Create panel composer image attachment chip
- Standard and Pulse composer attachment send path

Primary user-visible symptom:

- image attachments can insert into the composer but render as an empty/dark chip in production
- attached images are meant to be sent to GPT vision models as references for analysis

## What Is Now True

- The active implementation contract is now a split authority model:
  - `imageUrl` is preview-only and may be a small `blob:` or `data:` URL.
  - `submissionImageUrl` is the only durable URL allowed to authorize model submission.
  - new local image drops enter as `deliveryStatus: "preparing"`.
  - upload completion moves attachments to `deliveryStatus: "ready"` with durable storage paths.
  - upload failure moves attachments to `deliveryStatus: "failed"` with a visible send blocker.
- Standard Generate, Pulse Generate, and agent chat send are blocked while image attachments are `preparing` or `failed`.
- Desktop/local dropped images are uploaded at drop time through the storage upload path before they can be submitted.
- Local `blob:` and `data:` URLs should never become submission authority for new attachment paths.
- The Create composer and preview flow now emit structured runtime debug data through `window.__shortpulseCreateWorkflowDebug` when explicitly enabled.
- The runtime debug handle now exposes `getDiagnosis()` to classify the capture before another code pass.
- A summarizer script exists to turn captured runtime JSON into a readable artifact report.

## What To Treat As Disproved Or Secondary

- simple preview fallback improvements were not enough
- pure persistence/hydration fixes were not enough
- adjacent media-kind and send-path bugs existed, but they were not the main unresolved chip-darkening issue
- debugging only the visual chip is too narrow; the correct contract must verify both preview rendering and durable vision submission
- full attempt detail lives in:
  - `../reports/2026-05-16-create-composer-attachment-incident-audit.md`
  - `../training-data/attempt-ledger.jsonl`

## What Is Still Missing

The highest-value missing evidence is a production confirmation for the current May 18 contract:

1. attachment snapshot immediately after drop
2. attachment snapshot after upload resolves
3. `deliveryStatus`, `deliveryError`, `imageUrl`, `submissionImageUrl`, `previewStoragePath`, and `fullStoragePath`
4. final rendered `img.src`
5. Generate/chat-send blocked while `preparing` or `failed`
6. actual model-send payload uses `submissionImageUrl`, not `imageUrl`
7. any storage upload, image render, or model-send errors

## Current Best Hypothesis

If the symptom still reproduces after the latest drop-time durable upload changes, the most likely remaining classes are:

- upload delivery state never reaches `ready`,
- the chip projection reads the wrong source after upload resolves,
- storage returns a durable URL that the browser cannot render,
- or model-send validation still rejects the attachment despite a ready durable URL.

The debug helper and capture template exist to prove which of those lanes is failing before another implementation pass.

## Highest-Value Next Move

1. Verify the deployed build includes the May 18 drop-time durable upload implementation.
2. Enable `createWorkflowDebug` in the failing production page.
3. Reproduce one image drag into Standard and, if relevant, Pulse.
4. Save `window.__shortpulseCreateWorkflowDebug.getSnapshot()` to JSON.
5. Save `window.__shortpulseCreateWorkflowDebug.getDiagnosis()` to JSON.
6. Confirm whether the attachment reached `deliveryStatus: "ready"` and received `submissionImageUrl`.
7. Store the capture in `workspace/captures/` before another fix pass.
