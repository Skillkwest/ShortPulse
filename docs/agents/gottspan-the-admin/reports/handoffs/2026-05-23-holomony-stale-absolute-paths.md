# Handoff: Holomony Stale Absolute Path Cleanup

Owner: Holomony

## Problem

Holomony active instructions include absolute filesystem paths pointing at an older repo location under `Desktop Clean/Projects/Coding Projects`. This is dangerous because it can make future Holomony runs load or edit the wrong checkout. Use repo-relative paths unless an absolute path is required by tooling.

## Evidence

Stale absolute paths appear in:

- `docs/agents/holomony/AGENTS.md`
- `docs/agents/holomony/standard-operating-procedure.md`

Examples include:

- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/AGENTS.md`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/features/media-library/`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/holomony/performance-scorecard.md`

Current repo root is:

- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`

## Requested Cleanup

1. Replace stale absolute paths in active Holomony instructions with repo-relative paths.
2. Keep any absolute paths only if a tool requires them, and then make sure they point at the current repo root.
3. Check `docs/agents/holomony/AGENTS.md`, `standard-operating-procedure.md`, and any ownership/load surfaces.
4. Do not rewrite old dated reports unless they are actively loaded by default.

## Validation

- Run `npm -C frontend run docs:check`.
- Run a scoped search for `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse` under Holomony active surfaces and confirm zero active-instruction hits.
