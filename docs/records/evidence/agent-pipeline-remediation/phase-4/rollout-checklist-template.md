# Phase 4 Rollout Checklist Template

## Run Metadata
- Date:
- Owner:
- Commit SHA:
- Branch:
- Release window:
- Threshold contract version/date:
- Environment mapping note (`local/internal/preview/production`):
- Scope:
  - Endpoints:
  - Out-of-scope confirmation:

## Preconditions
- [ ] Phase 3 exit criteria confirmed green.
- [ ] Master row `M-15` signoff confirmed.
- [ ] Canary and rollback runbooks validated in staging.
- [ ] Non-essential policy/config changes frozen for rollout window.
- [ ] Threshold contract is locked and referenced.

## Ring Plan
| Ring | Start time | Hold duration | Promote criteria summary | Rollback trigger summary | Owner |
| --- | --- | --- | --- | --- | --- |
| Internal verification |  |  |  |  |  |
| Preview canary |  |  |  |  |  |
| Production canary |  |  |  |  |  |
| Production broad rollout |  |  |  |  |  |

## Validation Command Results
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run lint` |  |  |
| `npm -C frontend run type-check` |  |  |
| `npm -C frontend run build` |  |  |
| `npm -C frontend run docs:check` |  |  |
| Targeted tests |  |  |

## Gate Decision
- Go/hold/rollback:
- Rationale:
- Approvers:
