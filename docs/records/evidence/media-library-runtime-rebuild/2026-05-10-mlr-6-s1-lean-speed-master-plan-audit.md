# Media Library Lean/Speed Master Plan Audit

## Packet Metadata

- `slice_id`: `MLR-6-S1`
- `date_utc`: `2026-05-10`
- `phase`: `planning rewrite / audit-backed artifact refresh`
- `surface_scope`: `media_library_page`, `media_library_modal`, `media_library_panel`, `embedded_media_panel`, `media ingest/save`, `media delivery/signing/preview resolution`, `media derivatives/variants`
- `risk_class`: `P0 architecture + performance planning`
- `linked_pr_or_commit`: `none (planning/tooling artifacts only)`
- `rollback_note`: `No product/runtime behavior changes. This packet rewrites the planning family and syncs retained artifacts only.`

## Purpose

Rewrite the full Media Library speed/lean planning set so execution starts from one consistent contract:

1. make media open, load, and display faster
2. remove structural and runtime fat without changing UI, UX, or user-visible behavior
3. preserve correctness, access control, and critical systems
4. remove drift between the authoritative plan, the short roadmap, and the Phase 0 preparation kit

## Commands Run

Representative repo audit commands used for this rewrite:

1. `rg -n "resolve-previews|sign-batch|media-library|derivative|preview" frontend docs sql`
2. `sed -n ... frontend/pages/api/media/list.ts`
3. `sed -n ... frontend/pages/api/media/sign-batch.ts`
4. `sed -n ... frontend/pages/api/media/resolve-previews.ts`
5. `sed -n ... frontend/lib/mediaSignedUrlCache.ts`
6. `sed -n ... frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
7. `sed -n ... frontend/features/ai-studio/hooks/useMediaVideoBrowsePreviewUrls.ts`
8. `sed -n ... frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
9. `sed -n ... docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-10-media-library-speed-and-lean-roadmap.md`
10. `sed -n ... docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-10-media-library-phase0-execution-checklist.md`

External research already incorporated into this plan family:

1. Supabase Smart CDN and Storage CDN docs
2. Supabase Storage serving, scaling, uploads, and image transformation docs
3. MDN and web.dev guidance for `content-visibility`, `fetchpriority`, `decode()`, resource hints, and lazy video/media scheduling

## Results

### Audit Summary

1. The main performance ceiling is still coordination complexity, not one isolated bug.
2. The live browse path still has too many authorities:
   - seeded `signedById` from `/api/media/list`
   - client `sign-batch`
   - id-based `/api/media/resolve-previews`
   - optional storage-download hydration
3. Video browse is still structurally less canonical than image browse.
4. Exact-count work, row reshaping, and store churn still sit too close to first-paint-sensitive panel loads.
5. Dormant folder-canvas browse systems remain in docs and code even though live panel surfaces hard-disable them.
6. Save-side responsibilities are still broad enough to reintroduce preview drift and unnecessary latency.
7. Signed-URL churn remains a first-class architecture problem because it likely suppresses private-media CDN warmth.
8. The plan family itself had mild drift:
   - the long packet explained dependencies better than the short roadmap
   - the short roadmap described ROI order but not overlap rules clearly enough
   - the Phase 0 checklist described tools and gates, but not always how it fit into the full execution sequence

### Plan Set Contract

This planning family now has one explicit precedence order:

1. this packet is the authoritative plan and dependency document
2. the short roadmap is the execution summary and ordering reference
3. the Phase 0 checklist is the concrete preparation/runbook for the first gate only

If any future drift appears, this packet wins.

### Planning Principles

1. prefer one canonical preview answer per media row
2. keep repair logic out of the normal browse path
3. spend network, signing, decode, and render work only on the visible or near-visible window
4. make video browse previews first-class derivative assets
5. treat derivative coverage as a performance dependency, not an optional enhancement
6. remove architectural drift and dormant systems so the fast path stays understandable
7. optimize repeat-open behavior, not just first-open behavior

### Post-Implementation Reassessment

Follow-up implementation confirmed that the plan goals remain correct, but execution priority must stay centered on browse-path throughput and complexity reduction.

1. keep:
   - prompt/media active-view effect separation
   - prompt-load in-flight dedupe
2. pause:
   - further prompt/controller no-op tuning
   - rare local-state identity preservation work
3. resume at highest ROI:
   - preview-authority collapse
   - normal-path `resolve-previews` reduction
   - seeded-signing versus client-signing overlap reduction

This reassessment narrows execution priority. It does not replace the plan.

## Rewritten Plan

### Non-negotiables

1. no UI/UX changes
2. no user-visible behavior changes
3. no new fallback layers
4. no new duplicate surface implementations
5. no hot-path dependency on repair logic
6. no optimization that increases signed-URL churn
7. no blanket payload trimming that breaks mixed/audio card needs

### Anti-goals

1. do not start with broad browser/media API experiments
2. do not treat resolver/fallback improvements as the main browse strategy
3. do not optimize around stale docs instead of live code
4. do not ship a faster first open if repeat-open cache behavior gets worse
5. do not treat save-side cleanup as optional if it continues to regenerate browse complexity

### Repo-backed Execution Constraints

1. the list API already owns folder access, keyset paging, optional exact counts, and first-slice signing
2. the preview-signing controller is already a real scheduler with urgent/deferred queue state and visibility-driven batching
3. mixed-feed video browse still signs poster/hover assets from full loaded row sets, so video work is currently broader than the visible card window
4. panel mixed/audio scopes still need richer row payloads than image/video-only scopes
5. bulk move and parts of upload/save remain serialized or mixed-responsibility today
6. performance and Media Library SOPs no longer fully match the live runtime control surfaces

### Execution Shape

This program should run as three coordinated tracks.

1. `Track A: read path and preview authority`
   - Phase 0
   - Phase 1
   - Phase 3
   - Phase 4
2. `Track B: derivatives and write-path simplification`
   - Phase 2
   - Phase 5
3. `Track C: surface/doc cleanup, guardrails, and late experiments`
   - Phase 6
   - Phase 7
   - Phase 8

### Execution Sequence Versus Overlap

There are two ordering rules:

1. `sequence order` controls dependencies and gates
2. `overlap order` controls what can begin early once prerequisites are stable

Sequence order:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8

Allowed overlap:

1. image/private signed-URL reuse work from Phase 3 can begin after Phase 1 is stable
2. video/public-preview cache policy work in Phase 3 should wait for Phase 2 to stabilize canonical video assets
3. Phase 6 doc/runtime cleanup can start once Phase 0 drift is locked, but final closeout should wait until earlier implementation decisions are stable
4. Phase 7 guardrails can be designed early, but meaningful thresholds depend on Phases 1 through 4

### Phase 0: Contract and Drift Lock

Goal: freeze the target architecture and remove ambiguity before implementation.

Work:

1. define the normal browse contract for every media row:
   - grid preview asset
   - full-view asset
   - explicitly allowed fallback path
2. classify every existing lane as either:
   - `hot path`
   - `repair path`
3. reconcile contract drift across:
   - live panel behavior
   - SOPs
   - ADR-facing claims
   - performance tuning docs
4. identify which runtime knobs are real operational controls versus hard-coded behavior
5. capture baseline metrics:
   - first visible media paint
   - first decoded image
   - first visible video frame
   - sign-batch calls per open
   - `resolve-previews` call rate
   - storage-download fallback rate
   - repeat-open latency
6. capture derivative coverage:
   - image thumb coverage
   - video poster coverage
   - video hover-preview coverage
   - backlog size
   - terminal derivative failure classes

Exit criteria:

1. one written browse contract
2. one baseline metric snapshot
3. one derivative coverage snapshot
4. one reconciled doc/runtime drift list
5. one list of real runtime controls versus hard-coded behavior
6. one retained preparation packet from the Phase 0 bundle and supporting audits

Dependencies:

1. none

### Phase 1: Preview Authority Collapse

Goal: reduce browse open to the smallest possible number of steps.

Work:

1. shrink the browse path toward:
   - `list -> authoritative preview fields -> sign/render`
2. demote `/api/media/resolve-previews` to exception/repair duty
3. remove first-paint-sensitive exact-count work from default panel/media opens
4. reduce row normalization and preview-state duplication in the active fetch path
5. reduce broad store cloning during small preview updates
6. define the one authority that chooses the browse preview for each row
7. keep payload trimming scope-aware:
   - image/video-only scopes can be leaner
   - mixed/audio scopes may still need expanded metadata until card contracts are simplified

Exit criteria:

1. first open no longer depends on preview repair logic
2. fewer authorities decide preview URLs
3. lower initial browse latency
4. lower fallback usage on normal browse
5. one clear preview-selection authority exists in the implementation plan
6. scope-specific payload needs are explicitly documented

Dependencies:

1. Phase 0

### Phase 2: Derivative Coverage and Video Canonicalization

Goal: make lightweight preview assets the default browse currency.

Work:

1. make image thumbs the standard browse asset
2. make video posters mandatory browse assets
3. make hover-preview videos canonical where hover-preview behavior exists
4. backfill missing variants and classify gaps by failure reason
5. prefer immutable/versioned derivative paths over mutable overwrite semantics
6. treat video browse as a derivative-backed system rather than a read-time inference problem
7. treat current image/video asymmetry as a first-class blocker

Exit criteria:

1. high variant coverage for active rows
2. mixed `All Media` feed mostly serves derivative assets
3. video browse reliability approaches image browse reliability
4. browse surfaces rarely infer video preview assets at runtime
5. video derivative coverage is no longer materially weaker than image derivative coverage

Dependencies:

1. Phase 0
2. Phase 1 planning contract

### Phase 3: Signed URL Reuse and CDN Efficiency

Goal: stop defeating private-media cache behavior with unnecessary URL churn.

Work:

1. reuse signed URLs more aggressively for the same preview assets
2. reduce unnecessary re-signing and forced refresh behavior
3. review TTL/reuse policy for private preview assets
4. evaluate whether any canonical derivatives without meaningful per-user restriction can move to a more cache-efficient delivery model
5. add measurable cache diagnostics where possible
6. treat immutable/versioned preview-path policy as part of cache-efficiency work

Exit criteria:

1. lower re-sign frequency on repeat browse
2. better repeat-open latency
3. explicit policy for signed-URL reuse and refresh
4. signed-URL churn is measurable and regression-tested
5. versioning/path strategy no longer undermines cache reuse

Dependencies:

1. Phase 1 for preview authority simplification
2. Phase 2 for final closeout on stable video preview assets

### Phase 4: Visible-Window Scheduling and State Churn Reduction

Goal: do expensive work only where the user can benefit.

Work:

1. sign only visible and near-viewport cards
2. stop page-wide poster/hover prep for full loaded pages
3. make urgent/deferred queue boundaries stricter
4. defer non-urgent cache/store updates away from critical interactions
5. reduce repeated entity/store churn that is not user-visible

Exit criteria:

1. lower signing work per scroll/open
2. better scroll smoothness
3. lower main-thread pressure during browse
4. lower non-visible state churn during browse

Dependencies:

1. Phase 1
2. Phase 2

### Phase 5: Save/Ingest Simplification

Goal: simplify the write path so read-side complexity does not keep regenerating.

Work:

1. split upload, remote-copy, generated-media save, and voice staging responsibilities
2. ensure ingest writes canonical preview expectations clearly
3. parallelize multi-file uploads and moves with bounded concurrency
4. remove mixed-responsibility logic from oversized save/copy files
5. explicitly target currently broad lanes:
   - serialized `/api/media/move-batch`
   - mixed-responsibility `mediaUploadService`
   - mixed remote-copy/generated-media persistence logic

Exit criteria:

1. cleaner write-side ownership
2. fewer preview drift cases introduced at save time
3. better bulk operation throughput
4. save-path responsibilities are narrow enough that browse-path preview drift is easier to prevent and diagnose

Dependencies:

1. Phase 0 contract decisions
2. Phase 1 preview authority decisions

### Phase 6: Surface and Dormant-System Cleanup

Goal: remove dormant and duplicative systems that keep the subsystem messy.

Work:

1. collapse duplicate panel implementations toward one implementation shell
2. remove dormant folder-canvas browse plumbing from active browse flow if it remains intentionally disabled
3. align docs, SOPs, and ADR-facing claims with live behavior
4. tighten architecture checks around oversized/high-responsibility media files
5. reconcile performance SOP tuning guidance with the actual runtime config locations

Exit criteria:

1. less duplicate surface code
2. less dormant browse-path baggage
3. lower doc/runtime drift
4. live tuning docs point at the real control surfaces

Dependencies:

1. Phase 0

### Phase 7: Hardening and Guardrails

Goal: make the leaner system stay lean.

Work:

1. add telemetry for hot-path success versus fallback usage
2. add regression checks for:
   - preview authority
   - signing budgets
   - fallback creep
   - derivative coverage drift
3. establish one clear architecture owner for preview delivery

Exit criteria:

1. fallback creep becomes visible
2. derivative health becomes reviewable
3. preview-delivery regressions are caught early

Dependencies:

1. Phases 1 through 4 substantially complete

### Phase 8: Experimental Optimization

Goal: layer advanced performance wins onto a cleaner architecture.

Work:

1. evaluate `content-visibility` on media-library card shells
2. evaluate `HTMLImageElement.decode()` for visible-window predecode
3. evaluate `requestVideoFrameCallback()` for video readiness
4. evaluate workerized image processing (`OffscreenCanvas`, related browser-side lanes)
5. evaluate low-priority task scheduling for deferred work

Exit criteria:

1. measurable gains beyond the architectural cleanup
2. no correctness regressions
3. no new complexity that re-pollutes the hot path

Dependencies:

1. Phases 1 through 7 sufficiently stable

## Best Path Forward

Highest-ROI implementation sequence:

1. lock the contract and drift list
2. simplify preview authority on the hot path
3. begin signed-URL reuse work where preview assets are already stable
4. close the image/video derivative asymmetry
5. tighten visible-window scheduling
6. simplify write-side flows that still regenerate browse complexity
7. clean up dormant surface and doc baggage
8. add guardrails
9. evaluate browser-side experiments only after the core path is measurably cleaner

## Done State

The plan is `done` only when all of the following are true.

### 1. Browse Contract Is Stable

1. every Media Library browse row has one clearly defined preview authority for grid rendering
2. every media row has one clearly defined full-view authority
3. the normal browse path no longer depends on legacy repair logic to paint the first visible media
4. `/api/media/resolve-previews` is no longer part of the expected hot browse path and is used only for exception/repair handling

### 2. Preview Assets Are Canonical

1. image browsing defaults to derivative-backed thumb assets
2. video browsing defaults to canonical poster assets and canonical hover-preview assets where hover-preview behavior exists
3. mixed `All Media` browsing rarely falls back to original assets for visible cards
4. variant path coverage is high enough that runtime preview inference is the exception, not the rule

### 3. Signed URL Behavior Is Efficient

1. repeat opens reuse signed preview URLs effectively instead of re-signing the same visible assets unnecessarily
2. signed-URL churn is materially lower than the current baseline
3. repeat-open latency is measurably better than the current baseline
4. no optimization in the final system worsens private-media cache behavior through avoidable URL churn

### 4. Visible-Window Work Is Bounded

1. signing, video prep, and hydration are concentrated on visible and near-visible cards
2. page-wide preview work for offscreen rows is no longer part of the default browse flow
3. scroll performance remains stable under large libraries
4. state/store churn for non-visible rows is materially reduced from the current baseline

### 5. Write Path No Longer Reintroduces Browse Fat

1. upload, remote-copy, generated-media save, and voice staging responsibilities are clearly separated
2. save-side logic writes or queues canonical preview expectations consistently
3. multi-file uploads and bulk moves run with bounded concurrency and do not serialize unnecessarily
4. write-side complexity is no longer the primary source of preview drift

### 6. Structural Fat Is Removed

1. duplicate panel implementations are collapsed or clearly minimized behind one implementation shell
2. dormant folder-canvas browse plumbing is either removed from the active path or explicitly documented as intentionally non-shipped behavior
3. media performance and Media Library SOP/runtime docs match the live code paths closely enough to guide future work safely
4. architecture checks are strong enough to catch re-bloat in the main media-library files

### 7. Guardrails Exist

1. telemetry can show:
   - first visible media paint
   - first decoded image
   - first visible video frame
   - sign-batch calls per open
   - `resolve-previews` rate
   - storage-download fallback rate
   - repeat-open latency
2. derivative coverage and fallback usage are observable and reviewable
3. regressions in preview authority, signing churn, or fallback creep are caught by tests or operational review

### 8. User-Facing Contract Is Preserved

1. no UI or UX regressions were introduced
2. no critical media workflows were cut
3. browse, select, open, drag/drop, move, upload, and modal behavior remain functionally equivalent from the user’s perspective
4. the system is materially faster, leaner, and easier to reason about without changing the product contract

### 9. Execution Stop Condition

This task is not `done` just because a few hotspots got faster. Stop only when:

1. route, modal, and panel browse no longer layer avoidable server seeding, broad client prefetch, and broad resolver fallback on top of each other
2. `resolve-previews` is no longer doing broad legacy-repair work for normal visible-card browse flows
3. the remaining open work is lower ROI than the risk and complexity of continuing
4. the retained validation bundle stays green for the touched browse-path seams

### Final Acceptance Rule

The plan should not be called complete merely because first-open latency improved. It is only complete when:

1. first open is faster
2. repeat open is faster
3. scroll is stable on large libraries
4. preview resolution is predictable
5. fallback usage is rare and measurable
6. derivative health is operationally sustainable
7. the code and docs are simpler and less drift-prone than the current state

## Phase Gates

1. do not start Phase 2 backlog/backfill execution until Phase 0 has frozen the browse contract
2. do not start broad Phase 3 cache-policy changes until Phase 1 has simplified preview authority enough to measure churn cleanly
3. do not start Phase 4 scheduling cleanup until the team is no longer optimizing a multi-authority browse path
4. do not start Phase 8 experiments until repeat-open and signed-URL churn metrics are already improved through architectural work
5. do not collapse payload profiles blindly; mixed/audio surface metadata needs must be explicitly preserved or redesigned first

## Task Contract Checklist

- [x] No product/runtime behavior changes were made in this packet.
- [x] Plan rewrite is grounded in local repo audit evidence.
- [x] External research remains limited to current primary docs and platform guidance.
- [x] UI/UX/behavior preservation remained a hard constraint.
- [x] Critical systems were treated as preserved, not cut.
- [x] The long plan, short roadmap, and Phase 0 checklist were re-synced around one precedence order.

## Audit Findings

### Blocking

1. the current browse path still mixes hot-path delivery and cold-path repair logic
2. video browse preview handling is still less canonical than image browse handling
3. signed-URL churn likely suppresses private-media CDN warmth
4. doc/runtime drift around folder-canvas behavior is material enough to count as planning debt
5. performance tuning docs still do not fully match the live control surfaces

### Non-blocking

1. exact-count work can probably move off the default first-open path
2. expanded payloads appear justified in some panel scopes, but should be challenged per scope
3. runtime store churn is worth trimming after preview authority is simplified
4. the plan family itself needs periodic sync so the short roadmap does not drift away from phase dependencies

### Deferred

1. broad browser-worker experimentation
2. deeper codec/device-adaptation work
3. any public/private bucket policy shift without explicit security review

## Follow-up Actions

1. run the Phase 0 bundle and capture one real baseline packet on a populated library
2. run live browser and storage-cache diagnostics to validate the static audit
3. audit derivative coverage and backlog before browse-path simplification begins
4. reconcile Media Library folder-canvas docs and performance tuning docs against the live panel path and current runtime config
5. keep future roadmap/checklist updates subordinate to this packet’s sequencing and gate rules
6. treat prompt/controller micro-optimization as secondary until preview-authority and resolver-path work are materially further along
