# ShortPulse Launch-Ready Checklist

Simple copy/paste version for sharing current launch work.

Ship target: `July 2, 2026`

## What Launch-Ready Means

- [ ] No `P0 ship-critical` system is still below its ship floor.
- [x] The `Reference Grid` blocker is fixed with fresh live runtime evidence.
- [x] All completed ship-critical lane closeouts have now been reviewed by the Copperknot.
- [ ] Security, release docs, and validation gates pass on the `production` path.
- [ ] No score goes up without repo evidence, validation, and a real closeout.

## Current Snapshot

- `P0 systems below floor:` 3
- `Active ship-path blockers:` 0
- `Running lanes:` 0
- `Reviewed-complete lanes awaiting broader rerate:` 1
- `Held lanes:` 2
- `Current launch truth branch:` `production`

## Paste Next

- [ ] `Characters workflow` — score `5/10` — ship floor `6/10` — status: paste next
  - lane: `characters-workflow-hardening`

## Ready After That

- [ ] `Elements workflow` — score `5/10` — ship floor `6/10` — status: second lane
  - lane: `elements-workflow-hardening`

## Held Inside Copperknot

- [ ] `Project / workspace persistence` — score `6/10` — ship floor `7/10` — status: score held after bounded patch
  - lane: `project-workspace-persistence-hardening`
- [ ] `Edit workflow` — score `6/10` — ship floor `7/10` — status: score held after second bounded pass
  - lane: `edit-workflow-hardening`

## Reached Floor In This Pass

- [x] `Reference Grid` — `7/10` — floor `7/10`
- [x] `Billing / credits` — `7/10` — floor `7/10`
- [x] `Security boundaries` — `7/10` — floor `7/10`
- [x] `Generation submission / polling` — `7/10` — floor `7/10`

## Reviewed Complete But Not Rerated Up Yet

- [ ] `Generation recovery / settlement` — score `4/10` — ship floor `7/10`
  - lane: `generation-recovery-settlement-hardening`
  - status: execution complete, score unchanged pending broader runtime rerate

## Next Wave After The Immediate Paste Set

- [ ] `Media ingest / save` — score `6/10` — ship floor `7/10`
- [ ] `Core data persistence` — score `6/10` — ship floor `7/10`
- [ ] `Storage / file delivery` — score `6/10` — ship floor `7/10`
- [ ] `Create workflow` — score `6/10` — ship floor `7/10`
- [ ] `Provider integrations` — score `6/10` — ship floor `7/10`

## Full System Checklist

### AI Studio Product

- [ ] `Create workflow` — `6/10` — floor `7/10` — below floor
- [ ] `Edit workflow` — `6/10` — floor `7/10` — below floor — held inside Copperknot
- [x] `Video workflow` — `6/10` — floor `6/10` — at floor
- [x] `Sound workflow` — `6/10` — floor `6/10` — at floor
- [x] `Reference Grid` — `7/10` — floor `7/10` — at floor
- [ ] `Characters workflow` — `5/10` — floor `6/10` — below floor — paste next
- [ ] `Elements workflow` — `5/10` — floor `6/10` — below floor — second lane
- [ ] `Project / workspace persistence` — `6/10` — floor `7/10` — below floor — held inside Copperknot

### Media

- [x] `Media Library workflow` — `6/10` — floor `6/10` — at floor today, keep stable
- [ ] `Media ingest / save` — `6/10` — floor `7/10` — below floor
- [x] `Media delivery / signing / preview resolution` — `6/10` — floor `6/10` — at floor today, keep stable
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
- [x] `Security boundaries` — `7/10` — floor `7/10` — at floor

### Operations

- [x] `Admin operations` — `6/10` — floor `6/10` — at floor
- [x] `Observability / incident triage` — `6/10` — floor `6/10` — at floor

## Simple Priority Order

1. Run `Characters workflow`.
2. Run `Elements workflow`.
3. Reassess whether `Project / workspace persistence` needs a new follow-up lane.
4. Reassess whether `Edit workflow` needs a new follow-up lane.
5. Keep the newly at-floor runtime/security rows stable.

## Simple Explanation For My Brother

We are using a system scorecard to get ShortPulse ready to launch.

The basic rule is:

- anything below its ship floor still needs more work
- anything marked `paste next` or `second lane` is a real next-work candidate
- anything at floor is acceptable for now, but still needs validation so it does not regress

Right now the biggest focus is still AI Studio workflows, but the `Reference Grid` blocker is no longer in the way. The next work is `Characters workflow`, then `Elements workflow`, while Copperknot keeps the just-finished Edit and project/workspace lanes tracked internally.
