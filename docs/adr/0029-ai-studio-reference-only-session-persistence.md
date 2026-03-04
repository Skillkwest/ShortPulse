# ADR 0029: AI Studio Reference-Only Session Persistence

## Status
Accepted

## Context
The previous AI Studio session persistence shape restored broad workspace and agent state in addition to reference-grid data. This increased coupling and produced regressions across model defaults, panel behavior, and generation readiness when restore/save timing collided with normal UI lifecycle.

We need to preserve continuity of creative reference assets while minimizing cross-surface risk.

Constraints:
1. Existing session API and SQL contracts should remain stable.
2. Restore behavior must not mutate workflow settings or agent/chat state.
3. Rollback to a safe baseline must remain immediate and flag-driven.
4. The rebuild should proceed in narrow slices with hard validation gates.

## Decision
1. Session persistence for AI Studio will be narrowed to **reference-only scope**.
2. Persisted/rehydrated state will include only:
   - reference-grid outputs,
   - quick-slot ids (`curatedReferenceIds`),
   - all-refs suppression ids (`removedFromAllRefsIds`),
   - optional active reference output id.
3. Session persistence will explicitly exclude:
   - workspace settings (`mode`, `selectedTool`, model, panel/property values),
   - agent transcript/input/chat-mode state.
4. Existing session API routes and SQL RPCs remain in place; payload semantics change in client writer/reader.
5. Re-enable rollout order is fixed:
   - restore-only,
   - reference-only write,
   - optional selector/switch UX.

## Consequences
- Positive:
1. Greatly reduced regression blast radius.
2. Clear data ownership boundaries between references and workflow state.
3. Faster rollback path (feature flags) with no DB churn.

- Negative:
1. Users no longer get workspace/panel/chat continuity from session restore.
2. Non-durable local references remain best-effort unless a future durability strategy is added.

- Follow-ups:
1. Implement schema-versioned reference-only writer/reader compatibility.
2. Add diagnostics for skipped non-durable references.
3. Update troubleshooting/runbooks after first code slice.

## Alternatives Considered
1. Keep broad session snapshot with additional guards.
   - Rejected: too much coupling; regression risk remains high.
2. Remove session persistence entirely.
   - Rejected: loses valuable reference continuity use case.
3. Persist everything but disable agent restore only.
   - Rejected: still leaves panel/model/tool restore coupling unresolved.
