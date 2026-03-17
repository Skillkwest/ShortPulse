# ADR 0042: AI Studio Properties Panel Workflow Contract

- Date: 2026-02-23
- Status: Accepted
- Deciders: Frontend Engineering
- Related: `docs/planning/ai-studio-properties-panels-modularization-program.md`

## Context
AI Studio panel orchestration accumulated alias drift and dead wiring:
1. Tool IDs used mixed canonical and legacy aliases.
2. Page content contained duplicated panel switch paths.
3. Character panel prop plumbing existed but was unused.
4. Beginner-mode persistence had an async stale rollback race risk.

These issues increased regression risk and made workflow behavior hard to reason about.

## Decision
1. Introduce canonical workflow identity (`create|edit|video|character|none`) and normalize tool aliases.
2. Keep legacy alias compatibility (`text`, `image`, `kling`, `canvas`) during this cycle.
3. Use a lightweight internal panel registry keyed by canonical workflow ID.
4. Remove dead `propertiesCharacter` path and rely on embedded `CharacterPanel` render path.
5. Expose beginner preference `syncState` and protect writes with request-version stale guards.
6. Apply explicit beginner policy object per workflow panel.

## Consequences
Positive:
1. Panel routing behavior is explicit and testable.
2. Alias handling is centralized.
3. Beginner-mode persistence is safer and observable in UI.
4. Page composition is simpler and avoids dead prop paths.

Tradeoffs:
1. `kling` settings remain separately keyed for compatibility in this cycle.
2. `showCreateTools` remains for now to avoid high-churn cleanup risk.

## Alternatives Considered
1. Full plugin runtime abstraction for panel rendering.
   1. Rejected: unnecessary complexity for current repo size and scope.
2. Introduce XState for workflow transitions.
   1. Rejected: dependency and integration overhead exceeded current need.
3. Immediate alias removal.
   1. Rejected: compatibility regression risk.

## Validation
1. Canonical workflow and alias matrix tests.
2. Panel routing matrix tests.
3. Beginner preference race handling tests.
4. Existing AI Studio/character integration suites.
