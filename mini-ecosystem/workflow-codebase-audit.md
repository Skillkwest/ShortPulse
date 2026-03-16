# Workflow: Codebase Audit

Purpose: run recurring role-based quality audits over the existing codebase using the same production gate discipline.

Status: Active standalone operational workflow.

## Audit cadence target
- Weekly minimum audit pass.
- Additional pass before high-impact releases.

## Inputs
- Current repo state.
- Active issues/incidents/planning priorities.

## Ordered execution flow
1. Create an audit packet from `templates/codebase-audit-template.md`.
2. Product hat: confirm user-impact priority and scope.
3. Engineer hat: identify implementation hotspots and debt.
4. Senior Engineer hat: evaluate architecture/risk regressions.
5. QA hat: evaluate test gaps and regression exposure.
6. Platform/Release hat: evaluate deploy/ops readiness risks.
7. Security hat: evaluate auth/data/isolation/logging risks.
8. Product Design hat: evaluate UX/accessibility consistency risks.
9. Assign gate status for each domain (`PASS/HOLD/FAIL`).
10. Produce ordered remediation actions with owner/date.

## Gate mapping for audits
- Gate A: Audit scope and priority are clear.
- Gate B: Findings are evidence-based and reproducible.
- Gate C: Proposed fixes are technically viable and reviewed.
- Gate D: Remediation plan is release-safe.
- Gate E: Findings are closed or scheduled with explicit ownership.

## Outputs
- Completed audit packet.
- Ranked findings list (high/medium/low).
- Remediation backlog and next audit date.
