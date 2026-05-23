# Handoff: Gottspan Branch Report Reconciliation

Owner: Gottspan

## Problem

Gottspan's May 20 reports and retained training-history entries recorded the then-current production-branch posture as an exception to the branch ladder. The repo has since been updated so the current pre-launch phase explicitly uses `production` locally and on GitHub. Those old reports are valid historical evidence, but they now need clear historical/superseded framing so future Gottspan runs do not reload old branch ambiguity as current truth.

## Evidence

- Current root `AGENTS.md` says pre-launch work is production-only through the Copperknot launch decision window ending `2026-07-02`.
- Older Gottspan reports still say the branch ladder remains default or unresolved:
  - `docs/agents/gottspan-the-admin/reports/2026-05-20-branch-policy-decision-packet.md`
  - `docs/agents/gottspan-the-admin/reports/2026-05-20-repo-state-audit.md`
  - `docs/agents/gottspan-the-admin/reports/2026-05-20-weekly-repo-state-report.md`
- `docs/records/artifacts/agent/gottspan-the-admin/training-history.md` contains branch-policy lessons from before the production-only pre-launch rule was written.

## Requested Cleanup

1. Add a short top-of-file historical note to the May 20 branch-policy reports explaining that they predate the current production-only pre-launch rule.
2. Update Gottspan memory or training history only if a concise durable lesson is needed.
3. Do not delete the reports; they document why the branch policy changed.
4. Keep Gottspan's current runtime-load policy tight so old reports stay conditional, not default-load.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm current Gottspan memory points to the production-only pre-launch rule rather than the old exception framing.
