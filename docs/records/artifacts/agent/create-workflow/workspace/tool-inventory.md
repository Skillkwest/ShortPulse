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
- proving whether the chip goes dark because of replacement, cleanup, repair failure, or source overwrite

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
