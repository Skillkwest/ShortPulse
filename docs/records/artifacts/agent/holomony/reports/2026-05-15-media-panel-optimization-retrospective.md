# Holomony Retrospective: Media Panel Optimization Lane

Purpose: synthesize the full media-panel optimization workflow completed in this thread so Holomony can retain what worked, what failed, what drifted, and what should change in future media-performance work.

## Scope

This retrospective covers the full lane that started as Media Library performance and browse-readiness work, then narrowed to the correct in-scope surface:

- AI Studio `Libraries -> Media` panel
- shared media runtime used by that panel
- media preview coverage and repair work that affects panel browse readiness
- media KPI and capture tooling created to measure the panel

Explicitly excluded by the end of the lane:

- the dead standalone `/media-library` page
- generic route-focused optimization not relevant to the AI Studio media panel

## Original Goals

The durable goals that survived the whole lane were:

1. make media browse/load/display faster,
2. make media internals leaner,
3. preserve UI/UX and visible correctness,
4. make derivative-backed video previews the default,
5. reduce normal-path dependence on repair and resolver behavior,
6. measure performance with durable tooling instead of anecdotal judgment.

## What We Changed

### 1. Video preview authority and browse-readiness

We spent a large part of the lane fixing the contract where video rows could save or hydrate with poster-backed or original-only authority instead of clean preview-backed authority.

High-value wins:

- normalized video preview authority across AI Studio save, restore, drag, internal reference, generated output, and server publication/hydration paths
- stopped multiple places from collapsing `previewStoragePath` onto poster storage
- improved write-time poster and preview coverage in server-owned lanes
- added preview-loop generation in server-held video paths
- added repair/backfill tooling for existing rows
- classified and then cleaned orphaned dev rows instead of pretending all missing previews were pipeline bugs

Net result:

- a large amount of browse-time recovery pressure moved upstream into save/persist/repair contracts
- dev orphan backlog was remediated
- video preview coverage work became much more operationally real instead of theoretical

### 2. AI Studio media panel runtime narrowing

Once the user clarified that the real surface is the AI Studio media tab, we corrected the lane and stopped treating the dead standalone route as the main target.

High-value wins:

- narrowed retained checkpoints and phase0 tooling to AI Studio panel/modal reality
- stopped using dead-route assumptions as primary evidence
- fixed the panel first-media-paint event naming
- reduced one unnecessary second `/api/media/list` call when the first page already exhausts the scope
- kept resolver/fallback/signing work more honest and panel-focused

Net result:

- the active lane became materially better aligned to the real product surface
- route drift was reduced
- the panel audit focus is now much cleaner than it was earlier

### 3. KPI, telemetry, and capture tooling

This became a second major lane because raw performance claims were too weak without durable evidence.

High-value wins:

- created a media panel KPI scorer
- hardened the scorer so partial evidence and malformed packets cannot flatter the result
- added coverage caps, critical-failure caps, schema validation, and sample-count sensitivity
- expanded the KPI model to include more panel-feel and correctness-relevant metrics
- created a direct AI Studio panel KPI capture helper
- kept missing measurements null instead of inventing fake confidence

Net result:

- the panel can now be scored in a much more honest way
- the KPI system is meaningfully more reusable across future surfaces
- the repo now has a real media-panel measurement system rather than just ad hoc audits

## What Worked

### Upstream-first fixes worked

The best engineering decisions were the ones that removed bad contracts at the source instead of layering more runtime recovery on top.

Examples:

- write-time preview generation
- preview-authority normalization
- backfill and cleanup tooling
- avoiding poster-as-preview collapse

Why this worked:

- it reduced complexity in the hot browse path
- it improved trust and browse-readiness together
- it produced reusable gains across multiple media surfaces

### Evidence-driven lane changes worked

The strongest directional corrections happened when we used actual environment evidence or live panel inspection instead of codebase vibes.

Examples:

- dev preview coverage counts exposed the true derivative gap
- full dev orphan classification showed when the lane had stopped being a preview-generation problem
- live AI Studio production panel audit showed the panel was stable but not yet fast
- the KPI run exposed weak canonical preview coverage and slow cold open without overclaiming

Why this worked:

- it prevented blind optimization
- it improved stop/go decisions
- it made later tooling much more useful

### Narrowing to the right surface worked

The user correction that the standalone media-library page is dead materially improved the quality of the lane.

Why this worked:

- it removed fake scope
- it prevented route-centric work from masquerading as panel progress
- it forced the tooling and checkpoints to match the actual product surface

### Tooling as product infrastructure worked

Creating the KPI scorer and capture helper was the right move because performance work needs durable instrumentation, not memory of prior chats.

Why this worked:

- it turned one-off audits into reusable operations
- it created a foundation for future Reference Grid and Elements expansion
- it gave Holomony a real operating surface

## What Did Not Work

### Early scope drift cost time

We spent time in lanes that were not the best ROI after the shape of the real problem had already changed.

Examples:

- micro-optimizing browse/controller paths before enough evidence
- continuing poster-vs-preview cleanup slightly longer than ideal
- inheriting route-oriented audit assumptions after the real surface had shifted

Why this was weak:

- it produced some real value but lower value than the best available next step
- it risked turning progress into momentum work

### Environment language drift created confusion

We used `staging` as environment shorthand before the user clarified they wanted dev-environment evidence aligned to the working branch context.

Why this was weak:

- it created avoidable confusion between git branch and runtime environment
- it slightly lowered trust in the workflow even though the code lane stayed in the working branch

Durable lesson:

- always distinguish `branch`, `environment`, and `database` explicitly in performance lanes

### The KPI scorer outran capture ergonomics

For a while, the scoring model was stronger than the packet collection path.

Why this was weak:

- it made the tool harder to use than it should have been
- it left too much room for manual packet assembly

We corrected this by creating the capture helper, but the gap existed for part of the lane.

### Live telemetry availability was inconsistent

At several points, real panel telemetry access was weaker than the repo code suggested it should be.

Why this was weak:

- it slowed confident runtime audit work
- it forced some hybrid capture/inference instead of clean direct measurement

Durable lesson:

- performance tooling must be judged not only by code presence but by whether it is actually reachable in the target surface

## Mistakes And Drift

1. We did not stop the preview-authority normalization sub-lane as early as ideal.
2. We allowed dead-route tooling and route assumptions to stay active too long.
3. We initially used environment shorthand in a way that blurred branch versus runtime context.
4. We created the KPI scorer before the capture path was mature enough.
5. We relied for a while on partially available live telemetry, which weakened some early confidence.

These mistakes were recoverable, and most were later corrected, but they should still be retained as training data.

## Durable Lessons

### Media optimization lessons

1. Upstream preview coverage beats downstream recovery complexity.
2. Canonical preview coverage is both a performance metric and a correctness metric.
3. Stable and correct is not the same thing as fast and lean.
4. Orphaned data problems should become explicit cleanup/remediation lanes, not endless runtime work.
5. Dead surfaces must be removed from active performance lanes as soon as the user clarifies scope.

### Tooling lessons

1. KPI tools must penalize weak evidence.
2. Capture ergonomics matter as much as score design.
3. Missing metrics should stay null; derived metrics should be labeled.
4. Packet schema, sample sufficiency, and impossible-value validation are not optional if the score will guide decisions.
5. Performance tools should be reusable, but surface-specific enough to reflect what users actually feel.

### Workflow lessons

1. Do not continue by momentum alone.
2. Re-center on live evidence whenever the shape of the problem changes.
3. Separate sub-lanes explicitly:
   - preview coverage
   - orphan cleanup
   - panel runtime tuning
   - KPI tooling
4. Always distinguish branch, environment, and database.
5. Narrow the active surface early and keep checkpoints aligned to it.

## Current State

### What is stronger now

- preview authority and browse-readiness contracts are much stronger than at the start
- orphaned dev media rows were remediated
- dead-route drift has been removed from the active panel lane
- the AI Studio panel has better checkpoint and audit alignment
- the KPI tool is now hard enough to be useful for real panel measurement
- the capture helper makes repeatable panel scoring much easier

### What still appears weak

- cold AI Studio panel open time is still not where we want it
- canonical preview coverage on the live production panel is still weak enough to matter
- some live panel measurements remain partial and need repeated capture to improve confidence
- regression/comparison mode for KPI history is still missing

## Holomony Training Implications

Holomony should be trained to:

1. treat performance work as a measurement-first discipline,
2. push preview/readiness fixes upstream before touching runtime recovery,
3. refuse to overclaim from partial evidence,
4. narrow the active surface early,
5. log mistakes and drift as first-class training artifacts,
6. prefer building durable measurement tools when repeated judgment would otherwise stay ad hoc.

## Recommended Next Steps

1. Capture and retain one or more production AI Studio panel KPI packets with the new helper.
2. Use those packets to isolate the next highest-ROI hotspot:
   - cold open,
   - canonical preview coverage,
   - or remaining list/sign churn.
3. Add KPI regression/comparison mode once a small packet history exists.
4. Reuse the same Holomony tooling pattern when expanding to Elements and later Reference Grid.
