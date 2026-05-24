# Gear Ball Current Handoff - 2026-05-23

Owner: Gear Ball
Priority: P0
Source packet: `docs/agents/gottspan-the-admin/reports/handoffs/2026-05-23-gear-ball-prelaunch-branch-reconciliation.md`

## Task

Run the owner handoff for Gear Ball pre-launch branch instruction reconciliation.

## Scope

- Stay inside Gear Ball-owned surfaces.
- Do not widen into unrelated repo cleanup.
- Security work belongs to Dave the Security Guy.
- Environment, Supabase, Vercel, deploy, and cutover execution belong to Nuclo.
- System scoring and launch queue interpretation belong to Copperknot.

## Problem

Gear Ball owns commit/push execution, so active branch language needs to match the current top-level pre-launch policy. Some Gear Ball active surfaces still say `current user-approved branch`, which is weaker than the current repo rule: local and GitHub work target `production` during pre-launch.

## Requested Cleanup

1. Update Gear Ball's active memory and GitHub operations guidance to lead with the pre-launch `production` branch rule.
2. Preserve historical report references to `working-development`; those are past-run evidence, not active instructions.
3. Keep `current user-approved branch` only as a fallback concept for a future explicit policy rewrite, not as the active pre-launch rule.
4. Confirm Gear Ball's hot path still requires checking branch and `shortpulse.allowedBranch`.

## Definition Of Done

- Address or explicitly decline the requested cleanup.
- Update only owner-appropriate docs/artifacts.
- Run `npm -C frontend run docs:check`.
- Report changed files and any residual risk.
- Return to Gottspan for re-audit when complete.

## Re-Audit Check

Gottspan will search Gear Ball active surfaces for `current user-approved branch` and confirm remaining uses are historical or future-policy fallback only.
