# ShortPulse Launch-Ready Checklist

Simple ADHD-friendly launch snapshot for current work.

Ship target: `July 2, 2026`

## What Launch-Ready Means

- [ ] No `P0 ship-critical` system is still below its ship floor.
- [x] The latest approved-panel post-deploy verification is fresh on the live `production` branch.
- [x] `Reference Grid` is no longer an active blocker lane.
- [ ] Security, release docs, and validation gates pass on the `production` path.
- [ ] No score goes up without repo evidence, validation, and a real closeout.

## Current Snapshot

- `P0 systems below floor:` 3
- `Active ship-path blockers:` 0
- `Active local regression reviews:` 0
- `Running lanes:` 0
- `Reviewed-complete lanes awaiting broader rerate:` 1
- `Current launch truth branch:` `production`

## Do Next

- [ ] `Project / workspace persistence` — score `6/10` — ship floor `7/10` — status: failed production verification; reconcile deployment state and rerun
  - lane: `project-workspace-persistence-hardening`

## Ready After That

- [ ] `Characters workflow` — score `5/10` — ship floor `6/10` — status: second lane
  - lane: `characters-workflow-hardening`
- [ ] `Elements workflow` — score `5/10` — ship floor `6/10` — status: third lane, not dispatch-ready
  - lane: `queue-only`

## Held Inside Copperknot

- [ ] `Project / workspace persistence` — score `6/10` — ship floor `7/10` — status: accepted local root fix reviewed, but first production verification failed
- [ ] `Create workflow` — score `6/10` — ship floor `7/10` — status: score held after May 31 audit; no new queue pressure
- [ ] `Elements workflow` — score `5/10` — ship floor `6/10` — status: post-deploy verification materially reduced the live hotspot, but no score lift
- [ ] `Media delivery / signing / preview resolution` — score `6/10` — ship floor `6/10` — status: stays at floor; live signal is healthier, but still not lift-worthy
- [ ] `Security boundaries` — score `7/10` — ship floor `7/10` — status: hosted session cleanup and history-purge judgment still open
- [ ] `Generation recovery / settlement` — score `4/10` — ship floor `7/10` — status: execution complete, score unchanged pending broader runtime rerate

## Reached Floor Earlier And Still Stable

- [x] `Reference Grid` — `7/10` — floor `7/10`
- [x] `Billing / credits` — `7/10` — floor `7/10`
- [x] `Generation submission / polling` — `7/10` — floor `7/10`
- [x] `Auth / identity` — `7/10` — floor `7/10`

## Current Validation Truth

- [x] `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
- [x] `node frontend/scripts/media_panel_kpi_capture.mjs --surface ai-studio-panel --base-url https://www.shortpulse.ai --format markdown`
- [x] `node frontend/scripts/media_panel_kpi_capture.mjs --surface elements-media-panel --base-url https://www.shortpulse.ai --format markdown`
- [x] confirmed production reruns report:
  - `ai-studio-panel extraListCallsPerOpen: 0`
  - `elements-media-panel extraListCallsPerOpen: 0`
  - `missingPreviewRatio: 0`
  - `coverage: 35%`
- [ ] broader full-suite repo validation is still not re-established by this pass alone

## Full System Checklist

### AI Studio Product

- [ ] `Create workflow` — `6/10` — floor `7/10` — below floor — score held after May 31 audit
- [ ] `Edit workflow` — `6/10` — floor `7/10` — below floor — score held after bounded passes
- [x] `Video workflow` — `6/10` — floor `6/10` — at floor
- [x] `Sound workflow` — `6/10` — floor `6/10` — at floor
- [x] `Reference Grid` — `7/10` — floor `7/10` — at floor
- [ ] `Characters workflow` — `5/10` — floor `6/10` — below floor — second lane
- [ ] `Elements workflow` — `5/10` — floor `6/10` — below floor — third lane, held after post-deploy verification
- [ ] `Project / workspace persistence` — `6/10` — floor `7/10` — below floor — exact next lane

### Media

- [x] `Media Library workflow` — `6/10` — floor `6/10` — at floor today, keep stable
- [ ] `Media ingest / save` — `6/10` — floor `7/10` — below floor
- [x] `Media delivery / signing / preview resolution` — `6/10` — floor `6/10` — at floor, with healthier approved-panel proof
- [x] `Media derivatives / variants` — `6/10` — floor `6/10` — at floor today, keep stable

### Generation Platform

- [x] `Generation submission / polling` — `7/10` — floor `7/10` — at floor
- [ ] `Generation recovery / settlement` — `4/10` — floor `7/10` — below floor — reviewed complete, not rerated up yet
- [ ] `Provider integrations` — `6/10` — floor `7/10` — below floor

### Billing

- [x] `Billing / credits` — `7/10` — floor `7/10` — at floor
- [x] `Pricing / entitlements` — `7/10` — floor `7/10` — at floor

### Platform Foundations

- [x] `Auth / identity` — `7/10` — floor `7/10` — at floor
- [ ] `Core data persistence` — `6/10` — floor `7/10` — below floor
- [ ] `Storage / file delivery` — `6/10` — floor `7/10` — below floor
- [x] `Security boundaries` — `7/10` — floor `7/10` — at floor, but follow-through still open

### Operations

- [x] `Admin operations` — `6/10` — floor `6/10` — at floor
- [x] `Observability / incident triage` — `6/10` — floor `6/10` — at floor

## Simple Priority Order

1. Reconcile whether the accepted `Project / workspace persistence` fix is actually live on `production`.
2. Rerun focused production verification for the project/workspace restore surface.
3. Reassess `Characters workflow` only after persistence clears.
4. Keep `Elements workflow` in follow-up hold unless fresh evidence reopens it.
5. Keep `Reference Grid` closed and keep the at-floor rows stable.

## Simple Explanation For Me

The latest production rerun is better and materially useful, but still not a score-lift packet.

Right now:

- both approved panels now confirm `extraListCallsPerOpen: 0`
- both approved panels keep `missingPreviewRatio: 0`
- the old approved-panel hotspot is no longer the strongest open lane
- evidence depth is still weaker than a full maturity-lift packet

So the next action is now:

- reconcile deployment state for the accepted persistence root fix
- rerun the live restore audit on production
- only then reassess Characters
- keep Elements held unless fresh evidence reopens it
