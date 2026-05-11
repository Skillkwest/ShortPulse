# Media Library Speed And Lean Roadmap

Purpose: retain the short-form execution roadmap derived from the authoritative 2026-05-10 Media Library lean/speed master plan audit.

## Source of Truth

1. authoritative plan:
   - `docs/records/evidence/media-library-runtime-rebuild/2026-05-10-mlr-6-s1-lean-speed-master-plan-audit.md`
2. Phase 0 prep kit:
   - `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-10-media-library-phase0-execution-checklist.md`

If this roadmap drifts from the master packet, the master packet wins.

## Strategic Summary

1. lock the real browse contract first
2. collapse preview authority so browse has one normal answer per row
3. make derivatives the browse default, especially for video
4. stop wasting cache opportunity through unnecessary signed-URL churn
5. spend work only on visible and near-visible cards
6. simplify the write path so it stops regenerating browse complexity
7. remove dormant surface baggage and strengthen guardrails

## Sequence Order

This is the dependency order.

1. Phase 0: contract and drift lock
2. Phase 1: preview authority collapse
3. Phase 2: derivative coverage and video canonicalization
4. Phase 3: signed-URL reuse and CDN efficiency
5. Phase 4: visible-window scheduling and state churn reduction
6. Phase 5: save/ingest simplification
7. Phase 6: surface and dormant-system cleanup
8. Phase 7: hardening and guardrails
9. Phase 8: experimental optimization

## Overlap Rules

This is the allowed parallelism.

1. image/private signed-URL reuse work may begin after Phase 1 is stable
2. full video cache-policy closeout should wait for Phase 2 to stabilize canonical video assets
3. doc/runtime cleanup may begin once Phase 0 drift is locked, but final closeout should follow earlier implementation decisions
4. guardrail design can start early, but useful thresholds depend on Phases 1 through 4

## Highest ROI Path

1. contract and drift lock
2. preview authority collapse
3. early signed-URL reuse work where preview assets are already stable
4. derivative-first browse, especially video
5. visible-window-only signing and preview prep
6. save-side simplification for drift-prone lanes

## Repo Constraints

1. the list route already owns paging, folder access, optional counts, and first-slice signing
2. the signing runtime is already a real queue/scheduler, so scheduling cleanup is refinement, not greenfield work
3. video browse is still structurally less canonical than image browse
4. mixed/audio panel scopes still need richer metadata than simple image/video-only scopes
5. save-side cleanup is performance work too, because some bulk and staging flows remain serialized or mixed-responsibility
6. stale performance/docs guidance can distort execution if Phase 0 does not lock drift early

## Execution Shape

1. `Track A`: contract lock, preview authority collapse, signed-URL reuse, visible-window scheduling
2. `Track B`: derivative/video canonicalization and write-path simplification
3. `Track C`: surface/doc cleanup, guardrails, and later experiments

## Metrics To Track

1. first visible media paint
2. first decoded image
3. first visible video frame
4. sign-batch calls per open
5. `resolve-previews` call rate
6. storage-download fallback rate
7. repeat-open latency
8. derivative coverage by media type
9. signed-URL churn for representative repeat-open flows

## Non-negotiables

1. no UI/UX changes
2. no behavior changes
3. no new fallback layers
4. no optimization that increases signed-URL churn
5. no hot-path dependence on repair logic
6. no implementation work based on stale doc assumptions
7. no blanket payload trimming that breaks mixed/audio card needs

## Done State

The roadmap is done only when:

1. one canonical preview authority exists for browse rows
2. image/video browse defaults to derivative-backed preview assets
3. repeat browsing reuses signed preview delivery effectively
4. visible-window-only work is the default runtime behavior
5. write-side complexity no longer reintroduces preview drift
6. dormant browse-path baggage and duplicate panel logic are removed or clearly demoted
7. fallback usage is rare, measurable, and no longer part of the normal browse path
8. UI/UX and critical behavior remain unchanged while performance, simplicity, and reliability are materially better

## Plan Memory

1. the main performance ceiling is coordination complexity, not obvious missing indexing
2. Phase 0 is mandatory because doc/runtime drift is now large enough to distort planning
3. the best path is architectural simplification first, experimental browser tricks second
4. derivative coverage is a prerequisite for a truly lean browse path
5. the planning family must stay subordinate to the authoritative packet so sequencing and overlap rules do not drift
