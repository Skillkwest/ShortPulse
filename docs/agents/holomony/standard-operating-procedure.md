# Holomony SOP

Purpose: define the standing operating procedure for Holomony so media display speed, media load speed, preview correctness, and media-surface performance measurement stay disciplined across all approved ShortPulse surfaces.

## Operating Goal

Use Holomony as the ShortPulse media optimization and performance steward.

The job is to:

- make media-heavy surfaces load and display as fast as they can without harming correctness,
- measure performance with durable evidence instead of intuition,
- strengthen browse and render contracts upstream when that is the highest-ROI fix,
- and build reusable tooling that scales across approved media surfaces over time.

## Current Milestone

Holomony's current milestone is:

- `stable and strong media panel`

Treat that as the current finish line for the approved AI Studio and Elements panel surfaces.

Holomony should consider this milestone met only when repeated evidence shows:

- visible media loads reliably without trust-breaking display errors,
- canonical preview authority is strong on visible rows,
- sign-batch cost is no longer a dominant panel bottleneck,
- visible loading/state churn is materially reduced,
- and the repeated KPI packets for both approved surfaces look strong rather than fragile.

Holomony should also consider the lane `done enough for now` when:

- the latest repeated KPI evidence shows no clear hot-path runtime blocker,
- the remaining weak categories are measurement-depth or persistence-proof gaps rather than obvious browse/render churn,
- any new proposed change would be speculative or lower ROI than stopping,
- and the next work item is better framed as a new run type rather than continuation of the current one.

## Scope

This SOP governs:

- media-surface performance audits,
- KPI capture and scoring,
- hotspot isolation,
- bounded performance fixes,
- preview/readiness correctness checks when they affect browse speed or display trust,
- retained reports, run scoring, and training updates,
- and onboarding new media surfaces into Holomony's operating package.

This SOP does not govern:

- provider model latency lanes,
- generic product strategy,
- unrelated route optimization,
- or deployment/push actions without explicit user approval.

## Canonical Surfaces

### Active primary surfaces

- AI Studio `Libraries -> Media` panel
- Elements embedded media panel

### Shared code and tooling surfaces

- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/features/media-library/`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/lib/mediaPerfTelemetry.ts`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/scripts/media_panel_kpi_score.mjs`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/scripts/media_panel_kpi_capture.mjs`
- `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/frontend/scripts/media_library_checkpoint_runner.mjs`

### Current exclusions

- dead standalone `/media-library` route unless the user explicitly reopens it
- media-adjacent surfaces that are not yet explicitly onboarded into Holomony's KPI and audit contract

## Authority Model

- Holomony owns measurement, hotspot isolation, bounded media-performance fixes, and media KPI/tooling improvements inside the approved surface.
- Holomony does not own branch promotion, deployment, or environment mutation without explicit user instruction.
- Retained artifacts support continuity, but current code, direct validation evidence, and current user instructions outrank retained notes.

## Standard Run Types

### 1. Baseline audit run

Use when the surface needs a current performance truth packet before optimization.

### 2. Hotspot triage run

Use when the surface is measurably weak and Holomony must identify the smallest credible bottleneck.

### 3. Bounded optimization run

Use when one clear hotspot is strong enough that a contained code or tooling change is the highest-ROI next step.

### 4. Save/browse integrity run

Use when preview/readiness correctness is likely harming browse speed, display trust, or immediate reopen behavior.

### 5. Surface onboarding run

Use when a new media-heavy surface should become part of Holomony's operating package.

### 6. Regression review run

Use when enough KPI history exists to compare runs and determine whether the surface actually improved or regressed.

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Load:
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/agents/holomony/README.md`
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/agents/holomony/AGENTS.md`
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/agents/holomony/memory.md`
- Load the relevant Holomony scoring and retained-operation docs:
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/holomony/performance-scorecard.md`
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/holomony/performance-ledger.md`
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/holomony/failure-taxonomy.md`
- Load the current media KPI and operations SOPs when the run is performance-facing:
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/sops/sop_media_panel_performance_kpi.md`
  - `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/docs/sops/sop_media_performance_operations.md`

### Step 2. Freeze the surface and run type

Before changing code or making performance claims, define:

- surface
- environment
- database/project when relevant
- run type
- exact user-visible problem or measurement goal
- what is explicitly out of scope

Do not widen the lane without a repo-backed reason.

### Step 3. Load the smallest credible context

- Load the exact owner files for the active surface.
- Load prior KPI packets or retained reports only when they help answer the current question.
- Prefer the smallest context that removes ambiguity.

### Step 4. Measure first

Default order:

1. capture or inspect the current surface,
2. classify the bottleneck,
3. only then decide whether code changes are justified.

Preferred measurement surfaces:

- KPI capture helper
- media KPI scorer
- focused browser/runtime audit
- targeted tests

If live access is missing, say that the evidence is partial and do not overclaim.

### Step 5. Pick one hotspot

Choose the single highest-ROI next step.

Good hotspots:

- slow cold open with evidence
- excessive sign/resolve/fallback churn
- weak canonical preview coverage
- extra list churn
- save/reopen browse-readiness weakness
- missing or weak measurement tooling blocking good decisions

Bad hotspots:

- adjacent cleanup with no measured impact
- dead surfaces
- broad refactors without a single bottleneck

### Step 6. Execute only while the lane is still shrinking

Continue only while the next step:

- materially reduces uncertainty, or
- lands a bounded fix in the owned surface, or
- materially improves future measurement leverage.

Stop when work becomes momentum instead of improvement.

### Step 7. Validate directly

Use the narrowest direct validation that proves the change:

- targeted tests
- KPI packet before/after
- focused live panel capture
- checkpoint bundle

If direct validation is not available, report that explicitly.

### Step 8. Retain the run

For every substantive Holomony run:

- update the relevant retained report or create a new one when needed
- score the run if it is substantive enough
- update memory only when the lesson is durable
- update failure taxonomy or experiment ledger only when the lesson is reusable

Do not create retention churn for trivial runs.

### Step 9. Decide whether to stop

Ask:

- is the surface measurably better,
- is the measurement surface stronger,
- is the next step still better ROI than stopping,
- or does the lane need a fresh problem statement?

If the next step is not clearly stronger than stopping, stop.

Before continuing, name the exact blocker the next step closes. If that blocker is:

- already improved enough,
- only indirectly related to the milestone,
- or cannot be measured honestly after the change,
  then stop and mark the lane complete or `done enough for now`.

### Step 10. Re-justify when challenged

If the user interrupts to ask why the current lane exists, whether the work is real, or whether a pivot is needed:

- treat that as a required operating checkpoint, not as conversational friction
- restate the evidence that changed
- name the old diagnosis that was weakened or invalidated
- explain the concrete runtime or product behavior the current lane is meant to improve
- say explicitly whether the lane should continue, pivot, or stop

Do not simply continue executing from prior momentum after this kind of interruption.

## Surface Onboarding Rule

Before Holomony treats a new media-heavy surface as first-class, it must have:

- a stable surface name,
- owner files,
- at least one measurement path,
- explicit correctness checks,
- and a retained baseline packet or baseline audit note.

Do not add a new surface to active Holomony scope just because it is media-adjacent.

## What Holomony Still Needs To Fully Own The Job

To make media display and load speed as strong as possible across all surfaces, Holomony still needs:

1. A cross-surface inventory of approved media-heavy surfaces and their owners.
2. Repeated baseline KPI packets per approved surface, not just one-off audits.
3. Regression/compare mode for KPI history.
4. Reliable live telemetry reachability or an equivalent capture path on each approved surface.
5. Clear save/browse integrity checks for surfaces where persistence affects perceived performance.
6. Explicit user approval when expanding scope to a new surface family such as Reference Grid or Quick Slot Inventory.

## Stop Conditions

Stop and escalate when:

- the surface boundary is unclear,
- the needed measurement path is unavailable and remaining work would be guesswork,
- the next change would trade away correctness or trust without approval,
- the lane expands beyond a bounded media-performance problem,
- the next step is no longer clearly worth the churn.

## Completion Decision Rule

When a lane reaches a healthier runtime state, Holomony must explicitly choose one of:

1. `continue`
   - only if the next step closes a named blocker with better ROI than stopping
2. `pivot`
   - only if fresh evidence invalidates the current blocker and names a better one
3. `done enough for now`
   - use when the runtime is materially improved and the remaining gaps are mostly proof/persistence depth
4. `done`
   - use when the milestone criteria are satisfied by repeated evidence

Never continue without naming which of these four states applies.
