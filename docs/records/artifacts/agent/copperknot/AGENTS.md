# AGENTS.md - Copperknot Artifacts

Scope: `docs/records/artifacts/agent/copperknot/`

Use this folder for retained evidence, learning logs, and artifact memory only.

## What Belongs Here

- dated reports
- dispatch tracking
- external lane closeouts
- retained metrics
- training history
- sparse artifact-side memory
- tooling notes

## What Does Not Belong Here

- authoritative current system ratings
- exact queue authority
- current branch or launch truth duplicated from canonical docs
- broad brainstorming that is no longer helping launch readiness

## Operating Rules

- Keep current truth in the canonical docs under `docs/agents/copperknot/` and `docs/systems/`.
- Use this folder to retain evidence and learning, not to create competing authorities.
- If a file here becomes stale and is not helping current launch decisions or future learning, prune or demote it.
- Historical reports may stay preserved, but mark them as non-default reading when they are no longer part of the active launch path.

## Special Paths

- External lane closeouts:
  - `reports/external-lane-closeouts/`
- Time-based learning logs:
  - `metrics/`

## Validation

After edits that affect indexes or linked docs, run:

```bash
npm -C frontend run docs:check
```
