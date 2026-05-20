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

### Phase 2: First rerating wave and blocker clearance

- Dates: `2026-05-16` through `2026-05-18`
- Goal:
  - clear or narrow the remaining Reference Grid blocker
  - rerate the first ship-critical lane bundle
  - move Billing, Security, and Generation Submission to floor where justified

### Phase 3: May 19 baseline refresh and local regression absorption

- Dates: `2026-05-19` through `2026-05-22`
- Goal:
  - preserve the May 16 rerating as historical evidence
  - absorb the active May 19 repo-plus-worktree drift into a fresh baseline snapshot
  - validate the live `Create workflow` attachment hardening that landed during the baseline review and keep the row held unless broader evidence justifies more
  - decide whether `Project / workspace persistence` needs a fresh external lane or remains score-held

### Phase 4: Workflow stabilization and persistence confidence

- Dates: `2026-05-23` through `2026-05-29`
- Goal:
  - address concrete `Characters workflow` trust breaks
  - move `Elements workflow`
  - reassess whether the current AI Studio workflow cluster is converging toward floor

### Phase 5: Platform trust and media boundary hardening

- Dates: `2026-05-30` through `2026-06-12`
- Goal:
  - tighten `Media ingest / save`
  - tighten `Core data persistence`
  - tighten `Storage / file delivery`
  - decide whether `Provider integrations` needs direct hardening before final gates

### Phase 6: Secondary workflow and operator-surface validation

- Dates: `2026-06-13` through `2026-06-19`
- Goal:
  - validate or harden `Video workflow` and `Sound workflow`
  - close remaining `Media Library workflow` and preview follow-ups
  - validate `Observability / incident triage` and `Admin operations`

### Phase 7: Full rerating and release-gate rehearsal

- Dates: `2026-06-20` through `2026-06-26`
- Goal:
  - rerate the below-floor critical systems from current repo truth
  - run the release-gate stack end to end
  - identify remaining holds, waivers, or required cut scope

### Phase 8: Final ship decision window

- Dates: `2026-06-27` through `2026-07-02`
- Goal:
  - resolve final blockers or document explicit waivers
  - confirm the final queue is no longer dominated by below-floor P0 systems
  - decide `ship / hold / waive`

## Priority Lanes

### Lane 1: Active local regression and workflow trust

- Systems:
  - `Characters workflow`
  - `Elements workflow`
  - `Create workflow`
- Why:
  - Characters and Elements remain the next unresolved below-floor workflows after the May 19 baseline refresh
  - Create reran green in the current worktree and stayed below floor, so it belongs in the workflow trust cluster without reopening a narrow emergency lane

### Lane 2: Persistence and generation-runtime integrity

- Systems:
  - `Project / workspace persistence`
  - `Edit workflow`
  - `Generation recovery / settlement`
- Why:
  - these are still below-floor systems on the release path
  - May 19 improved persistence confidence, but not enough to move the score
  - recovery remains the biggest shared-runtime holdout

### Lane 3: Platform trust and media boundary hardening

- Systems:
  - `Media ingest / save`
  - `Core data persistence`
  - `Storage / file delivery`
  - `Provider integrations`
- Why:
  - these systems decide whether the app can be trusted to launch safely

### Lane 4: At-floor validation maintenance

- Systems:
  - `Reference Grid`
  - `Security boundaries`
  - `Generation submission / polling`
  - `Billing / credits`
  - `Media delivery / signing / preview resolution`
- Why:
  - these are no longer the weakest rows, but they need ongoing validation so the ship bar does not regress

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
