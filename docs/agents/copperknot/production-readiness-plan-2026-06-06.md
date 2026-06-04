# Superseded: Production-Readiness Plan Through 2026-06-06

This plan is historical only.

Use the active plan instead:

- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`

Do not use this file for current launch-control decisions.

Purpose: define the current one-month plan for moving ShortPulse to a production ship bar by `2026-06-06`.

## Mission

Raise ShortPulse to a defensible production-readiness state within one month by reducing hot-path runtime risk, resolving major workflow blockers, tightening system boundaries, and shipping execution-ready handoffs that let specialist agents move fast.

## Decision Rule

Optimize for the ship bar, not for prettier numbers.

## Hard Ship Bar

ShortPulse is ship-ready only when all of these are true:

### A. Score floors

- Production-critical hot-path systems are at least `7/10`:
  - `Create workflow`
  - `Edit workflow`
  - `Reference Grid`
  - `Project / workspace persistence`
  - `Media ingest / save`
  - `Generation submission / polling`
  - `Generation recovery / settlement`
  - `Provider integrations`
  - `Billing / credits`
  - `Auth / identity`
  - `Core data persistence`
  - `Storage / file delivery`
  - `Security boundaries`
- Important supporting systems are at least `6/10`:
  - `Video workflow`
  - `Sound workflow`
  - `Characters workflow`
  - `Elements workflow`
  - `Media Library workflow`
  - `Media delivery / signing / preview resolution`
  - `Media derivatives / variants`
  - `Pricing / entitlements`
  - `Admin operations`
  - `Observability / incident triage`

### B. Confidence floors

- Every production-critical system above has `Confidence >= 4`.

### C. Blocker rules

- No active P0 known issue remains unresolved or re-waived with fresh evidence.
- No unresolved auth, security, billing, or recovery integrity defect remains in the release path.

### D. Release gates

- `npm -C frontend run lint`
- `npm -C frontend run test`
- `npm -C frontend run type-check`
- `npm -C frontend run build`
- `npm -C frontend run docs:check`
- `npm -C frontend run deadcode:check`
- deployment route parity passes for the target environment
- runtime SQL security audit passes

## Calendar

### Phase 1: Baseline lock and top-lane scoping

- Dates: `2026-05-06` through `2026-05-12`
- Goal:
  - freeze the operating package
  - define the ship bar
  - generate handoffs for the top execution lanes
  - confirm the current blocker list

### Phase 2: Shared runtime hardening

- Dates: `2026-05-13` through `2026-05-19`
- Goal:
  - lift `Generation recovery / settlement`
  - lift `Generation submission / polling`
  - reduce risk in `Billing / credits`
  - resolve or sharply isolate `Reference Grid` hot-path reliability failures

### Phase 3: Product workflow stabilization

- Dates: `2026-05-20` through `2026-05-26`
- Goal:
  - lift `Edit workflow`
  - harden `Project / workspace persistence`
  - improve `Characters workflow`
  - improve `Elements workflow`

### Phase 4: Platform and release-gate hardening

- Dates: `2026-05-27` through `2026-06-02`
- Goal:
  - close security, storage, and deployment gaps
  - raise confidence in persistence and observability
  - ensure release-checklist paths are genuinely executable

### Phase 5: Final ship decision window

- Dates: `2026-06-03` through `2026-06-06`
- Goal:
  - rerate critical systems
  - run final gates
  - decide `ship / hold / waive`

## Priority Lanes

### Lane 1: Recovery and settlement integrity

- Systems:
  - `Generation recovery / settlement`
  - `Generation submission / polling`
  - `Billing / credits`
- Why:
  - this is the weakest high-impact cluster
  - failures here affect generation correctness, credits, and user trust

### Lane 2: AI Studio workflow stability

- Systems:
  - `Edit workflow`
  - `Reference Grid`
  - `Project / workspace persistence`
- Why:
  - this is where user-visible fragility is concentrated
  - one active known P0 blocker already lives in this cluster

### Lane 3: Secondary workflow confidence

- Systems:
  - `Characters workflow`
  - `Elements workflow`
  - `Video workflow`
  - `Sound workflow`
- Why:
  - lower-confidence or broad-surface workflows should not stay vague near ship

### Lane 4: Platform trust and release safety

- Systems:
  - `Security boundaries`
  - `Storage / file delivery`
  - `Core data persistence`
  - `Observability / incident triage`
  - `Admin operations`
- Why:
  - these systems must support safe launch, support, rollback, and incident response

## Non-Goals For This Window

- Pushing every system to a literal `10/10`.
- Broad rewrites with no direct production-readiness payoff.
- Cleanup work that improves aesthetics more than ship safety.
- Large new feature scope outside the current product surfaces.

## Exit Criteria For June 6

By `2026-06-06`, the Copperknot should be able to show:

1. the current critical-system ratings and why they moved,
2. the resolved or explicitly waived blocker list,
3. the completed validation gates,
4. the remaining residual risks,
5. and a defensible recommendation:
   - `ship`
   - `ship with waivers`
   - `hold`
