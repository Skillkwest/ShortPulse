# P0 Owner Dispatch - 2026-05-23

Purpose: record the first owner-run batch from the agent-workspace stewardship plan.

## Dispatch Rule

These packets are owner-run work. Gottspan tracks and re-audits the result, but the owning agent updates its own active surfaces.

## Owner Packets

### Nuclo

Run this owner handoff:
`docs/agents/gottspan-the-admin/reports/handoffs/2026-05-23-nuclo-branch-instruction-reconciliation.md`

Priority:
`P0`

Scope:
Stay inside Nuclo-owned surfaces. Do not widen into unrelated repo cleanup.

Definition of done:
- address or explicitly decline the requested cleanup,
- update only owner-appropriate docs/artifacts,
- run `npm -C frontend run docs:check`,
- report changed files and any residual risk.

Return to Gottspan for re-audit when complete.

### Gear Ball

Run this owner handoff:
`docs/agents/gottspan-the-admin/reports/handoffs/2026-05-23-gear-ball-prelaunch-branch-reconciliation.md`

Priority:
`P0`

Scope:
Stay inside Gear Ball-owned surfaces. Do not widen into unrelated repo cleanup.

Definition of done:
- address or explicitly decline the requested cleanup,
- update only owner-appropriate docs/artifacts,
- run `npm -C frontend run docs:check`,
- report changed files and any residual risk.

Return to Gottspan for re-audit when complete.

### Holomony

Run this owner handoff:
`docs/agents/gottspan-the-admin/reports/handoffs/2026-05-23-holomony-stale-absolute-paths.md`

Priority:
`P0`

Scope:
Stay inside Holomony-owned surfaces. Do not widen into unrelated repo cleanup.

Definition of done:
- address or explicitly decline the requested cleanup,
- update only owner-appropriate docs/artifacts,
- run `npm -C frontend run docs:check`,
- report changed files and any residual risk.

Return to Gottspan for re-audit when complete.

## Gottspan Follow-Up

- Re-audit Nuclo after owner completion by searching active Nuclo surfaces for `working-development` and confirming remaining mentions are historical or environment-reference.
- Re-audit Gear Ball after owner completion by searching active Gear Ball surfaces for `current user-approved branch` and confirming remaining mentions are historical or future-policy fallback only.
- Re-audit Holomony after owner completion by searching active Holomony instruction surfaces for the stale old-checkout absolute path and confirming zero active-instruction hits.
