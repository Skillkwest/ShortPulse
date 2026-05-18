# Tool Inventory

Purpose: record only the core helper surfaces needed to continue the Create image-chip incident without reloading excess history.

## Runtime Helper

Browser handle:

- `window.__shortpulseCreateWorkflowDebug`

Enable:

- query param: `?createWorkflowDebug=1`
- or:

```js
localStorage.setItem("shortpulse.create_workflow.debug", "1");
```

Use for:

- attachment lifecycle event capture
- proving whether a failing attachment is blocked by delivery state, preview projection, storage URL renderability, or send-payload preparation

Primary commands:

```js
window.__shortpulseCreateWorkflowDebug.getSnapshot();
window.__shortpulseCreateWorkflowDebug.getDiagnosis();
```

The diagnosis is the first-pass triage surface. It classifies the current capture as one of:

- `delivery_failed`
- `delivery_not_ready`
- `missing_durable_submission_url`
- `send_preparation_failed`
- `send_payload_missing_image`
- `preview_render_failed`
- `preview_source_missing`
- `ready_for_model_send`

## Capture Ingest CLI

Package command:

- `npm run create-workflow:capture:ingest -- /path/to/snapshot.json --incident-id <id> --label <label>`

Use for:

- converting raw runtime snapshot JSON into:
  - normalized analysis JSON
  - markdown capture report
- storing those artifacts in the Create Workflow capture landing area

## Training Data CLI

Package commands:

- `npm run create-workflow:training:summary`
- `npm run create-workflow:training:validate`
- `npm run create-workflow:training:brief`

Use for:

- validating the structured dataset
- generating a compact incident brief
- summarizing the current Create Workflow training corpus
- tracking recurring failure patterns via `failure-patterns.jsonl`
