# Media Rendering Hardening v2 Master Plan (2026-03-16)

Last updated: 2026-03-18
Status: active  
Owner: Engineering  
Program type: No-regression, no-bloat strangler hardening track

## Summary
Media Rendering Hardening v2 is the canonical program for stabilizing image/media rendering, signing, adaptive delivery, ingest metadata authority, and long-tail surface consistency without repo regressions.

Rebuild method conformance:
1. This track follows `docs/planning/foundation-rebuild-playbook-2026-03-16.md`.
2. Behavior-changing slices are blocked until rebuild-entry evidence is attached.
3. Cutover and decommission actions must satisfy the playbook security and performance parity contract.

Program goals:
1. Lock current behavior with trustworthy characterization evidence before contract changes.
2. Decide one media-delivery policy per surface before code hardening starts.
3. Fix ingest and metadata authority early so render surfaces stop inheriting null or ambiguous dimensions.
4. Shift hot-path delivery toward durable preview variants/derivatives instead of per-view transform dependence.
5. Remove payload, query, render-loop, and policy drift seams without user-facing regressions.
6. Decommission legacy adapter paths with explicit telemetry, parity, and rollback windows.

## Scope
In scope:
1. Media list/sign/resolve/upload/read contract surfaces.
2. AI Studio and Media Library render surfaces: media-library route, modal, panel, file modal, panel preview modal, reference-grid, quick-slot, character-grid, quick-swap, and detail-modal.
3. Upload ingestion, MIME/signature validation, and metadata propagation invariants.
4. Query-shape scalability for folder-scoped listing.
5. Virtualization, hydration, and render-cost hot paths for media-heavy surfaces.
6. Anti-bloat size/boundary enforcement for media hotspots.
7. Rollout, decommission, and evidence governance.

Out of scope:
1. Unrelated product feature additions.
2. Standalone design refresh work.
3. `mini-ecosystem/` artifacts and workflows.
4. Non-media governance work beyond required doc/index updates.

## Locked Program Constraints
1. One seam per PR, no mixed refactor+feature bundles.
2. No behavior change without prior characterization evidence.
3. No baseline packet may be treated as authoritative until telemetry truth checks pass.
4. No breaking external contract change without same-slice docs + rollback notes.
5. No schema-breaking migration without migration + rollback + runbook updates in the same slice.
6. Legacy compatibility adapters must have owner, sunset criteria, and decommission checkpoints.
7. Durable media-delivery policy changes require an ADR in the same slice.
8. Master execution tracker remains the single operational source of truth; lane docs are secondary planning aids.
9. Supabase on-demand transforms are compatibility-only for this program; they are not an acceptable steady-state hot-path dependency under the current quota/cost posture.

## External Vendor Constraints
The program may only rely on externally coupled image-delivery assumptions that are confirmed by official vendor documentation.

Current locked constraints:
1. Next.js permits multiple valid remote-image strategies: `next/image`, intentional `unoptimized`, or a custom loader. The program must choose deliberately per surface instead of treating one renderer as automatically correct.
2. Next.js remote-image allowlisting must account for signed URL query strings and host patterns; signed-token query behavior is a real architectural input, not an implementation detail.
3. Supabase signed image transforms are technically available, but because transform options are embedded in the signed token, downstream surfaces cannot safely assume they can rewrite transform params after signing.
4. Supabase Smart CDN can improve delivery behavior for signed and transformed assets, but it does not remove the need for explicit cache/version strategy in rollout and decommission planning.
5. Current Supabase auto-optimization guidance is still centered on supported transformed output such as WebP; this program must not assume AVIF delivery parity simply because AVIF is accepted at ingest.

## Execution Model
Implementation runs through three lanes:
1. Foundation Lane: inventory, policy decisions, telemetry truth, regression-armor, shared contracts.
2. Pipeline Lane: ingest/upload authority, dimension/metadata authority, derivative readiness, list/sign/resolve contracts.
3. Surface Lane: route/modal/panel/file-modal/panel-preview/reference-grid/character/quick-swap/detail/long-tail adoption and parity.

Active lane docs:
1. `docs/planning/media-rendering-hardening-v2-foundation-lane-master-plan-2026-03-18.md`
2. `docs/planning/media-rendering-hardening-v2-foundation-lane-execution-plan-2026-03-18.md`
3. `docs/planning/media-rendering-hardening-v2-pipeline-lane-master-plan-2026-03-18.md`
4. `docs/planning/media-rendering-hardening-v2-pipeline-lane-execution-plan-2026-03-18.md`
5. `docs/planning/media-rendering-hardening-v2-surface-lane-master-plan-2026-03-18.md`
6. `docs/planning/media-rendering-hardening-v2-surface-lane-execution-plan-2026-03-18.md`

## Control-Pack Artifacts
Master docs:
1. `docs/planning/media-rendering-hardening-v2-master-plan-2026-03-16.md`
2. `docs/planning/media-rendering-hardening-v2-master-roadmap-2026-03-16.md`
3. `docs/planning/media-rendering-hardening-v2-execution-tracker-2026-03-16.md`
4. `docs/planning/media-rendering-hardening-v2-risk-register-2026-03-16.md`
5. `docs/planning/media-rendering-hardening-v2-decision-log-2026-03-16.md`
6. `docs/planning/media-rendering-hardening-v2-qa-release-checklist-2026-03-16.md`

Supporting docs:
7. `docs/planning/media-rendering-hardening-v2-contract-matrix-2026-03-16.md`
8. `docs/planning/media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md`
9. `docs/planning/media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md`
10. `docs/planning/media-rendering-hardening-v2-folder-query-scalability-spec-2026-03-16.md`
11. `docs/planning/media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md`
12. `docs/planning/media-rendering-hardening-v2-metadata-authority-spec-2026-03-16.md`
13. `docs/planning/media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md`
14. `docs/planning/media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md`
15. `docs/planning/media-rendering-hardening-v2-test-realignment-matrix-2026-03-18.md`
16. `docs/planning/media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md`
17. `docs/planning/media-rendering-hardening-v2-foundation-p0-inventory-telemetry-closure-plan-2026-03-18.md`
18. `docs/records/evidence/media-rendering-hardening-v2/README.md`
19. `docs/records/evidence/media-rendering-hardening-v2/slice-evidence-packet-template.md`

## Phase Model
### P0: Inventory + Telemetry Truth + Baseline Lock (no behavior change)
1. Freeze all image/media render callsites and surface ownership.
2. Calibrate telemetry so baseline metrics are trustworthy.
3. Capture latency, failure, render, and fallback baselines by surface.
4. Publish stop/go readiness scorecard for behavior-changing work.

### P1: Surface Policy Decision Lock (no behavior change)
1. Decide one delivery policy per surface and source class.
2. Lock renderer, optimizer, signing, and fallback rules in the surface policy matrix.
3. Record unresolved policy choices as explicit blockers, not implicit defaults.

### P2: Ingest + Dimension + Metadata Authority
1. Define authoritative dimension contract from ingest through render.
2. Align parser support with allowed MIME signatures or enforce deterministic fallback metadata policy.
3. Make derivative/preview readiness observable and non-ambiguous.
4. Establish derivative-first hot-path server truth so later surfaces do not depend on per-view transforms.

### P3: Read/Render Contract Unification
1. Normalize preview-resolution contract across route, modal, panel, file modal, panel preview modal, reference-grid, quick-slot, character-grid, quick-swap, and detail-modal.
2. Lock signed-object URL policy and fallback order.
3. Add deterministic error taxonomy and surface assertions.

### P4: Test Realignment + Regression Armor
1. Classify existing tests into characterization locks vs drift-locking tests.
2. Rewrite or retire tests that protect now-rejected policy drift.
3. Add missing parity tests for newly included surfaces.

### P5: API Payload + Query Hardening
1. Add list response profile mode (`minimal` default, `expanded` optional).
2. Remove unbounded folder id fan-in query patterns.
3. Preserve identical pagination and user-visible behavior.

### P6: Upload Pipeline Consolidation
1. Make `/api/media/upload` canonical ingest path.
2. Keep `/api/upload-image` and `/api/upload-video` as temporary compatibility adapters.
3. Remove sequential multi-file upload bottlenecks on hot paths.

### P7: Render Cost Reduction + Anti-Bloat Enforcement
1. Eliminate full-list recomputation in virtualization/hydration hot loops.
2. Prioritize visible-window signing/hydration scheduling.
3. Extend size-budget and architecture-boundary checks to media hotspots before long-tail sweeps.

### P8: Long-Tail Surface Sweep
1. Apply inventory-driven parity hardening to dashboard, landing, performance, saved-creators, prefabs, and other non-hot-path image surfaces.
2. Remove unnecessary `unoptimized` usage where safe and intentional.
3. Broad `P8` work is explicitly deferrable if repo audit and staging validation show the remaining long-tail surfaces are low-yield relative to regression risk.

### P9: Rollout + Decommission
1. Ring rollout: local -> staging -> limited cohort -> full.
2. Decommission legacy adapters only after parity proof, telemetry threshold, and clean release-window gates pass.
3. Publish final evidence packet and closeout checklist.
4. Treat `P9` as operational closeout, not pre-merge implementation work.

## Public Interface Contract
1. `POST /api/media/list` supports `profile` with `minimal` default and `expanded` optional.
2. `POST /api/media/upload` is canonical.
3. `/api/upload-image` and `/api/upload-video` remain compatibility adapters until sunset gates pass.
4. Preview resolution contract must be deterministic across sign/resolve/adaptive consumers.
5. Surface policy decisions must be reflected in the surface policy matrix, contract matrix, and decision log before implementation slices merge.

## Evidence Rules
1. All slice evidence lives under `docs/records/evidence/media-rendering-hardening-v2/`.
2. Every completed tracker row must link to a concrete evidence packet.
3. No alternate evidence namespace may be used for this program without same-slice decision-log approval.
4. Any durable media-delivery policy change must link to both an ADR and an evidence packet.

## Required Validation Bundle
Per slice:
1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run build`
4. `cd frontend && npm run docs:check`
5. Targeted seam tests for touched surfaces.

Additional protected-surface gates when applicable:
1. `cd frontend && npm run test:adaptive-v2-gate`
2. `cd frontend && npm run perf:ai-studio:release-check`
3. `cd frontend && npm run check:architecture-boundary`
4. `cd frontend && npm run check:size-budget`

## Exit Criteria
1. All tracker rows are `Completed` or explicitly deferred with owner/date/sunset.
2. Policy matrix, contract matrix, and decision log agree on final delivery rules.
3. No open P0/P1 regressions after two consecutive release windows.
4. Legacy adapter traffic is below decommission threshold and removal slice is merged.
5. No net growth in media hotspot file-size or boundary violations.
6. Final evidence bundle, release checklist, and ADR set are published.
