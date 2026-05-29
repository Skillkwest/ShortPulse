# Gottspan Reports

Purpose: index durable reports for Gottspan The Admin repo-stewardship work, including admin-surface work when that work needs a standalone durable summary.

## Report Rules

- Keep reports concise and evidence-backed.
- Do not store secrets, tokens, raw environment values, or unnecessary customer-private data.
- Prefer existing canonical report homes under `docs/records/artifacts/agent/` when an SOP already defines one.
- Link reports from Gottspan memory only when they contain reusable lessons.
- Do not load dated reports by default during normal runs; use them only when historical evidence is actually needed.

## Reports

- `run-report-template.md`: compact template for durable Gottspan repo-steward run summaries.
- `weekly-repo-state-report-template.md`: default template for Gottspan's one-report weekly repo-state audit workflow.
- `2026-05-20-weekly-repo-state-report.md`: historical first execution of the weekly repo-state workflow; its branch-ladder/exception language predates the current pre-launch production-only policy.
- `2026-05-20-repo-state-audit.md`: historical first formal Gottspan repo-state audit after the repo-steward pivot; its branch-ladder/exception language predates the current pre-launch production-only policy.
- `2026-05-20-branch-policy-decision-packet.md`: historical branch-policy decision packet; retain as context only, not as current branch instruction.
- `2026-05-23-agent-workspace-audit.md`: agent-folder retention and instruction-drift audit with owner-specific handoff packets under `handoffs/`.
- `2026-05-23-agent-workspace-stewardship-plan.md`: audited execution plan and tracker for agent-workspace handoffs.
- `2026-05-23-p0-owner-dispatch.md`: completed P0 owner-run dispatch record for Nuclo, Gear Ball, and Holomony, with archived result links for each owner.

## Default Naming

Use this filename pattern for the recurring weekly audit:

- `YYYY-MM-DD-weekly-repo-state-report.md`

## Default Load Guidance

For ordinary Gottspan runtime context:

- load templates when drafting a report
- load the most recent dated report only when you need recent precedent
- leave older dated reports out of runtime context unless historical evidence is the task
