# Agent Workspace Stewardship Plan - 2026-05-23

Purpose: define Gottspan's operating plan for turning the agent-workspace audit into organized owner-specific cleanup without absorbing other agents' work.

## Role Boundary

Gottspan is the repo manager and agent manager for this lane.

Gottspan owns:

- repo and agent-space audits
- shared discoverability and index hygiene
- owner-specific handoff creation
- handoff tracking and re-audit
- Gottspan-owned instruction, report, and memory surfaces

Gottspan does not own:

- security remediation, credential/session exposure, RLS/storage security, or secret handling: route to Dave the Security Guy
- commit, push, staging, branch execution, or PR operations: route to Gear Ball
- environment, Supabase, Vercel, deploy, or cutover execution: route to Nuclo
- system scoring, launch queue priority, or ship-floor interpretation: route to Copperknot
- another agent's internal cleanup: create or update a handoff for that owner

## Plan Audit

The original plan was directionally right but incomplete.

What was sound:

- It separated Gottspan's repo/agent management lane from other agents' execution lanes.
- It prioritized active instruction drift before retention polish.
- It treated security as Dave-owned.
- It proposed a tracker rather than relying on chat memory.

What needed tightening:

- The plan needed a durable control surface with owner, priority, status, and done criteria.
- It needed to separate `Gottspan can fix` from `Gottspan must hand off`.
- It needed a closeout definition for handoffs, not just a list of handoffs.
- It needed to include second-wave findings: Gear Ball pre-launch branch wording, Holomony stale absolute paths, Bopper packet/reload hygiene, Change Impact Auditor folder consistency, and Gottspan's own stale branch-report reconciliation.

Second audit update:

- The plan also needed explicit status definitions so `open` does not become a junk drawer.
- It needed a standard owner-run packet format so Gottspan can hand work to agents consistently.
- It needed acceptance checks for Gottspan re-audits, not just a generic "docs:check passed."
- It needed a stale-handoff rule so owner packets do not sit forever without an explicit decision.
- It needed to put `P0` owner handoffs ahead of lower-risk Gottspan-owned cleanup.

## Priority Model

- `P0`: active instruction can send an agent to the wrong branch, wrong checkout, wrong authority, or wrong owner.
- `P1`: agent can function, but default load, ownership, or active contract is confusing.
- `P2`: retention drag, archive clarity, binary/rendered artifact hygiene, status conventions, or index visibility.
- `P3`: consistency polish.

## Definition Of Done

A handoff is done only when:

1. the owning agent runs or explicitly declines the handoff,
2. the owning agent updates its own surfaces or documents a no-change decision,
3. validation passes, usually `npm -C frontend run docs:check`,
4. Gottspan re-audits the result against the original handoff's acceptance checks,
5. the tracker status is updated to `done`, `blocked`, or `superseded`.

## Status Definitions

- `open`: known owner packet exists, but the owner has not run or declined it.
- `queued`: Gottspan has selected it for the next owner-run batch, but no owner result exists yet.
- `prepared`: Gottspan has written the owner-run packet, but no owner receipt is confirmed.
- `dispatched`: Gottspan or the user has delivered the owner-run packet into the owning agent's active channel and is waiting for owner action or a decline.
- `in-progress`: owning agent has started the lane or a human has explicitly assigned it.
- `needs-reaudit`: owning agent reports completion and Gottspan must verify the result.
- `done`: Gottspan verified the result against the handoff and validation evidence.
- `blocked`: owner cannot complete the lane because required access, authority, policy, or product decision is missing.
- `superseded`: later repo changes made the handoff obsolete or folded it into another tracked lane.
- `declined`: owning agent or human owner explicitly decided not to make the change; the reason must be recorded.

## Gottspan Direct-Work Rule

Gottspan may directly edit:

- Gottspan-owned docs under `docs/agents/gottspan-the-admin/`
- shared indexes when the issue is repo discoverability rather than an agent's internal operating policy
- the handoff tracker and audit reports

Gottspan should not directly edit:

- another agent's memory, SOP, contract, retained reports, or workspace files
- another agent's code/tooling lane
- security-owned surfaces except to link or route to Dave-owned material

## Handoff Tracker

| Priority | Status | Owner | Handoff | Acceptance Check | Gottspan Next Action |
| --- | --- | --- | --- | --- | --- |
| P0 | prepared | Nuclo | `handoffs/2026-05-23-nuclo-branch-instruction-reconciliation.md` | Active Nuclo contract leads with production-only pre-launch rule; ladder-era mentions are historical or environment-reference. | Deliver packet to Nuclo, then wait for result and re-audit. |
| P0 | prepared | Gear Ball | `handoffs/2026-05-23-gear-ball-prelaunch-branch-reconciliation.md` | Gear Ball active execution guidance leads with local/GitHub `production` for pre-launch. | Deliver packet to Gear Ball, then wait for result and re-audit. |
| P0 | prepared | Holomony | `handoffs/2026-05-23-holomony-stale-absolute-paths.md` | Active Holomony instruction files have zero stale old-checkout absolute paths. | Deliver packet to Holomony, then wait for result and re-audit. |
| P1 | open | Ophestivus | `handoffs/2026-05-23-ophestivus-contract-artifact-reconciliation.md` | New Ophestivus run can identify active contract, memory, tools, SOP index, and artifact home without reading historical reports. | Queue after P0 drift fixes. |
| P1 | done | Gottspan | `handoffs/2026-05-23-gottspan-branch-report-reconciliation.md` | May 20 branch reports are explicitly historical relative to current pre-launch production-only policy. | Recheck only if branch policy changes again. |
| P1 | done | Shared/Gottspan | `handoffs/2026-05-23-shared-artifact-index-refresh.md` | Active artifact homes are listed explicitly while legacy namespaces remain distinguished. | Recheck during next index drift audit. |
| P2 | open | D-Bug | `handoffs/2026-05-23-d-bug-handoff-status-convention.md` | Handoff README has durable statuses and clearly names runnable handoffs. | Queue after P1 ownership/load-path fixes. |
| P2 | open | Copperknot | `handoffs/2026-05-23-copperknot-retained-artifact-prune.md` | Copperknot retained HTML policy is enforced and old readiness artifacts are archive-clear. | Queue after P1 ownership/load-path fixes. |
| P2 | open | Beeper | `handoffs/2026-05-23-beeper-nonsecurity-retention-diet.md` | Beeper default-load packet is clear and old reports are archive/reference unless tied to active debt. | Queue after Dave-owned security lane is separately accounted for. |
| P2 | open | Create Workflow | `handoffs/2026-05-23-create-workflow-capture-retention.md` | Binary captures are moved, manifested, or explicitly archive-only and not default-load. | Queue after P1 ownership/load-path fixes. |
| P2 | open | Holomony | `handoffs/2026-05-23-holomony-default-load-prune.md` | Packet JSON and HTML material are explicitly non-default load. | Queue after Holomony P0 stale path fix. |
| P2 | open | Bopper | `handoffs/2026-05-23-bopper-workspace-packet-reload-hygiene.md` | Bopper default-load path is short and run packets are intentional retained material, not required startup context. | Queue after higher-priority drift is cleared. |
| P3 | open | Docs/Gottspan | `handoffs/2026-05-23-change-impact-auditor-folder-consistency.md` | Change Impact Auditor is either foldered as an agent or explicitly labeled as a file-based helper. | Decide after active-agent hygiene is stable. |

## Owner-Run Packet Format

When handing work to an owning agent, Gottspan should provide a compact packet:

```text
Run this owner handoff:
<handoff path>

Priority:
<P0/P1/P2/P3>

Scope:
Stay inside your agent-owned surfaces. Do not widen into unrelated repo cleanup.

Definition of done:
- address or explicitly decline the requested cleanup,
- update only owner-appropriate docs/artifacts,
- run `npm -C frontend run docs:check`,
- report changed files and any residual risk.

Return to Gottspan for re-audit when complete.
```

For `P0` handoffs, dispatch should not wait for lower-priority direct Gottspan cleanup.

## Execution Order

1. Dispatch P0 owner handoffs:
   - Nuclo,
   - Gear Ball,
   - Holomony stale paths.
2. While owners run P0 handoffs, Gottspan may do direct Gottspan/shared work only if it does not block P0 dispatch:
   - mark old Gottspan branch reports as historical,
   - refresh shared artifact index if treated as shared repo hygiene.
3. P1 owner handoffs and re-audits:
   - Ophestivus,
   - re-audit P0 results,
   - re-audit shared index result if changed.
4. P2 retention and queue hygiene:
   - D-Bug,
   - Copperknot,
   - Beeper,
   - Create Workflow,
   - Holomony default-load prune,
   - Bopper.
5. P3 consistency:
   - Change Impact Auditor path decision.

## Recurring Audit Checklist

On each future Gottspan agent-space audit, check:

- active branch policy drift
- stale absolute paths
- agent folder entrypoints
- default load path clarity
- artifact index visibility
- binary, HTML, JSON, and packet retention
- active/archive/status conventions
- owner handoffs with stale `open` status
- docs validation

## Stale Handoff Rule

- `P0` handoffs should not remain `open` or `queued` across a meaningful work session without an explicit reason.
- `P1` handoffs should be reviewed in the next Gottspan agent-space audit.
- `P2` and `P3` handoffs can stay queued, but each weekly audit should either leave them open intentionally, downgrade them, supersede them, or move one into the next owner-run batch.
- If a handoff is no longer accurate because the owner changed its workspace independently, mark it `needs-reaudit` or `superseded`; do not silently leave stale instructions in the tracker.

## Current Next Best Action

The first implementation pass is underway:

1. `P0` owner packets are prepared in `2026-05-23-p0-owner-dispatch.md`.
2. Gottspan-owned May 20 branch reports are marked historical relative to the current pre-launch production-only policy.
3. The shared agent artifact index now lists active retained artifact homes explicitly.

Next best action: deliver the `P0` packets into Nuclo, Gear Ball, and Holomony's active work channels, then re-audit each owner result against the packet acceptance checks.
