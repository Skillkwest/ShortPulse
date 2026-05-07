# Ophestivus Baseline KPI

Purpose: define the fixed historical performance baseline for Ophestivus workflow runs so future degradation can be measured against the same standard.

## Baseline Status

- Baseline date: 2026-05-02.
- Baseline type: frozen historical KPI.
- Scope: Ophestivus Admin Errors workflow, Review-to-Complete workflow, and post-run training audit workflow.
- Authority: non-authoritative local performance record. Canonical SOPs remain in `docs/sops/`.
- Change rule: do not edit the KPI names, scoring weights, baseline score, or pass/fail thresholds after creation. Future changes belong in a new dated KPI document or an appended observation section, not by rewriting this baseline.

## Baseline Workload

This baseline measures a full `run your workflow` cycle:

1. Run Admin Error intake/resolution SOP.
2. Create or select the correct board ticket.
3. Audit incident evidence before active work.
4. Move ticket through `Backlog -> In progress -> Review`.
5. Implement or verify the smallest safe fix.
6. Validate the fix with targeted tests/checks and recurrence evidence.
7. Write a compact board summary and durable local report.
8. Run Review-to-Complete SOP with stale-state and evidence checks.
9. Move only verified work to `Complete`.
10. Run post-run training audit and record tool/SOP friction.

## Fixed KPI Scorecard

Total score: 100 points.

| KPI | Weight | Baseline standard |
| --- | ---: | --- |
| SOP order fidelity | 12 | Runs intake, evidence load, in-progress move, fix/verification, Review, Complete, and post-run audit in the required order. |
| Real issue handling | 14 | Distinguishes real fixes from error clearing; states whether the resolution fixes product behavior, telemetry routing, config/data, or a verified existing condition. |
| Evidence quality | 12 | Uses incident detail, fingerprint family, event timing, route/endpoint, metadata, and relevant code path before deciding root cause. |
| Validation quality | 12 | Runs targeted tests/checks for touched paths and verifies no fresh same-fingerprint events after the fix or verification timestamp. |
| Board integrity | 10 | Uses dry-runs when supported, preserves stale-state gates, writes useful ticket details, and leaves `Published` untouched. |
| Report quality | 10 | Stores a durable local report with issue, changes, validation, recurrence, residual risk, and post-run audit. |
| Residual risk handling | 8 | Classifies residual risk as `Accepted`, `Monitor`, or `Follow-up`; creates follow-up work only when concrete and untracked. |
| Scope control | 8 | Keeps changes minimal and tied to the active incident; avoids unrelated refactors and unrelated dirty worktree changes. |
| Tooling discipline | 6 | Uses existing Ophestivus helpers instead of ad hoc board mutations or repeated manual snippets. |
| Communication clarity | 8 | Explains what was actually resolved, what was assumed, what remains monitored, and whether more tools are needed. |

## Baseline Performance

- Baseline rating: 10/10.
- Baseline score: 96/100 or higher.
- Minimum acceptable future run: 90/100.
- Degradation warning: any single run below 90/100, or two consecutive runs below 94/100.
- Critical degradation: any run that moves a ticket to `Complete` without proving resolution through required evidence and validation.

## Baseline Evidence

The baseline is anchored to the mature workflow state reached after these representative runs:

- `docs/records/artifacts/agent/ophestivus/reports/2026-05-02-failed-to-fetch-hidden-project-identity-noise-1cdc9df4-3e254edd.md`
- `docs/records/artifacts/agent/ophestivus/reports/2026-05-02-failed-to-fetch-project-identity-retry-c62c2a43-e40a2391.md`

These runs demonstrate the intended standard:

- First run fixed non-actionable hidden localhost/dev project identity noise without suppressing visible failures.
- Second run correctly treated visible recurrence as different evidence and implemented a retry-based behavior fix instead of broad filtering.
- Review approval carried residual risk into the approval note.
- Both runs used recurrence checks, targeted validation, compact ticket summaries, and local reports.

## Run Rating Template

Use this template when comparing a future workflow run against the baseline.

```text
KPI comparison:
Run date:
Ticket:
Incident:
Final board status:
SOP order fidelity:
Real issue handling:
Evidence quality:
Validation quality:
Board integrity:
Report quality:
Residual risk handling:
Scope control:
Tooling discipline:
Communication clarity:
Total score:
Baseline comparison:
Degradation warning:
Corrective action:
```

## Non-Negotiable Failure Conditions

Any future run fails the baseline regardless of numeric score if it:

- Moves a ticket to `Complete` without a Review gate.
- Marks an incident resolved without recurrence or backing-data verification.
- Claims a telemetry-filter fix resolved an underlying product/network condition.
- Suppresses visible or production failures without explicit evidence that they are non-actionable.
- Stores secrets, bearer tokens, service-role keys, or private customer data in a ticket or report.
- Touches unrelated files or reverts other work without explicit authorization.
- Moves anything to `Published` without explicit user instruction.

## Post-Baseline Observations

These notes do not change the frozen KPI weights, baseline score, or thresholds. They clarify how future runs should be judged against the same baseline after the workflow matured further.

### 2026-05-06 Workflow Clarifications

- Correct performance now includes distinguishing runnable backlog work from parked Human Review handoffs.
- `[HUMAN REVIEW]` backlog tickets and tickets containing `*** HUMAN REVIEW REQUIRED ***` are parked escalation handoffs, not active intake work.
- Correct performance includes escalating broad real bugs instead of forcing a shallow code fix just to clear the queue.
- A bounded repo-side fix is not enough for full credit when the originating incident happened on preview/staging and live verification still requires deploy. In that case, correct handling is a Human Review deploy-verification handoff, not a premature move to `Review` or `Complete`.
- Billing-state, control-plane, provider-runtime, and row-level consistency incidents should be judged partly on escalation quality, not only on code change quantity.
- Tooling discipline now specifically includes preferring `ophestivus:escalate-ticket` for Human Review handoffs instead of manual ticket-title/detail compaction.

### Additional Failure Signals To Watch

These do not replace the failure conditions above; they are added warning signs for future comparison:

- Treating a parked Human Review backlog ticket as runnable active work.
- Moving a deploy-gated fix toward `Review` without proving the deployed incident family is actually clean.
- Normalizing away a billing or lifecycle inconsistency without row-level evidence.
- Adding broad retry behavior in worker/control-plane/provider lanes without isolating the failing fetch or settlement site.
