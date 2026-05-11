# Ophestivus Training Rubric

Purpose: judge Ophestivus workflow quality consistently over time so improvement can be measured, failure modes can be identified, and other agents can be trained against the same standard.

## Relationship To Other Artifacts

- `error-ledger.md` answers: what happened across runs.
- `training-rubric.md` answers: how well the run was handled and what needs to improve.
- `baseline-kpi.md` remains the frozen historical benchmark. This rubric is the reusable scoring method for individual runs.

## When To Use

- After `run your workflow`
- After a difficult `error grab SOP` run
- After a run with multiple Human Review escalations
- When comparing two periods of performance
- When training another agent on the same workflow

## Scoring Model

Score each category from `0` to `4`.

- `0`: failed or missing
- `1`: weak / unreliable
- `2`: partially correct
- `3`: strong
- `4`: excellent

Multiply the category score by the category weight.

Maximum score: `100`.

## Categories

| Category | Weight | What good looks like |
| --- | ---: | --- |
| Evidence gathering | 14 | Uses incident detail, fingerprint family, route/endpoint, timing, event metadata, and code-path inspection before making a root-cause call. |
| Scope call quality | 14 | Correctly distinguishes bounded work from broad/human-review work early, without overreaching or escalating prematurely. |
| Fix quality | 14 | Implements the smallest safe fix or verified-existing-fix path that matches the real failure mode. |
| Validation quality | 14 | Prefers targeted lane-specific checks, matches proof depth to the incident risk tier, verifies recurrence against same-fingerprint evidence, and states when verification is limited. |
| Escalation quality | 12 | Human-review handoffs are clear, appropriately scoped, and contain enough evidence and next steps for a human or another agent. |
| Board discipline | 10 | Moves tickets in the right order, preserves stale-state checks, keeps details compact and accurate, and leaves `Published` untouched. |
| Report quality | 10 | Local report is durable, specific, and includes summary, changes, validation, recurrence, residual risk, and meaningful post-run audit notes. |
| Tooling discipline | 6 | Uses existing helpers well, avoids unnecessary one-off scripts, and identifies real helper friction without inventing process noise. |
| Communication clarity | 6 | States what was actually resolved, what was only filtered, what remains monitored, and what assumptions were not verified. |

## Rating Bands

| Score | Rating | Meaning |
| --- | ---: | --- |
| `96-100` | `10/10` | Workflow quality is at or above the frozen baseline. |
| `90-95` | `9/10` | Strong run with only minor friction or conservatism gaps. |
| `82-89` | `8/10` | Reliable but with clear improvement areas. |
| `70-81` | `7/10` | Noticeable weakness in evidence, validation, or scope control. |
| `<70` | `Needs intervention` | Workflow is drifting or the run quality was not reliable enough. |

## Automatic Downgrades

Apply these regardless of raw score:

- Cap at `8/10` if a ticket moved forward without sufficient recurrence verification.
- Cap at `7/10` if a broad bug should have been escalated but was treated as a bounded fix.
- Cap at `7/10` if unrelated repo-wide failures were treated as the main blocker for a narrow validated lane.
- Cap at `6/10` if the board state became misleading or stale because a stale-state check was skipped.
- Automatic fail if a ticket reaches `Complete` without real evidence that the issue was resolved.

## Training Signals To Extract

For each scored run, write down:

- `Easy class`
  - what kind of incident was handled cleanly
- `Hard class`
  - what kind of incident caused hesitation, escalation, or weak evidence
- `Missing capability`
  - helper, SOP rule, evidence path, or pattern knowledge that would have improved the run
- `Next training target`
  - the next most valuable incident class to train toward

## Run Template

```text
Training rubric:
Run date:
Workflow trigger:
Primary incident:
Ticket:
Outcome:

Evidence gathering:
Scope call quality:
Fix quality:
Validation quality:
Escalation quality:
Board discipline:
Report quality:
Tooling discipline:
Communication clarity:

Raw score:
Automatic downgrade:
Final score:
Rating:

Easy class:
Hard class:
Missing capability:
Next training target:
```

## How To Improve Over Time

Use the rubric to spot patterns, not just single-run mistakes.

- Repeated low `Evidence gathering` scores mean the event-detail path or logs are insufficient.
- Repeated low `Scope call quality` scores mean the stop-rule or taxonomy needs refinement.
- Repeated low `Validation quality` scores mean the test/recheck path is too broad, too weak, or too manual.
- Repeated low `Escalation quality` scores mean the Human Review template or helper needs improvement.
- Repeated low `Tooling discipline` scores mean the helper set is incomplete or poorly documented.

## Guardrails

- Do not rewrite the frozen KPI to match a bad run. Use this rubric to explain drift, then compare against `baseline-kpi.md`.
- Do not score helper-only/tooling-only work with this rubric unless it directly served a real incident workflow.
- Prefer evidence from the local report, board state, and incident-family status checks over memory or chat impressions.
