# Production-Readiness Plan Through 2026-07-02

Purpose: define the current production-readiness plan for moving ShortPulse to a defensible ship bar by `2026-07-02`.

## Mission

Raise ShortPulse to a defensible production-readiness state by reducing hot-path runtime risk, resolving major workflow blockers, tightening system boundaries, and shipping execution-ready handoffs that let specialist agents move fast in parallel.

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

### Phase 1: Baseline lock and first external lanes

- Dates: `2026-05-06` through `2026-05-15`
- Goal:
  - freeze the operating package
  - define the ship bar
  - generate initial handoffs
  - reconcile the first production-only launch-state refresh

### Phase 2: Active blocker and hot-path runtime hardening

- Dates: `2026-05-16` through `2026-05-22`
- Goal:
  - close or re-scope `Reference Grid`
  - move `Edit workflow`
  - package and start the next ship-critical runtime lanes:
    - `Billing / credits`
    - `Security boundaries`
    - `Generation submission / polling`

### Phase 3: Workflow stabilization and persistence confidence

- Dates: `2026-05-23` through `2026-05-29`
- Goal:
  - harden `Project / workspace persistence`
  - address concrete `Characters workflow` trust breaks
  - move `Elements workflow`
  - reassess whether the current AI Studio workflow cluster is converging toward floor

### Phase 4: Platform trust and media boundary hardening

- Dates: `2026-05-30` through `2026-06-12`
- Goal:
  - tighten `Media ingest / save`
  - tighten `Core data persistence`
  - tighten `Storage / file delivery`
  - decide whether `Provider integrations` needs direct hardening before final gates

### Phase 5: Secondary workflow and operator-surface validation

- Dates: `2026-06-13` through `2026-06-19`
- Goal:
  - validate or harden `Create workflow`, `Video workflow`, and `Sound workflow`
  - close remaining `Media Library workflow` and preview follow-ups
  - validate `Observability / incident triage` and `Admin operations`

### Phase 6: Full rerating and release-gate rehearsal

- Dates: `2026-06-20` through `2026-06-26`
- Goal:
  - rerate the below-floor critical systems from current repo truth
  - run the release-gate stack end to end
  - identify remaining holds, waivers, or required cut scope

### Phase 7: Final ship decision window

- Dates: `2026-06-27` through `2026-07-02`
- Goal:
  - resolve final blockers or document explicit waivers
  - confirm the final queue is no longer dominated by below-floor P0 systems
  - decide `ship / hold / waive`

## Priority Lanes

### Lane 1: Active blocker and workflow trust

- Systems:
  - `Reference Grid`
  - `Edit workflow`
  - `Project / workspace persistence`
- Why:
  - this is where the clearest user-visible ship-path friction remains concentrated
  - one active known P0 blocker still lives here

### Lane 2: Runtime and billing integrity

- Systems:
  - `Generation submission / polling`
  - `Generation recovery / settlement`
  - `Billing / credits`
- Why:
  - generation correctness and spend correctness still share a high-risk runtime seam
  - recovery improved, but the broader runtime cluster is not yet at floor

### Lane 3: Platform trust and release safety

- Systems:
  - `Security boundaries`
  - `Core data persistence`
  - `Storage / file delivery`
  - `Media ingest / save`
- Why:
  - these systems decide whether the app can be trusted to launch safely

### Lane 4: Secondary workflow confidence

- Systems:
  - `Characters workflow`
  - `Elements workflow`
  - `Create workflow`
  - `Video workflow`
  - `Sound workflow`
- Why:
  - these workflows should not remain vague or trust-breaking near ship, even when they are not the current P0 set

## Non-Goals For This Window

- Pushing every system to a literal `10/10`.
- Broad rewrites with no direct production-readiness payoff.
- Cleanup work that improves aesthetics more than ship safety.
- Large new feature scope outside the current product surfaces.

## Exit Criteria For July 2

By `2026-07-02`, the Copperknot should be able to show:

1. the current critical-system ratings and why they moved,
2. the resolved or explicitly waived blocker list,
3. the completed validation gates,
4. the remaining residual risks,
5. and a defensible recommendation:
   - `ship`
   - `ship with waivers`
   - `hold`
