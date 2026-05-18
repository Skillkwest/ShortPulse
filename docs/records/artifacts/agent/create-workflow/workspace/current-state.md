# Current State

Last updated: 2026-05-16

## Active Incident

Surface:

- AI Studio Create panel composer image attachment chip

Primary user-visible symptom:

- image chip may appear briefly after drag, then go dark or empty on production

## What Is Now True

- The repo has moved from a single brittle preview-URL model toward a split model:
  - `imageUrl` for chip preview
  - `submissionImageUrl` for actual send authority
- The preview stack now understands `submissionImageUrl` as a fallback source.
- The Create composer and preview flow now emit structured runtime debug data through `window.__shortpulseCreateWorkflowDebug` when explicitly enabled.
- A summarizer script exists to turn captured runtime JSON into a readable artifact report.

## What To Treat As Disproved Or Secondary

- simple preview fallback improvements were not enough
- pure persistence/hydration fixes were not enough
- adjacent media-kind and send-path bugs existed, but they were not the main unresolved chip-darkening issue
- full attempt detail lives in:
  - `../reports/2026-05-16-create-composer-attachment-incident-audit.md`
  - `../training-data/attempt-ledger.jsonl`

## What Is Still Missing

The highest-value missing evidence is still a single authoritative production capture showing:

1. attachment snapshot immediately after drop
2. attachment snapshot after the chip goes dark
3. preview source transition events
4. final rendered `img.src`
5. any image error / repair events

## Current Best Hypothesis

If the symptom still reproduces after the latest repo-side fallback changes, the most likely remaining class is:

- runtime overwrite or cleanup after the initial staged attachment render,
- not initial drag parsing itself.

The new debug helper exists specifically to prove or disprove that.

## Highest-Value Next Move

1. Enable `createWorkflowDebug` in the failing production page.
2. Reproduce one failing image drag.
3. Save `window.__shortpulseCreateWorkflowDebug.getSnapshot()` to JSON.
4. Run the ingest tool.
5. Store the result in the capture landing area before another fix pass.
