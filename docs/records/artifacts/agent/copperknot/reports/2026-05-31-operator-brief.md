Source-only file. Open the real operator brief here: `docs/records/artifacts/agent/copperknot/reports/2026-05-31-operator-brief.html`

# WHAT CHANGED

- The accepted May 31 root fix is now deployed on `production`.
- Confirmed post-deploy reruns now show `extraListCallsPerOpen: 0` and `missingPreviewRatio: 0` on both approved-panel surfaces.
- No score lifts are justified from the post-deploy verification.
- The exact next lane is now `Project / workspace persistence`.

# READY TO PASTE NOW

- `Project / workspace persistence`
  - lane: `project-workspace-persistence-hardening`
  - status: `exact next lane`
  - handoff: `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
  - note: the approved-panel hotspot is no longer the strongest live blocker, so the queue returns to the highest-impact remaining P0 below-floor lane

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

- `Create workflow`
  - status: `score held at 6/10; latest pricing/runtime support move did not reopen the queue`
- `Elements workflow`
  - status: `score held at 5/10 after post-deploy verification; live hotspot materially reduced`
- `Media delivery / signing / preview resolution`
  - status: `stays at floor; live signal is healthier, but still not strong enough for a maturity lift`
- `Security boundaries`
  - status: `at floor, but hosted follow-through still open`

# WHAT TO DO NEXT

- If execution is approved, dispatch `Project / workspace persistence`.
- Do not widen the next lane by momentum just because `Elements workflow` was previously exact next.
- Do not raise `Elements workflow` from the post-deploy verification alone.

# DO NOT DO YET

- Do **not** reopen the approved-panel root-fix handoff as if it were still the next packet.
- Do **not** reopen `Create workflow` without fresh evidence from that lane.
- Do **not** turn the measurement-depth weakness into a tooling lane ahead of the higher-ROI persistence lane.

# NOTES

- Current audit packet:
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-31-approved-panel-post-deploy-verification.md`
- Live queue:
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
