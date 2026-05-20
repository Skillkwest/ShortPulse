# Tool Inventory

Purpose: keep only the current high-ROI helper surfaces for this incident family.

## Primary Reuse Pattern

Use the documented drag/drop intake pattern first:

- `docs/sops/sop_ai_studio_internal_drag_drop_intake.md`

Core rule:

- snapshot drag payload synchronously
- rebuild a stable transfer-like object
- prefer structured/internal/reference hints before raw browser `files`

## Runtime Helper

Browser handle:

- `window.__shortpulseCreateWorkflowDebug`

Use only when the current runtime contradicts the resolved model.

Primary commands:

```js
window.__shortpulseCreateWorkflowDebug.getSnapshot();
window.__shortpulseCreateWorkflowDebug.getDiagnosis();
```

## Training Data CLI

Package commands:

- `npm run create-workflow:training:summary`
- `npm run create-workflow:training:validate`
- `npm run create-workflow:training:brief`

Use for:

- checking whether the incident family already has a known pattern
- updating retained judgment without rereading long chat history

## Reports Worth Reading

- `../reports/2026-05-19-composer-image-insertion-retrospective.md`
- `../training-data/failure-patterns.jsonl`
- `../training-data/decision-episodes.jsonl`

These are higher ROI than the older unresolved-state workspace notes.
