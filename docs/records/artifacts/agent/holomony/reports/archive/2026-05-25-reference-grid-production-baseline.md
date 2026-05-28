# Holomony Run Report - 2026-05-25 - reference-grid-production-baseline

Purpose: retain the first production-only Holomony baseline for `reference-grid` using the checked-in browser perf harness against `https://shortpulse.ai`.

Archive note: this remains useful historical evidence, but it is no longer current health proof after later user-visible production incidents involving slow and broken Reference Grid media.

## Task

- Requested work:
  - execute the first production Reference Grid baseline
- User-approved surface:
  - `reference-grid`
- Environment:
  - `production`
- Branch:
  - `production`
- Database / project target:
  - production `shortpulse.ai`
- KPI or runtime tools used:
  - `npm run test:perf:ai-studio`
  - `window.__shortpulseAiStudioPerf.runReferenceGridAudit()`
  - `window.__shortpulseAiStudioPerf.runStudioShellAudit()`
- Why this lane had better ROI than stopping:
  - the onboarding plan required one real production baseline before any further KPI/tooling or runtime decision could be trusted

## Problem Statement

- Observed hotspot:
  - no measured production Reference Grid baseline existed inside Holomony's retained package
- Why it matters:
  - without one, Holomony could not honestly classify the surface as weak, healthy, or worth further optimization
- Current hypothesis:
  - the checked-in production browser audit path would be enough to classify the dominant state of the surface
- What would count as success:
  - one retained production baseline
  - one bottleneck classification
  - one explicit continue/pivot/stop decision

## Scope

- Surfaces included:
  - `reference-grid`
  - AI Studio shell interaction cost only insofar as it affects the populated Reference Grid runtime
- Surfaces explicitly excluded:
  - `quick-slot-inventory`
  - `character-panel-media-assignment`
  - media panels
  - media modal
  - provider latency
- What was intentionally not touched:
  - runtime code, feature flags, KPI scorer code, deployment, production data
- What evidence was expected:
  - production perf harness output for reference-grid and shell gates

## Action Log

| Step | Surface / Tool                               | Action                                                                                                   | Result                           | Evidence                                 |
| ---- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| 1    | `frontend/tests/e2e/ai-studio-perf.audit.js` | Ran the production browser perf audit against `https://shortpulse.ai` with the configured audit account. | Passed.                          | terminal output captured during this run |
| 2    | `reference-grid`                             | Reviewed gate outcomes at 40 and 60 seeded refs.                                                         | All Reference Grid gates passed. | retained metrics below                   |
| 3    | `studio-shell`                               | Reviewed toolbar/panel/drop gate outcomes while the grid was populated.                                  | All shell gates passed.          | retained metrics below                   |
| 4    | Holomony decision                            | Classified the dominant state of the surface.                                                            | `no clear blocker`               | findings section                         |

## Findings

### What Worked

- Protected-route auth succeeded cleanly against production.
- `runReferenceGridAudit()` passed every gate at both 40 and 60 seeded references.
- `runStudioShellAudit()` passed every shell gate at both 40 and 60 seeded references.
- No long tasks were observed during either audit family.

### What Failed Or Drifted

- No product-path performance blocker was observed in this baseline.
- The remaining weakness is evidence depth, not a surfaced runtime failure:
  - this run came from the checked-in browser audit path, not a richer packet family with media telemetry summaries attached

### What Was Learned

- `reference-grid` is healthy enough to onboard as a Holomony candidate surface without immediately opening a runtime optimization lane.
- The current highest-ROI next step is not performance tuning. It is either:
  - stop here and keep the surface onboarded with this retained baseline, or
  - later add deeper telemetry capture only if a real production incident or user-visible slowdown appears

## KPI / Evidence Packet

- KPI packet:
  - none; this run used the Reference Grid browser perf harness rather than the panel KPI packet format
- KPI score:
  - not applicable
- Evidence quality:
  - good for gate-level production health
  - lighter than a fuller telemetry-rich incident packet
- Test validation:
  - production browser audit only
- Browser/runtime validation:
  - yes
- Derived metrics used:
  - none beyond the checked-in gate calculations
- Missing metrics:
  - no retained `window.__shortpulseMediaPerf` snapshot was attached to this baseline

## Retained Metrics

### Reference Grid

- 40 refs:
  - click p95 `16ms`
  - max input stall `3.2ms`
  - rendered item count p95 `16`
- 60 refs:
  - click p95 `15.4ms`
  - max input stall `2.6ms`
  - rendered item count p95 `24`

### Studio Shell

- 40 refs:
  - toolbar p95 `66.3ms`
  - panel interaction p95 `15.7ms`
  - drop p95 `11.8ms`
  - max input stall `67.7ms`
- 60 refs:
  - toolbar p95 `65.4ms`
  - panel interaction p95 `11.5ms`
  - drop p95 `15.5ms`
  - max input stall `68.8ms`
  - non-grid properties rerenders per output-status tick p95 `2`

## Code / Tooling Follow-Up

- Files changed:
  - none during the baseline run itself
- Tooling created or improved:
  - none during the baseline run itself
- Docs updated:
  - baseline outcome should now inform the inventory state
- What should be reused next time:
  - `PLAYWRIGHT_BASE_URL=https://shortpulse.ai ... npm run test:perf:ai-studio`

## Self Audit

- Score out of 10:
  - 8.8
- Score breakdown:
  - strong production proof for gate health, lighter on telemetry richness
- Confidence:
  - high that there is no clear active Reference Grid performance blocker on production in this baseline
- Hard gate triggered:
  - no
- Weakest category:
  - evidence depth beyond gate results
- Smallest next-run improvement:
  - attach a retained `window.__shortpulseMediaPerf` summary if a later incident needs deeper cause classification
- Did the lane stop at the right point?:
  - yes; this baseline does not justify immediate runtime tuning

## Training Record

- Memory update needed?:
  - yes; record that the first production Reference Grid baseline passed and the dominant classification is `no clear blocker`
- Training-history update needed?:
  - no
- Failure-taxonomy update needed?:
  - no
- Experiment-ledger update needed?:
  - no
- Capability-ladder impact?:
  - `reference-grid` is now baseline-backed enough to remain onboarded without opening an optimization lane
