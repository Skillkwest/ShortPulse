# Phase 4 Rollout Readiness Checklist (Staging Directive)

## Run Metadata
- Date: 2026-03-20
- Owner: Engineering
- Commit SHA: `c5b0bef0`
- Branch: `editor-fix`
- Release window: Not scheduled (staging-only directive active)
- Threshold contract version/date: `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md` (2026-03-20)
- Environment mapping note (`local/internal/preview/production`):
  - `local`: docs validation in this slice.
  - `internal/preview`: previously exercised in Phase 3 staging evidence.
  - `production`: not exercised; explicitly out of scope under active directive.
- Scope:
  - Endpoints:
    - `/api/ai/studio-agent`
    - `/api/ai/generate-prompt`
    - `/api/ai/describe-image`
  - Out-of-scope confirmation:
    - Production ring execution and broad rollout remain deferred.
    - `fal-submit` implementation changes remain out of scope.

## Preconditions
- [x] Phase 3 exit criteria confirmed green.
- [x] Master row `M-15` signoff confirmed.
  - Note: satisfied via staging-scope waiver packet (`Master Signoff Waived: Staging Scope Only`).
- [x] Canary and rollback runbooks validated in staging.
- [ ] Non-essential policy/config changes frozen for rollout window.
  - Note: no rollout window is active yet under staging-only directive.
- [x] Threshold contract is locked and referenced.

## Ring Plan
| Ring | Start time | Hold duration | Promote criteria summary | Rollback trigger summary | Owner |
| --- | --- | --- | --- | --- | --- |
| Internal verification | Deferred (directive blocked) | 60m / 200 requests minimum | All metrics below hold thresholds for full window and volume | Any rollback-threshold breach => rollback | Platform Ops + AI Platform |
| Preview canary | Deferred (directive blocked) | 4h / 1,000 requests minimum | All metrics below hold thresholds for full window and volume | Any rollback-threshold breach => rollback | Platform Ops + AI Platform |
| Production canary | Deferred (directive blocked) | 24h / 5,000 requests minimum | All metrics below hold thresholds for full window and volume | Any rollback-threshold breach => rollback | Platform Ops + AI Platform |
| Production broad rollout | Deferred (directive blocked) | 48h / 20,000 requests minimum stabilization | Stabilization metrics remain within threshold contract bounds | Any rollback-threshold breach or sustained hold breach => rollback/hold | Platform Ops + AI Platform + Frontend |

## Validation Command Results
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run lint` | Referenced pass (warnings only) | Phase 3 closeout bundle; no new code changes in this slice. |
| `npm -C frontend run type-check` | Referenced pass | Phase 3 closeout bundle; no new code changes in this slice. |
| `npm -C frontend run build` | Referenced pass | Phase 3 closeout bundle; no new code changes in this slice. |
| `npm -C frontend run docs:check` | Pass | Re-ran in this slice after readiness checklist/index updates. |
| Targeted tests | Referenced pass (`37/37`, `9/9`, `16/16`) | From Phase 3 closeout packet. |

## Gate Decision
- Go/hold/rollback: `Hold`
- Rationale:
  - Active owner directive keeps scope staging-only.
  - Production rollout execution remains intentionally blocked pending directive change.
  - Readiness checklist is complete for documentation/prep scope.
- Approvers:
  - Engineering (packet owner)
  - Owner directive reference: staging-only scope lock

## References
1. `docs/records/evidence/agent-pipeline-remediation/phase-4/2026-03-20-phase-4-entry-gate-status-staging-directive.md`
2. `docs/records/evidence/agent-pipeline-remediation/master/2026-03-20-m15-master-signoff-staging-directive-waiver.md`
3. `docs/records/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-closeout-packet-staging-scope.md`
