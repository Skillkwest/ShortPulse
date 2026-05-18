# Production Capture Template

Purpose: standardize the next live failing Create attachment capture so the artifact is useful for debugging and for later training.

## Repro Context

- Date:
- Environment:
- Route / page:
- Mode:
  - Standard / Pulse
- Source surface:
  - Quick Slot / Reference Grid / Media Library / desktop file drop
- Media type:
  - image / audio / video

## Enable Runtime Helper

One of:

```js
localStorage.setItem("shortpulse.create_workflow.debug", "1");
location.reload();
```

or load the page with:

```text
?createWorkflowDebug=1
```

## Capture Commands

Before repro:

```js
window.__shortpulseCreateWorkflowDebug?.reset();
```

After repro:

```js
copy(
  JSON.stringify(
    window.__shortpulseCreateWorkflowDebug?.getSnapshot(),
    null,
    2,
  ),
);
```

Also capture the diagnosis:

```js
copy(
  JSON.stringify(
    window.__shortpulseCreateWorkflowDebug?.getDiagnosis(),
    null,
    2,
  ),
);
```

## Required Retained Fields

- `attachments`
- `events`
- attachment `id`
- attachment `kind`
- attachment `deliveryStatus`
- attachment `deliveryError`
- attachment `imageUrl` source kind only:
  - `blob`
  - `data`
  - durable URL
  - empty
- attachment `submissionImageUrl` source kind and hostname/path summary
- attachment `previewStoragePath`
- attachment `fullStoragePath`
- upload request/response status for storage materialization
- model-send request/response status if the repro reaches send
- diagnosis `likelyFailureClass`
- diagnosis `blockers`
- screenshot of visible failure state
- final rendered `img.src` if inspectable
- console errors if any

## Questions The Capture Must Answer

1. Was the attachment inserted correctly?
2. Did `deliveryStatus` reach `ready`?
3. Did `submissionImageUrl` become a durable storage URL?
4. Was Generate/chat-send blocked while `preparing` or `failed`?
5. Did the chip render from a valid preview source?
6. Did the model-send payload use `submissionImageUrl` instead of `imageUrl`?
7. Did any later event replace, null, or downgrade the attachment?

## Post-Capture Report

Run:

```bash
node frontend/scripts/create_workflow_debug_report.mjs /path/to/snapshot.json
```

or use the full ingest tool:

```bash
cd frontend
npm run create-workflow:capture:ingest -- /path/to/snapshot.json --incident-id create-workflow-2026-05-composer-attachment-001 --label prod-repro
```

Store:

- raw snapshot JSON
- generated markdown/text summary
- generated analysis JSON
- screenshot

Recommended retained location:

- `docs/records/artifacts/agent/create-workflow/workspace/captures/`
