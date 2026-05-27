# ShortPulse Launch-Ready Checklist

Simple ADHD-friendly launch snapshot for current work.

Ship target: `July 2, 2026`

## What Launch-Ready Means

- [ ] No `P0 ship-critical` system is still below its ship floor.
- [ ] The current focused validation set is green on the live `production` branch/worktree.
- [x] `Reference Grid` is no longer an active blocker lane.
- [ ] Security, release docs, and validation gates pass on the `production` path.
- [ ] No score goes up without repo evidence, validation, and a real closeout.

## Current Snapshot

- `P0 systems below floor:` 2
- `Active ship-path blockers:` 0
- `Active local regression reviews:` 1
- `Running lanes:` 0
- `Reviewed-complete lanes awaiting broader rerate:` 1
- `Current launch truth branch:` `production`

## Do Next

- [ ] `Create workflow` — score `6/10` — ship floor `7/10` — status: exact next lane
  - lane: `AI Studio validation convergence`
  - note: focused rerun is `8 failed / 26 total tests`

## Ready After That

- [ ] `Elements workflow` — score `5/10` — ship floor `6/10` — status: second lane
  - lane: `approved panel/runtime health`
- [ ] `Project / workspace persistence` — score `6/10` — ship floor `7/10` — status: third lane
  - lane: `project-workspace-persistence-hardening`

## Held Inside Copperknot

- [ ] `Characters workflow` — score `5/10` — ship floor `6/10` — status: old exact-next slot retired until the current validation-red state is reduced
- [ ] `Security boundaries` — score `7/10` — ship floor `7/10` — status: hosted session cleanup and history-purge judgment still open
- [ ] `Generation recovery / settlement` — score `4/10` — ship floor `7/10` — status: execution complete, score unchanged pending broader runtime rerate

## Reached Floor Earlier And Still Stable

- [x] `Reference Grid` — `7/10` — floor `7/10`
- [x] `Billing / credits` — `7/10` — floor `7/10`
- [x] `Generation submission / polling` — `7/10` — floor `7/10`
- [x] `Auth / identity` — `7/10` — floor `7/10`

## Current Validation Truth

- [x] `node scripts/check_secret_exposure.js`
- [x] `npm -C frontend run build`
- [ ] focused failing Vitest rerun
  - failing files:
    - `tests/api/error-logging-coverage.test.ts`
    - `tests/api/media-stage-voice-changer-source-route.test.ts`
    - `tests/api/media-stage-voice-clone-source-route.test.ts`
    - `features/ai-studio/hooks/__tests__/useAiStudioOutputCollectionState.test.ts`
    - `tests/api/studio-agent.runtime.workflow-bypass.test.ts`
    - `features/ai-studio/logic/__tests__/perfProfileFlags.test.ts`
    - `features/ai-studio/components/style-creator/__tests__/internalDropResolver.test.ts`
    - `lib/__tests__/agentPromptsConfig.test.ts`

## Full System Checklist

### AI Studio Product

- [ ] `Create workflow` — `6/10` — floor `7/10` — below floor — exact next lane
- [ ] `Edit workflow` — `6/10` — floor `7/10` — below floor — score held after bounded passes
- [x] `Video workflow` — `6/10` — floor `6/10` — at floor
- [x] `Sound workflow` — `6/10` — floor `6/10` — at floor
- [x] `Reference Grid` — `7/10` — floor `7/10` — at floor
- [ ] `Characters workflow` — `5/10` — floor `6/10` — below floor — no longer exact next by default
- [ ] `Elements workflow` — `5/10` — floor `6/10` — below floor — second lane
- [ ] `Project / workspace persistence` — `6/10` — floor `7/10` — below floor — third lane

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

1. Reduce the current `Create workflow` validation-red state.
2. Run `Elements workflow`.
3. Reassess `Project / workspace persistence`.
4. Reassess whether `Characters workflow` is again the best next lane on the settled tree.
5. Keep `Reference Grid` closed and keep the at-floor rows stable.

## Simple Explanation For Me

The repo improved a lot after May 19, but that did not mean the old queue stayed valid.

Right now:

- the branch/worktree has fresher movement than the old queue accounted for
- the approved media-panel lane is still fragile in production
- the focused validation set is currently red

So the next action is not `paste Characters first`.

The next action is:

- stabilize the current Create/runtime validation picture
- then use `Elements`
- then reassess persistence and Characters on the settled tree
