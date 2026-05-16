# ShortPulse Launch-Ready Checklist

Simple copy/paste version for sharing current launch work.

Ship target: `July 2, 2026`

## What Launch-Ready Means

- [ ] No `P0 ship-critical` system is still below its ship floor.
- [ ] The active `Reference Grid` blocker is fixed or explicitly waived with fresh evidence.
- [ ] All currently running lanes have closeouts reviewed by the Catalog Agent.
- [ ] Security, release docs, and validation gates pass on the `production` path.
- [ ] No score goes up without repo evidence, validation, and a real closeout.

## Current Snapshot

- `P0 systems below floor:` 6
- `Active ship-path blockers:` 1
- `Running lanes:` 5
- `Reviewed-complete lanes awaiting broader rerate:` 1
- `Held lane:` 1
- `Current launch truth branch:` `production`

## Running Right Now

- [ ] `Reference Grid` — score `6/10` — ship floor `7/10` — status: running
  - lane: `reference-grid-styles-drop-blocker`
- [ ] `Edit workflow` — score `5/10` — ship floor `7/10` — status: running
  - lane: `edit-workflow-hardening`
- [ ] `Billing / credits` — score `6/10` — ship floor `7/10` — status: running
  - lane: `billing-credits-runtime-hardening`
- [ ] `Security boundaries` — score `6/10` — ship floor `7/10` — status: running
  - lane: `security-boundaries-release-audit`
- [ ] `Generation submission / polling` — score `6/10` — ship floor `7/10` — status: running
  - lane: `generation-submission-polling-hardening`

## Held Until Current Lanes Settle

- [ ] `Project / workspace persistence` — score `6/10` — ship floor `7/10` — status: held
  - lane: `project-workspace-persistence-hardening`
  - reason: recent hardening landed, but stronger direct production proof is still missing

## Reviewed Complete But Not Rerated Up Yet

- [ ] `Generation recovery / settlement` — score `4/10` — ship floor `7/10`
  - lane: `generation-recovery-settlement-hardening`
  - status: execution complete, score unchanged pending broader runtime rerate

## Next Wave After Current Running Lanes

- [ ] `Characters workflow` — score `5/10` — ship floor `6/10`
- [ ] `Elements workflow` — score `5/10` — ship floor `6/10`
- [ ] `Media ingest / save` — score `6/10` — ship floor `7/10`
- [ ] `Core data persistence` — score `6/10` — ship floor `7/10`
- [ ] `Storage / file delivery` — score `6/10` — ship floor `7/10`
- [ ] `Create workflow` — score `6/10` — ship floor `7/10`
- [ ] `Provider integrations` — score `6/10` — ship floor `7/10`

## Full System Checklist

### AI Studio Product

- [ ] `Create workflow` — `6/10` — floor `7/10` — below floor
- [ ] `Edit workflow` — `5/10` — floor `7/10` — below floor — running
- [x] `Video workflow` — `6/10` — floor `6/10` — at floor
- [x] `Sound workflow` — `6/10` — floor `6/10` — at floor
- [ ] `Reference Grid` — `6/10` — floor `7/10` — below floor — running
- [ ] `Characters workflow` — `5/10` — floor `6/10` — below floor
- [ ] `Elements workflow` — `5/10` — floor `6/10` — below floor
- [ ] `Project / workspace persistence` — `6/10` — floor `7/10` — below floor — held

### Media

- [ ] `Media Library workflow` — `6/10` — floor `6/10` — at floor today, keep stable
- [ ] `Media ingest / save` — `6/10` — floor `7/10` — below floor
- [ ] `Media delivery / signing / preview resolution` — `6/10` — floor `6/10` — at floor today, keep stable
- [ ] `Media derivatives / variants` — `6/10` — floor `6/10` — at floor today, keep stable

### Generation Platform

- [ ] `Generation submission / polling` — `6/10` — floor `7/10` — below floor — running
- [ ] `Generation recovery / settlement` — `4/10` — floor `7/10` — below floor — reviewed complete, not rerated up yet
- [ ] `Provider integrations` — `6/10` — floor `7/10` — below floor

### Billing

- [ ] `Billing / credits` — `6/10` — floor `7/10` — below floor — running
- [x] `Pricing / entitlements` — `7/10` — floor `7/10` — at floor

### Platform Foundations

- [x] `Auth / identity` — `7/10` — floor `7/10` — at floor
- [ ] `Core data persistence` — `6/10` — floor `7/10` — below floor
- [ ] `Storage / file delivery` — `6/10` — floor `7/10` — below floor
- [ ] `Security boundaries` — `6/10` — floor `7/10` — below floor — running

### Operations

- [x] `Admin operations` — `6/10` — floor `6/10` — at floor
- [x] `Observability / incident triage` — `6/10` — floor `6/10` — at floor

## Simple Priority Order

1. Finish and review the 5 running lanes.
2. Reassess `Project / workspace persistence`.
3. Move into `Characters workflow` and `Elements workflow`.
4. Close the remaining below-floor shared-platform rows.
5. Revalidate the at-floor rows so they do not slip backward.

## Simple Explanation For My Brother

We are using a system scorecard to get ShortPulse ready to launch.

The basic rule is:

- anything below its ship floor still needs more work
- anything running is already assigned to an agent
- anything at floor is acceptable for now, but still needs validation so it does not regress

Right now the biggest focus is stabilizing AI Studio workflows, billing/runtime behavior, and security/release boundaries.
