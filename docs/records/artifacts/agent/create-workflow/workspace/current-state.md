# Current State

Last updated: 2026-05-19

## Status

Resolved for the main incident family.

The broken Create composer image insertion lane was fixed by narrowing the contract and correcting drag-intake classification.

## Active Contract

- Composer image attachments in this lane are chat-only and ephemeral.
- The intended behavior is ChatGPT-style image reference insertion for model vision use.
- Internal app drags must prefer structured/internal/reference hints before raw browser `files`.
- Desktop file drops still use the local image path.
- A temporary `preparing` image attachment should appear immediately, then transition to `ready`.

## What To Treat As Historical

These are no longer the hot-path model for this lane:

- May 18 durable upload / storage-promotion assumptions
- treating composer image refs as project-persistent media
- debugging preview/render in isolation from intake classification
- assuming `DataTransfer.files` is authoritative for internal app drags

Historical details still live in:

- `../reports/2026-05-16-create-composer-attachment-incident-audit.md`
- `../reports/2026-05-19-composer-image-insertion-retrospective.md`
- `../training-data/`

## Highest-Value Next Move If This Regresses

1. Reconfirm the source surface:
   - Reference Grid
   - Quick Slot
   - Media Library
   - desktop file drop
2. Check whether the failure is:
   - source classification
   - preparing-state transition
   - preview projection
   - model-send payload preparation
3. If internal drags fail while desktop file drops work, inspect structured payloads and hint precedence before touching preview or persistence logic.
4. Use `window.__shortpulseCreateWorkflowDebug.getDiagnosis()` only if the current runtime contradicts the resolved model.
