# External Lane Closeout Template

Purpose: provide one reusable closeout format for execution agents finishing a System Catalog Agent handoff lane.

## Template

### Title

`External Lane Closeout: <lane-id>`

### Lane Id

`<lane-id>`

### Source handoff path

- `docs/...`

### Execution status

- `bounded patch complete`
- `findings packet complete`
- `blocked with evidence`

### Systems touched

- list the catalog system row or rows this lane materially affected

### Files changed

- list each changed file path

### Summary of what changed

- concise explanation of the completed work

### Acceptance criteria reached

- list which handoff done-state items were actually met
- list any done-state items intentionally not met

### Evidence snapshot

- branch:
- commit(s) reviewed or created:
- if uncommitted, describe the worktree checkpoint used for the closeout:

### Validation run

- list commands run
- list what passed
- list what could not be validated

### Validation evidence

- exact command outputs summarized concisely
- relevant test file names or suite names
- build, lint, or browser/runtime verification notes when used

### Self-audit findings

- what was reviewed after the main implementation or findings pass
- what adjacent regressions, cleanup gaps, or acceptance-criteria misses were checked

### Issues fixed during self-audit

- list each additional in-scope issue fixed after the initial pass
- use `none` if nothing new was found worth fixing inside scope

### Issues intentionally left out of scope

- list each issue noticed but intentionally not fixed
- say whether it belonged to another lane, was blocked, or exceeded lane scope

### Blockers encountered

- `none`, or
- list the blocking issue and why it blocked the lane

### Residual risk

- what is still risky, ambiguous, or unproven

### Recommended next step for Catalog Agent review

- recommended score effect:
  - `no score change`
  - `consider +1`
  - `consider -1`
- why that score effect is justified
- whether follow-up scope is needed
- whether the queue should change

## Send To Catalog Completion

After writing this file, tell the user:

- the closeout filename
- the files changed
- whether the lane is:
  - `bounded patch complete`
  - `findings packet complete`
  - `blocked with evidence`
