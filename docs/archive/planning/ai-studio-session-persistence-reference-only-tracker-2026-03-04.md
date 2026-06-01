> Archived 2026-06-01 during planning cleanup. Reason: tracker for a documentation-only reference rebuild against the retired `/api/ai/sessions/*` lane; retained as historical context, not active planning authority.

# AI Studio Session Persistence Reference-Only Tracker (2026-03-04)

Status: draft

## Objective

Track execution status for the reference-only session persistence rebuild from a stable hard-off baseline.

## Status Legend

- `DONE`: completed and validated.
- `IN_PROGRESS`: currently being implemented.
- `PENDING`: not started.
- `BLOCKED`: waiting on a dependency/decision.

## Baseline Lock

1. `DONE` Session persistence broad runtime remains hard-off as checkpoint baseline.
2. `DONE` SQL `053` remains applied and valid.
3. `DONE` Documentation packet prepared before reimplementation.

## Workstreams

### A) Slice A: Read/Restore Only

1. `PENDING` Re-enable `sid` identity + restore-candidate loading with writes disabled.
2. `PENDING` Add reference-only hydrator path in state layer.
3. `PENDING` Ensure restore does not mutate workspace/model/tool/panel/agent state.
4. `PENDING` Add telemetry for reference-only restore applied/skipped/error.

### B) Slice B: Reference-Only Writer

1. `PENDING` Add schema v2 reference-only snapshot builder.
2. `PENDING` Wire write-shadow to reference-only payload.
3. `PENDING` Keep debounce/flush behavior unchanged.
4. `PENDING` Keep route/RPC contracts unchanged.

### C) Slice C: Durable Media Restore

1. `PENDING` Re-sign storage-backed outputs on restore.
2. `PENDING` Skip non-durable refs with deterministic diagnostics.
3. `PENDING` Add stale-apply guard to avoid async overwrite races.

### D) Slice D: Session Selector Re-enable (Optional)

1. `PENDING` Re-enable sessions modal only after A-C are green.
2. `PENDING` Enforce save/load behavior to reference projection only.
3. `PENDING` Keep confirm-before-switch UX policy.

### E) Tests

1. `PENDING` Restore-only tests (no workspace/agent mutation).
2. `PENDING` Reference-only writer tests.
3. `PENDING` Media signing + non-durable skip tests.
4. `PENDING` Page/tooling regression tests.

### F) Docs & Runbooks

1. `DONE` Add reference-only architecture plan.
2. `DONE` Add reference-only tracker.
3. `DONE` Add ADR for persistence boundary decision.
4. `DONE` Add SOP runbook for staged rollout and rollback.
5. `PENDING` Update troubleshooting after first code slice lands.

## Validation Commands (to run per slice)

```bash
npm -C frontend run test -- --run <targeted-suite-list>
npm -C frontend run lint
npm -C frontend run build
```

## Manual QA Exit Checklist

1. Session restore affects only reference grid and quick slots.
2. Create/Edit/Video property panels keep current runtime defaults and behavior.
3. Model picker filtering/default behavior remains stable.
4. Character panel layout/scroll interactions remain intact.
5. No unexpected `/api/ai/sessions/save` traffic during restore-only slice.

## Stop Conditions

1. Any workspace/tool/model/agent state is altered by restore.
2. Generate flow regression appears in Create/Edit/Video.
3. Character panel interaction regression appears.
4. Session API begins error-loop traffic.

## Rollback Procedure

1. Disable restore/write feature flags.
2. Revert current slice commit(s) only.
3. Validate baseline with lint/build + manual smoke.
