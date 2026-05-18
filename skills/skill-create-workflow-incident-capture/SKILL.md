---
name: skill-create-workflow-incident-capture
description: Capture AI Studio Create-panel attachment incident data from the live runtime before further patching. Use when Create composer attachments break, flash, go dark, or local fixes disagree with production.
---

# Create Workflow Incident Capture

## When to use

- The Create composer image chip is broken, empty, flashing, or goes dark.
- Local targeted tests pass but production still fails.
- You need evidence from the live runtime before continuing implementation.

## Core rule

Do not patch first when production is contradicting repo-side confidence.
Capture the live runtime packet first.

## Runtime helper

This repo exposes a debug window contract when explicitly enabled:

- query param: `?createWorkflowDebug=1`
- or browser localStorage:

```js
localStorage.setItem("shortpulse.create_workflow.debug", "1");
```

Then reload the Create page and reproduce the issue.

Inspect:

```js
window.__shortpulseCreateWorkflowDebug?.getSnapshot();
```

Reset between attempts:

```js
window.__shortpulseCreateWorkflowDebug?.reset();
```

## Report helper

Save the snapshot JSON locally, then summarize it with:

```bash
node frontend/scripts/create_workflow_debug_report.mjs /path/to/create-workflow-snapshot.json
```

## What to capture

At minimum, retain:

1. `drop_received`
2. `attachment_inserted` / `attachment_replaced`
3. attachment snapshots before and after the chip darkens
4. `preview_resolved_source_changed`
5. `preview_img_error`
6. `preview_repair_attempted` / `preview_repair_resolved` if present

## Expected output

Write a retained report that states:

- exact repro source surface
- debug snapshot excerpt
- whether `imageUrl` changed
- whether `submissionImageUrl` survived
- whether a second state write replaced the attachment
- final likely owned surface for the next fix

## Suggested validation after a fix

```bash
cd frontend
npm run test -- \
  features/ai-studio/logic/__tests__/agentAttachmentImage.test.ts \
  features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts \
  features/ai-studio/hooks/agentOrchestration/__tests__/attachmentPreparation.test.ts \
  features/ai-studio/hooks/__tests__/useAiStudioAgentOrchestration.test.ts
```
