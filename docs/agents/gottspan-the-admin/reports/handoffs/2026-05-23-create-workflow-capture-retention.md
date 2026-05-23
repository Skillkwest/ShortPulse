# Handoff: Create Workflow Binary Capture Retention

Owner: Create Workflow

## Problem

Create Workflow has a useful current/historical split, but retained binary screenshots remain under the docs artifact tree. The agent contract already says raw captures and screenshots should not be loaded by default. The cleanup lane is to decide whether the retained PNG captures should move outside retained docs, be replaced with a compact manifest, or be explicitly marked as archive-only.

## Evidence

- Create Workflow contract says `raw captures and screenshots` are not default-load material.
- Binary captures currently found:
  - `docs/records/artifacts/agent/create-workflow/workspace/captures/2026-05-17-create-after-drag-live.png`
  - `docs/records/artifacts/agent/create-workflow/workspace/captures/2026-05-17-create-after-upload.png`
  - `docs/records/artifacts/agent/create-workflow/workspace/captures/2026-05-17-create-live-session.png`
  - `docs/records/artifacts/agent/create-workflow/workspace/captures/2026-05-17-create-page-current.png`
  - `docs/records/artifacts/agent/create-workflow/workspace/captures/2026-05-17-current-live-chip.png`
- Artifact README says `workspace/` is an archived operational layer for the resolved composer-image incident family.

## Requested Cleanup

1. Decide whether these PNGs are still needed in Git.
2. If not needed, replace them with a compact markdown manifest containing:
   - filename
   - what it proved
   - related report or incident
   - whether source image was moved outside repo or discarded
3. If they are still needed, mark the containing path as archive-only and not default-load.
4. Update the Create Workflow artifact README if the retention rule changes.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm no Create Workflow startup/load policy points agents at screenshot folders by default.
