# Validation Matrix By Program (2026-05-11)

## Purpose

Define the default validation lanes for each active planning program so closeout checks stop being chosen ad hoc.

This is a retained execution aid, not a rule that every lane must run the largest possible command set. The intent is:

- start with the smallest lane that proves the changed contract
- escalate only when the change crosses a broader boundary
- reserve full sweeps for meaningful checkpoints

## Global Rules

1. Prefer targeted validation first.
2. Run broader validation only when the lane crosses a broader boundary than the targeted check covers.
3. `cd frontend && npm run validate` is a checkpoint command, not the default for every small diff.
4. `bash scripts/run_repo_sweep.sh` is a major breakpoint command, not a routine closeout command.
5. If a lane touches docs/contracts/routes and code, combine the smallest relevant checks from both sides instead of defaulting to the biggest suite.

## Program 0: Execution Authority

Use for:
- planning authority updates
- docs index/governance work
- execution-path changes

Default closeout:
- `node scripts/check_docs_links.js`

Escalate when:
- docs contract/indexing changed broadly
- route/API/doc parity is part of the lane

Checkpoint commands:
- `cd frontend && npm run docs:check`

## Program 1: Runtime And Money

Use for:
- shared runtime behavior
- provider routes
- pricing/debit/control-plane changes
- model-platform/operator workflow changes

Default closeout:
- smallest targeted `vitest` lane that covers the changed runtime seam
- `cd frontend && npm run build` when server/API/runtime entrypoints changed

Add when relevant:
- `node scripts/model_doctor.js` for model/platform, route inventory, or operator-tooling changes
- `cd frontend && npm exec vitest run tests/api/model-catalog-route-coverage.test.ts` for route-authority inventory changes
- `cd frontend && npm exec vitest run tests/api/fal-route-inventory-regression.test.ts` for Fal/Kie wrapper ownership/inventory changes

Checkpoint commands:
- `cd frontend && npm run validate`

Major breakpoint:
- `bash scripts/run_repo_sweep.sh`

## Program 2: Media And Reference Integrity

Use for:
- Media Library behavior
- Reference Grid behavior
- style-drop/media-typing/preview/restore correctness

Default closeout:
- smallest targeted `vitest` lane covering the touched media/reference seam

Add when relevant:
- `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:style-drop`
- `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:audio-exclusivity`
- `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:project-persistence`

Checkpoint commands:
- `cd frontend && npm run validate`

## Program 3: Structural Decomposition

Use for:
- large-file splits
- architecture-boundary cleanup
- modularization passes

Default closeout:
- targeted `vitest` lane for the split surface
- focused ESLint on touched files

Add when relevant:
- `cd frontend && npm run check:size-budget`
- `cd frontend && npm run check:architecture-boundary`

Checkpoint commands:
- `cd frontend && npm run validate`

## Program 4: Workflows And Product Surfaces

Use for:
- workflow-local UI behavior
- page-level product surfaces
- local restore/state behavior not owned by Programs 1–2

Default closeout:
- targeted component/page `vitest` lane for the touched workflow

Add when relevant:
- `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:expert-edit-parity`
- `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:pulse-custom-contract`

Checkpoint commands:
- `cd frontend && npm run validate`

## Program 5: Release Confidence And Research

Use for:
- validation-matrix decisions
- audit/research spikes
- “what should we run?” lanes

Default closeout:
- validate only the script or research artifact you changed

Add when relevant:
- `cd frontend && npm run docs:check`
- `cd frontend && npm run test:agent:contract`
- `cd frontend && npm run test:adaptive-media-runtime`

Checkpoint commands:
- `bash scripts/run_repo_sweep.sh`

## Stop Rule

If you cannot explain why a specific command proves the changed contract better than stopping, do not add that command to the lane.
