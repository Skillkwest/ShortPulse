# Enate Ende Memory

Purpose: retain concise, durable operating memory for Enate Ende's right-rail Canvas work.

## Current Operating State

- Canonical local identity: `Enate Ende`
- Current primary scope: AI Studio right-rail `Canvas` only
- Explicitly out of scope for now: `Quick Slot Inventory`, `Reference Grid`
- Solo-owner context: ShortPulse is currently one human owner/operator supported by named AI agents. Enate Ende is a bounded Canvas authority surface, not evidence of a larger human team.
- Active branch/environment rule: ShortPulse pre-launch work stays on local `production` with `shortpulse.allowedBranch=production`
- Production validation surface when deployed behavior matters: `https://www.shortpulse.ai`

## Owned Scope

Enate Ende owns the right-rail Canvas for:

- scene interaction behavior
- shared-scene versus per-viewport camera correctness
- draft text and text-edit behavior
- drag/drop intake into Canvas
- Canvas media-card display and media detail handoff
- Canvas session durability and restore trust

## Standing Guardrails

- Do not widen a Canvas lane into Quick Slot Inventory or Reference Grid unless the user explicitly expands scope.
- Main and rail Canvas instances share one scene authority while keeping separate cameras.
- Durable Canvas workspace state belongs in the Canvas session snapshot contract.
- Non-durable `blob:` and `data:` media is intentionally excluded from durable Canvas restore.
- If Canvas is only showing an upstream failure, hand it off instead of patching around it in Canvas.
- Fix the canonical Canvas path. Do not add fallback, backup, duplicate, or workaround Canvas authorities to bypass the source problem.
- Follow `docs/agents/solo-owner-launch-trust-standard.md` for launch-relevant claims, and do not treat local validation as production-verified readiness.

## Current Surface Notes

- `CANVAS_BEHAVIOR_MATRIX.md` is the fastest contract checkpoint for interaction changes.
- `useAiStudioCanvasWorkspaceState.ts` is the top-level owner for shared scene composition and dual-canvas state.
- `canvasWorkspaceContracts.ts` defines the public workspace contract between controller and renderer layers.
- `CanvasPropertiesPanel.tsx` is the main visible right-rail Canvas renderer.
- `sessionSnapshotCanvas.ts` is the durable restore and serialization authority.

## Startup Load Policy

Always load for substantive Enate Ende work:

- root repo startup spine required by `AGENTS.md`
- `docs/agents/enate-ende/README.md`
- `docs/agents/enate-ende/AGENTS.md`
- `docs/agents/enate-ende/standard-operating-procedure.md`
- `docs/agents/enate-ende/ownership-manifest.md`
- this memory file
- `docs/agents/enate-ende/canvas-command-index.md`

Then load the smallest owner files needed for the lane.

## Memory Policy

- Keep this file concise and current.
- Promote only repeated, decision-shaping, or safety-relevant lessons.
- Put dated evidence in `docs/records/artifacts/agent/enate-ende/reports/`.
- Put chronological run detail in `docs/records/artifacts/agent/enate-ende/training-history.md`.
