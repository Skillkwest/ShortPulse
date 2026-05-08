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

### Files changed

- list each changed file path

### Summary of what changed

- concise explanation of the completed work

### Validation run

- list commands run
- list what passed
- list what could not be validated

### Blockers encountered

- `none`, or
- list the blocking issue and why it blocked the lane

### Residual risk

- what is still risky, ambiguous, or unproven

### Recommended next step for Catalog Agent review

- whether the lane appears score-lifting
- whether follow-up scope is needed
- whether the queue should change
