# Phase 4 Stabilization Window Report Template

## Run Metadata
- Date range:
- Owner:
- Commit range:
- Environment/ring:
- Threshold contract version/date:
- Environment mapping note:

## Objectives
- Confirm steady-state behavior after rollout.
- Detect regression drift versus pre-rollout baseline.

## Metric Deltas
| Metric | Pre-rollout baseline | Stabilization observed | Delta | Threshold | Pass/Fail |
| --- | --- | --- | --- | --- | --- |
| Schema failure rate |  |  |  |  |  |
| Fallback rate |  |  |  |  |  |
| False-refusal rate |  |  |  |  |  |
| Repair rate |  |  |  |  |  |
| p95 latency |  |  |  |  |  |
| Error rate |  |  |  |  |  |

## Incident And Triage Summary
- Total incidents:
- High severity incidents:
- Resolved:
- Open:

## Validation Bundle
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run lint` |  |  |
| `npm -C frontend run type-check` |  |  |
| `npm -C frontend run build` |  |  |
| `npm -C frontend run docs:check` |  |  |
| Targeted tests |  |  |

## Recommendation
- Recommendation: `Proceed | Hold | Rollback`
- Rationale:
- Residual risks:
1.
2.
