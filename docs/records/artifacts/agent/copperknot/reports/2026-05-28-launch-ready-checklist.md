# ShortPulse Launch-Ready Checklist

Simple ADHD-friendly launch snapshot for current work.

Ship target: `July 2, 2026`

## What Launch-Ready Means

- [ ] No `P0 ship-critical` system is still below its ship floor.
- [x] The last exact-next focused Create/runtime validation set is green on the live `production` branch/worktree.
- [x] `Reference Grid` is no longer an active blocker lane.
- [ ] Security, release docs, and validation gates pass on the `production` path.
- [ ] No score goes up without repo evidence, validation, and a real closeout.

## Current Snapshot

- `P0 systems below floor:` 2
- `Active ship-path blockers:` 0
- `Active local regression reviews:` 0
- `Running lanes:` 0
- `Reviewed-complete lanes awaiting broader rerate:` 1
- `Current launch truth branch:` `production`

## Do Next

- [ ] `Elements workflow` — score `5/10` — ship floor `6/10` — status: exact next lane
  - lane: `approved panel/runtime health`

## Ready After That

- [ ] `Project / workspace persistence` — score `6/10` — ship floor `7/10` — status: second lane
  - lane: `project-workspace-persistence-hardening`
- [ ] `Characters workflow` — score `5/10` — ship floor `6/10` — status: third lane
  - lane: `characters-workflow-hardening`

## Held Inside Copperknot

- [ ] `Create workflow` — score `6/10` — ship floor `7/10` — status: score held after May 28 validation convergence
- [ ] `Security boundaries` — score `7/10` — ship floor `7/10` — status: hosted session cleanup and history-purge judgment still open
- [ ] `Generation recovery / settlement` — score `4/10` — ship floor `7/10` — status: execution complete, score unchanged pending broader runtime rerate

## Reached Floor Earlier And Still Stable

- [x] `Reference Grid` — `7/10` — floor `7/10`
- [x] `Billing / credits` — `7/10` — floor `7/10`
- [x] `Generation submission / polling` — `7/10` — floor `7/10`
- [x] `Auth / identity` — `7/10` — floor `7/10`

## Current Validation Truth

- [x] `node scripts/check_secret_exposure.js`
- [x] `cd frontend && npm run build`
- [x] focused Create/runtime Vitest rerun
  - `8 passed test files`
  - `24 passed / 24 total tests`
- [ ] broader full-suite repo validation is still not re-established by this lane alone

## Full System Checklist

### AI Studio Product

- [ ] `Create workflow` — `6/10` — floor `7/10` — below floor — score held after May 28 validation convergence
- [ ] `Edit workflow` — `6/10` — floor `7/10` — below floor — score held after bounded passes
- [x] `Video workflow` — `6/10` — floor `6/10` — at floor
- [x] `Sound workflow` — `6/10` — floor `6/10` — at floor
- [x] `Reference Grid` — `7/10` — floor `7/10` — at floor
- [ ] `Characters workflow` — `5/10` — floor `6/10` — below floor — third lane
- [ ] `Elements workflow` — `5/10` — floor `6/10` — below floor — exact next lane
- [ ] `Project / workspace persistence` — `6/10` — floor `7/10` — below floor — second lane

### Media

- [x] `Media Library workflow` — `6/10` — floor `6/10` — at floor today, keep stable
- [ ] `Media ingest / save` — `6/10` — floor `7/10` — below floor
- [x] `Media delivery / signing / preview resolution` — `6/10` — floor `6/10` — at floor, but still an active approved-panel hotspot
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

1. Run `Elements workflow`.
2. Reassess `Project / workspace persistence`.
3. Reassess `Characters workflow`.
4. Keep `Create workflow` held at `6/10` unless broader runtime evidence reopens it.
5. Keep `Reference Grid` closed and keep the at-floor rows stable.

## Simple Explanation For Me

The exact-next Create validation lane is no longer red.

Right now:

- the bounded Create/runtime rerun is green
- that did not earn a score lift for Create
- the approved media-panel lane is still fragile in production

So the next action is:

- run `Elements`
- then reassess persistence
- then reassess Characters
