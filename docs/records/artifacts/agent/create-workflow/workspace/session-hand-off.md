# Session Hand-Off

Purpose: keep the next Create Workflow run from reloading the wrong incident model.

## Where We Left Off

- The main composer image insertion bug is resolved.
- The decisive fix was treating internal app drags as app-owned drags even when the browser also supplied a synthetic image file.
- The lane now uses an ephemeral attachment model with visible `preparing` state in the composer.

## What Not To Repeat

- Do not restart from the old “durable upload first” model for this lane.
- Do not assume preview bugs are primary before checking drag classification.
- Do not widen this lane into project persistence, storage promotion, or unrelated media workflows unless the product contract changes.
- Do not trust raw browser `files` first when structured/internal/reference hints exist on the drag payload.

## What To Do First Next Time

1. Reconfirm the current product contract:
   - chat-only
   - ephemeral
   - image-only
2. Determine whether the repro is:
   - internal drag only
   - desktop file only
   - both
3. If the regression is internal-drag-only, inspect source classification first.
4. If runtime behavior contradicts the current model, use the archived capture tools and reports.
