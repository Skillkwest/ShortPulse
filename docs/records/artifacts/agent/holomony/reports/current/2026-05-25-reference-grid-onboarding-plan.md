# Holomony Run Report - 2026-05-25 - reference-grid-onboarding-plan

Purpose: freeze the audited onboarding plan for bringing `reference-grid` into Holomony's media-performance operating package without widening into adjacent surfaces or treating localhost-oriented tooling as production evidence.

## Task

- Requested work:
  - audit the proposed Reference Grid onboarding plan and update it
- User-approved surface:
  - `reference-grid`
- Environment:
  - `production`
- Branch:
  - `production`
- Database / project target:
  - production `shortpulse.ai` runtime only
- KPI or runtime tools used:
  - `window.__shortpulseAiStudioPerf.runReferenceGridAudit()`
  - `window.__shortpulseAiStudioPerf.runStudioShellAudit()`
  - `window.__shortpulseMediaPerf`
- Why this lane had better ROI than stopping:
  - the repo already has usable production-facing Reference Grid audit primitives, but the onboarding path needed a tighter contract, cleaner stop rules, and an explicit tooling-trust note before any new KPI or optimization work

## Problem Statement

- Observed hotspot:
  - the prior plan was directionally good, but it mixed onboarding, baseline capture, and future KPI expansion too loosely
- Why it matters:
  - without a tighter contract, Holomony could widen into KPI/tooling work before proving the first production Reference Grid baseline
- Current hypothesis:
  - the highest-ROI path is a production-only surface onboarding run using the existing browser audit runtime first, followed by a narrow decision on whether the next lane is runtime triage, measurement hardening, or stop
- What would count as success:
  - one retained production baseline report
  - one bottleneck classification
  - one explicit next-lane decision or stop

## Scope

- Surfaces included:
  - `reference-grid`
- Surfaces explicitly excluded:
  - `quick-slot-inventory`
  - `character-panel-media-assignment`
  - approved media panels
  - media modal
  - provider latency
- What was intentionally not touched:
  - production runtime, deployment, database rows, KPI scorer code, and adjacent surface contracts
- What evidence was expected:
  - production browser audit output
  - production media telemetry inspection
  - retained onboarding report

## Audited Plan

### 1. Preflight

- Confirm the lane is a `reference-grid` onboarding run, not a cross-surface media expansion.
- Confirm production-only verification at `https://shortpulse.ai`.
- Confirm the checked-in Reference Grid browser harnesses now enter `/ai-studio?perfAuditRuntime=1` automatically, but still keep localhost-oriented defaults unless `PLAYWRIGHT_BASE_URL` is pointed at production.
- For the first baseline, prefer direct production browser audit truth over local release-check scripts.

### 2. Freeze the Surface Contract

- Surface id:
  - `reference-grid`
- Run type:
  - `surface onboarding + baseline audit`
- In scope:
  - visible image/video preview speed
  - preview hydration reliability
  - bounded autoplay behavior
  - shell interaction cost while the Reference Grid is populated
  - visible correctness and trust
- Out of scope:
  - Quick Slot Inventory
  - Character panel
  - Media Library panels
  - provider-generation latency
  - KPI scorer expansion before baseline evidence exists

### 3. Freeze the Owner Files

- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPerfAuditRuntime.ts`
- `frontend/lib/mediaPerfTelemetry.ts`

### 4. Capture the First Production Baseline

- On production AI Studio, run:
  - `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
  - `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
- Or use the checked-in production browser audit command:
  - `cd frontend && PLAYWRIGHT_BASE_URL=https://shortpulse.ai PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run test:perf:ai-studio`
- In the same production session:
  - `window.__shortpulseMediaPerf?.clear()`
  - reproduce a Reference Grid-heavy flow
  - inspect:
    - `durationStats()`
    - `signStats()`
    - `resolveStats()`
    - `fallbackStats()`
- Restrict interpretation to `surface: "reference-grid"`.

### 5. Record the Correctness Gates

- no wrong-asset display
- no broken visible cards without recovery
- autoplay remains bounded and viewport-aware
- drag/drop behavior remains correct
- archive/restore trust holds
- shell interactions do not materially degrade as reference count climbs

### 6. Classify the First Bottleneck

Choose exactly one:

- `media hydration/signing`
- `autoplay budget`
- `shell rerender pressure`
- `no clear blocker`

### 7. Retain the Baseline

- Create a retained report in:
  - `docs/records/artifacts/agent/holomony/reports/current/`
- Include:
  - production date
  - exact audit commands or browser calls
  - gate outcomes
  - telemetry summary
  - bottleneck classification
  - explicit continue/pivot/stop recommendation
- Update `media-surface-inventory.md` after the baseline lands.

### 8. Decision Table

- If hydration/signing is weak:
  - run a narrow Reference Grid runtime triage lane next
- If shell gates fail:
  - run a shell isolation/backpressure lane next
- If evidence is too thin or contradictory:
  - improve measurement honesty/tooling first
- If all core gates are healthy:
  - mark the surface onboarded and stop

## Entry And Exit Criteria

### Entry

- user-approved `reference-grid` scope
- production URL fixed to `https://shortpulse.ai`
- dedicated audit account available
- owner files frozen
- explicit adjacent-surface exclusions recorded

### Exit

- one retained production onboarding baseline exists
- one bottleneck classification exists
- one explicit next-lane decision exists
- or the lane stops with a clear `healthy enough, no next change justified` verdict

## Tooling-Trust Note

- Treat these as useful but not production-truth by default:
  - `frontend/tests/e2e/ai-studio-style-drop.audit.js`
  - `frontend/tests/e2e/ai-studio-perf.audit.js`
  - `frontend/scripts/ai-studio-perf-release-check.mjs`
  - `frontend/scripts/media_panel_kpi_capture.mjs`
- Reason:
  - the current checked-in audit helpers still include localhost-oriented defaults and one known `perfAuditRuntime` entry-gap for the style-drop harness
- Operational rule:
  - for the first Reference Grid onboarding baseline, production in-browser audit calls outrank localhost-oriented harnesses

## Do-Not-Expand Rule

- Do not widen this onboarding run into:
  - Quick Slot Inventory
  - Canvas
  - Character panel
  - Media panel KPI refactors
  - general adaptive-media tuning
- Reopen those only if the first production baseline shows a concrete shared bottleneck that makes expansion higher ROI than stopping.

## Self Audit

- Score out of 10:
  - 8.7
- Score breakdown:
  - strong on scope control, evidence hierarchy, and stop criteria; still pending real baseline evidence
- Confidence:
  - high for the onboarding workflow shape
- Hard gate triggered:
  - yes; production-only evidence contract kept local/localhost tooling out of the first-baseline truth path
- Weakest category:
  - current repo tooling trust is still uneven for direct production-reference-grid capture
- Smallest next-run improvement:
  - execute the first retained production baseline and classify the bottleneck
- Did the lane stop at the right point?:
  - yes; the plan is now explicit enough to run without inventing another planning lane
