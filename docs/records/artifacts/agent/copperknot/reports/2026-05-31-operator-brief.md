Source-only file. Open the real operator brief here: `docs/records/artifacts/agent/copperknot/reports/2026-05-31-operator-brief.html`

# WHAT CHANGED

- The May 31 persistence lane returned a real local `root fix` in the canonical project-workspace read path.
- I accepted that fix after rerunning the focused persistence tests and the docs gate.
- The first live production verification still failed.
- The canonicalized project workspace read on production still exposed the orphan generated output class.
- `Project / workspace persistence` remains the exact next launch-readiness lane.

# READY TO DO NOW

- `Project / workspace persistence`
  - lane: `project-workspace-persistence-hardening`
  - status: `production verification failed; deployment reconciliation plus rerun required`
  - handoff: `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
  - note: do not move on to Characters or reopen Elements; the live restore surface still fails the orphan-output class on production

## READY AFTER THAT

- `Characters workflow`
  - lane: `characters-workflow-hardening`
  - status: `second lane`
  - handoff: `docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md`

- `Elements workflow`
  - lane: `post-fix follow-up hold`
  - status: `third lane, not dispatch-ready`
  - handoff: `queue-only`

# HELD INSIDE COPPERKNOT

- `Project / workspace persistence`
  - status: `score held at 6/10 after failed production verification; live restore still not clear`
- `Create workflow`
  - status: `score held at 6/10; latest pricing/runtime support move did not reopen the queue`
- `Elements workflow`
  - status: `score held at 5/10 after post-deploy verification; live hotspot materially reduced`
- `Media delivery / signing / preview resolution`
  - status: `stays at floor; live signal is healthier, but still not strong enough for a maturity lift`
- `Security boundaries`
  - status: `at floor, but hosted follow-through still open`

# WHAT TO DO NEXT

- Reconcile whether the accepted persistence root fix is actually live on `production`.
- Then rerun the project/workspace production verification packet.
- Do not widen the next lane by momentum just because `Elements workflow` was previously exact next.

# DO NOT DO YET

- Do **not** advance to `Characters workflow`.
- Do **not** redispatch `Project / workspace persistence` as if a second fresh implementation pass is already proven to be the right move.
- Do **not** reopen the approved-panel root-fix handoff as if it were still the next packet.
- Do **not** reopen `Create workflow` without fresh evidence from that lane.
- Do **not** turn the current persistence residual risk into a cleanup/migration lane until deployment reconciliation plus rerun say it is necessary.

# NOTES

- Current review packet:
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-production-verification-failure.md`
- Live queue:
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
