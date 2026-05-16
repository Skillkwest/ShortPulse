Source-only file. Open the real operator brief here: `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-16-operator-brief.html`

# WHAT CHANGED

- Active ship target is now **July 2, 2026**.
- The repo-plus-worktree audit is complete.
- Three ship-critical lanes that used to be `queue-only` are now real handoffs:
  - `billing-credits-runtime-hardening`
  - `security-boundaries-release-audit`
  - `generation-submission-polling-hardening`
- `Reference Grid` is still the active blocker already running.
- `Generation recovery / settlement` stays reviewed complete, but its score did **not** move yet.

# WHAT YOU CAN PASTE NOW

## ALREADY RUNNING

- `Reference Grid`
  - lane: `reference-grid-styles-drop-blocker`
  - status: `already running`
  - handoff: `docs/agents/system-catalog-agent/handoffs/2026-05-06-reference-grid-styles-drop-blocker.md`

## READY TO PASTE NOW

- `Edit workflow`
  - lane: `edit-workflow-hardening`
  - status: `ready to paste now`
  - handoff: `docs/agents/system-catalog-agent/handoffs/2026-05-06-edit-workflow.md`

- `Billing / credits`
  - lane: `billing-credits-runtime-hardening`
  - status: `ready to paste now`
  - handoff: `docs/agents/system-catalog-agent/handoffs/2026-05-16-billing-credits-runtime-hardening.md`

- `Security boundaries`
  - lane: `security-boundaries-release-audit`
  - status: `ready to paste now`
  - handoff: `docs/agents/system-catalog-agent/handoffs/2026-05-16-security-boundaries-release-audit.md`

- `Generation submission / polling`
  - lane: `generation-submission-polling-hardening`
  - status: `ready to paste now`
  - handoff: `docs/agents/system-catalog-agent/handoffs/2026-05-16-generation-submission-polling-hardening.md`

## READY BUT HOLD

- `Project / workspace persistence`
  - lane: `project-workspace-persistence-hardening`
  - status: `ready but hold`
  - handoff: `docs/agents/system-catalog-agent/handoffs/2026-05-06-project-workspace-persistence.md`
  - why hold: recent hardening landed, but stronger direct production proof is still missing

## NEXT NON-P0 FOLLOW-UP

- `Characters workflow`
  - lane: `characters-workflow-hardening`
  - status: `ready after the current ship-critical set`
  - handoff: `docs/agents/system-catalog-agent/handoffs/2026-05-06-characters-workflow.md`
  - why it matters: fresh production trust-break evidence now exists on `/character`

## REVIEWED COMPLETE

- `Generation recovery / settlement`
  - lane: `generation-recovery-settlement-hardening`
  - status: `reviewed complete`
  - handoff: `docs/systems/next-agent-handoff-generation-recovery-hardening.md`
  - note: keep closed unless the runtime rerate reopens it

# WHAT TO DO NEXT

## IF YOU WANT THE NEXT BEST PRODUCT LANE

- Paste `Edit workflow` next.

## IF YOU WANT PARALLEL PLATFORM RISK REDUCTION

- Paste these next:
  1. `Billing / credits`
  2. `Security boundaries`

## AFTER THAT

- Paste `Generation submission / polling`.

# DO NOT DO YET

- Do **not** reopen `Generation recovery / settlement` yet.
  - reason: it is already reviewed complete and should stay out of exact next-work order for now

- Do **not** move `Project / workspace persistence` ahead of the new runtime lanes yet.
  - reason: the newer evidence is still weaker than the ship-critical runtime/safety gaps

- Do **not** treat local template reports as launch truth.
  - reason: incomplete artifacts are noise until they become real evidence

# NOTES

- The full audit packet is here:
  - `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-16-production-repo-audit-and-dispatch-output.md`
- The exact live queue is here:
  - `docs/agents/system-catalog-agent/prioritized-handoff-queue-2026-07-02.md`
