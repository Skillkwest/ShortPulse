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
- archived training-history snapshots when the active summary becomes too long

## What Does Not Belong Here

- authoritative current system ratings
- exact queue authority
- current branch or launch truth duplicated from canonical docs
- broad brainstorming that is no longer helping launch readiness

## Operating Rules

- Keep current truth in the canonical docs under `docs/agents/copperknot/` and `docs/systems/`.
- Treat the primary authority chain as:
  - `docs/systems/catalog.md`
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-06-dispatch-log.md`
  - one freshest retained verification, remeasurement, or baseline packet
- Use this folder to retain evidence and learning, not to create competing authorities.
- If a file here becomes stale and is not helping current launch decisions or future learning, prune or demote it.
- Historical reports may stay preserved, but mark them as non-default reading when they are no longer part of the active launch path.
- Keep `training-history.md` compressed. Move long chronology into dated archive snapshots instead of letting the active file bloat again.
- If retained metric logs lag the latest meaningful launch-state reset or queue change, treat them as historical maintenance aids, not as current truth.

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
