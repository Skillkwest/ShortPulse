Source-only file. Open the real operator brief here: `docs/records/artifacts/agent/copperknot/reports/2026-05-27-operator-brief.html`

# WHAT CHANGED

- `2026-05-27` full baseline reset is complete.
- The `2026-05-19` brief and queue are now historical, not current launch-control truth.
- The live branch/worktree now includes active motion/video recorder work plus SQL/security grant hardening.
- The current focused validation rerun is red at `8 failed / 26 total tests`.
- `Reference Grid` stays closed as a blocker lane.

# DO NEXT

- `Create workflow`
  - lane: `AI Studio validation convergence`
  - status: `do this next`
  - handoff: `queue-only`
  - note: current failures span AI Studio runtime, prompt policy, media-route sanitization, output ordering, and flag/default behavior

## READY AFTER THAT

- `Elements workflow`
  - lane: `approved panel/runtime health`
  - status: `second lane`
  - handoff: `docs/agents/copperknot/handoffs/2026-05-06-elements-workflow.md`
  - note: Holomony still rates the approved panel lane as fragile on production

- `Project / workspace persistence`
  - lane: `project-workspace-persistence-hardening`
  - status: `third lane`
  - handoff: `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`

# HELD INSIDE COPPERKNOT

- `Characters workflow`
  - status: `no longer exact next by default`
- `Security boundaries`
  - status: `at floor, but hosted session cleanup and history-purge judgment still open`
- `Reference Grid`
  - status: `stay closed as a blocker lane`
- `Generation recovery / settlement`
  - status: `reviewed complete, score unchanged pending broader rerate`

# WHAT TO DO NEXT

- Handle the current `Create workflow` validation-first lane before reviving the older May 19 workflow order.
- After that, use `Elements workflow`.
- Then reassess whether `Project / workspace persistence` or `Characters workflow` is the cleaner next lane on the settled tree.

# DO NOT DO YET

- Do **not** paste the May 19 `Characters workflow` handoff first.
  - reason: the queue basis changed
- Do **not** reopen `Reference Grid`.
  - reason: the May 25 production baseline says there is no clear blocker
- Do **not** claim security is fully quiet yet.
  - reason: the repo guardrails improved, but hosted cleanup follow-through is still open

# NOTES

- New baseline reset:
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-27-production-baseline-reset-audit.md`
- Updated launch checklist:
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-27-launch-ready-checklist.md`
- The exact live queue is here:
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
