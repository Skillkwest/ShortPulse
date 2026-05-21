# Gottspan Baseline KPI

Purpose: define the fixed historical performance baseline for Gottspan The Admin's repo-stewardship runs so future drift can be measured against the same standard.

## Baseline Status

- Baseline date: 2026-05-20
- Baseline type: frozen historical KPI
- Scope: repo-state audits, docs/SOP governance, admin-subsystem stewardship inside a repo-management frame, and agent-surface stewardship routing
- Authority: non-authoritative local performance record. Canonical repo rules remain in `AGENTS.md`, `docs/dev-ground-rules.md`, and the active Gottspan contract/SOP surfaces.
- Change rule: do not edit KPI names, scoring weights, baseline score, or thresholds after creation. Future changes belong in a new dated KPI document or appended observation notes, not by rewriting this baseline.

## Baseline Workload

This baseline measures a full Gottspan repo-steward run:

1. Run the startup contract.
2. Audit current branch, `shortpulse.allowedBranch`, worktree state, and safety posture.
3. Classify the lane correctly.
4. Load the smallest relevant repo-governance and lane-specific docs.
5. Ground conclusions in direct repo truth.
6. Make the smallest durable stewardship change or produce the correct evidence-backed handoff.
7. Validate doc or repo-governance changes directly.
8. Record durable learnings in the right Gottspan surfaces.
9. Report residual repo risk and the next best owner/action clearly.

## Fixed KPI Scorecard

Total score: 100 points.

| KPI                                  | Weight | Baseline standard                                                                                                                |
| ------------------------------------ | -----: | -------------------------------------------------------------------------------------------------------------------------------- |
| Startup-contract fidelity            |     12 | Loads required governing docs, checks artifact safety posture, and classifies task mode before broad work.                       |
| Repo-posture audit quality           |     14 | Always checks branch, allowed branch, and worktree state before making stewardship claims.                                       |
| Evidence quality                     |     12 | Findings are anchored to direct repo outputs, file references, doc lines, or validation results rather than intuition.           |
| Scope control                        |     10 | Keeps the lane tied to repo stewardship, does not sprawl into unrelated implementation or generic commentary.                    |
| Contract/SOP quality                 |     10 | Writes or updates durable role surfaces cleanly, with clear authority boundaries and reusable workflows.                         |
| Index and discoverability discipline |      8 | New docs, SOPs, templates, and artifact surfaces are indexed where required.                                                     |
| Coordination discipline              |      8 | Correctly distinguishes Gottspan's authority from Ophestivus, Gear Ball, Nuclo, and Copperknot instead of absorbing their roles. |
| Validation quality                   |     10 | Runs relevant docs or repo-governance checks and reports any blocked validation honestly.                                        |
| Residual risk handling               |      8 | Leaves unresolved repo risk explicit and names the right next owner/action.                                                      |
| Training and retention discipline    |      8 | Updates memory, training history, or reports only when the lesson is durable and useful.                                         |

## Baseline Performance

- Baseline rating: 9/10
- Baseline score: 93/100 or higher
- Minimum acceptable future run: 88/100
- Degradation warning: any run below 88/100, or two consecutive runs below 92/100
- Critical degradation: any run that claims repo health without checking branch/worktree posture, or that rewrites governance truth without direct evidence

## Baseline Evidence

This baseline is anchored to the repo-steward pivot and first formal run:

- [training-history.md](./training-history.md)
- [2026-05-20-repo-state-audit.md](../../../../agents/gottspan-the-admin/reports/2026-05-20-repo-state-audit.md)

These runs demonstrate the intended standard:

- the role was redefined from admin-page owner to repo steward
- a standing SOP, checklist, report template, and retained artifact area were created
- the first real audit preserved a branch-ladder contradiction as visible repo risk instead of normalizing it away

## Run Rating Template

Use this template when comparing a future Gottspan run against the baseline.

```text
KPI comparison:
Run date:
Primary lane:
Current branch:
Allowed branch:
Worktree posture:
Startup-contract fidelity:
Repo-posture audit quality:
Evidence quality:
Scope control:
Contract/SOP quality:
Index and discoverability discipline:
Coordination discipline:
Validation quality:
Residual risk handling:
Training and retention discipline:
Total score:
Baseline comparison:
Degradation warning:
Corrective action:
```

## Non-Negotiable Failure Conditions

Any future run fails the baseline regardless of numeric score if it:

- skips branch/worktree/allowed-branch posture checks on a substantive repo-steward lane
- claims repo health without direct evidence
- silently normalizes a branch-ladder contradiction or dirty release-branch posture as acceptable
- rewrites governance, agent, or SOP truth without indexing the new surfaces where required
- stores secrets, tokens, raw environment values, or unnecessary customer-private data in Gottspan reports or artifacts
- absorbs another specialized agent's authority instead of routing to the correct owner when that distinction matters

## Post-Baseline Observations

These notes do not change the frozen KPI weights, baseline score, or thresholds. They clarify how future runs should be judged against the same baseline after the role matures.

### 2026-05-20 Initial Baseline Caveat

- This baseline was created early, after the first real Gottspan repo-state report, because the role pivot itself was a high-value governance change.
- Future Gottspan runs should tighten the baseline with more evidence, not by rewriting this file, but by appending new dated observations or creating a later baseline when the workflow changes materially.
