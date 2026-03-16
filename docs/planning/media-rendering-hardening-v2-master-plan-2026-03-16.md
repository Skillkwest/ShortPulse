# Media Rendering Hardening v2 Master Plan (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Owner: Engineering  
Program type: Parallel hardening track (no feature-bundle mixing)

## Summary
Media Rendering Hardening v2 is a no-regression, no-bloat strangler program for media read/render/upload surfaces.

Program goals:
1. Lock current behavior with characterization evidence before contract changes.
2. Harden hot-path media contracts first, then long-tail consistency surfaces.
3. Remove scalability, payload, and policy drift seams without user-facing regressions.
4. Decommission legacy adapter paths with explicit telemetry gates and rollback windows.

## Scope
In scope:
1. Media list/sign/resolve/upload/read contract surfaces.
2. AI Studio media render surfaces (route, modal, panel, reference grid).
3. Upload ingestion and metadata propagation invariants.
4. Query-shape scalability for folder-scoped listing.
5. Anti-bloat size/boundary enforcement for media hotspots.
6. Rollout/decommission governance and evidence discipline.

Out of scope:
1. Unrelated product feature additions.
2. Standalone design refresh work.
3. Non-media lane governance scope beyond required index updates.
4. `mini-ecosystem/` artifacts and workflows.

## Locked Program Constraints
1. One seam per PR, no mixed refactor+feature bundles.
2. No behavior change without prior characterization evidence.
3. No breaking external contract change without same-slice docs + rollback notes.
4. No schema-breaking migration without migration + rollback + runbook updates in the same slice.
5. Legacy compatibility aliases must have owner, sunset criteria, and decommission checkpoints.

## Control-Pack Artifacts
1. `docs/planning/media-rendering-hardening-v2-master-plan-2026-03-16.md`
2. `docs/planning/media-rendering-hardening-v2-master-roadmap-2026-03-16.md`
3. `docs/planning/media-rendering-hardening-v2-execution-tracker-2026-03-16.md`
4. `docs/planning/media-rendering-hardening-v2-risk-register-2026-03-16.md`
5. `docs/planning/media-rendering-hardening-v2-decision-log-2026-03-16.md`
6. `docs/planning/media-rendering-hardening-v2-qa-release-checklist-2026-03-16.md`
7. `docs/planning/media-rendering-hardening-v2-contract-matrix-2026-03-16.md`
8. `docs/planning/media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md`
9. `docs/planning/media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md`
10. `docs/planning/media-rendering-hardening-v2-folder-query-scalability-spec-2026-03-16.md`
11. `docs/planning/media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md`
12. `docs/planning/media-rendering-hardening-v2-metadata-authority-spec-2026-03-16.md`
13. `docs/planning/evidence/media-rendering-hardening-v2/README.md`
14. `docs/planning/evidence/media-rendering-hardening-v2/slice-evidence-packet-template.md`

## Phase Model
### P0A: Characterization + Baseline Lock (no behavior change)
1. Freeze inventory and contract matrix.
2. Capture baseline latency/failure/perf by surface.
3. Capture pre-change characterization tests for fragile seams.

### P0B: Inventory Lock (no behavior change)
1. Build authoritative inventory of all image render callsites (`next/image`, `<img>`).
2. Classify hot-path vs long-tail and lock IDs.
3. Freeze ownership and coverage map for each surface.

### P1: Contract Hardening (read/render parity)
1. Normalize preview-resolution contract across route/modal/panel/reference-grid.
2. Lock signed-object URL policy and fallback order.
3. Add deterministic error taxonomy and surface assertions.

### P2: API Payload + Query Hardening
1. Add list response profile mode (`minimal` default, `expanded` optional).
2. Remove unbounded folder id fan-in query patterns.
3. Preserve identical pagination and user-visible behavior.

### P3: Upload Pipeline Consolidation
1. Make `/api/media/upload` canonical ingest path.
2. Keep `/api/upload-image` and `/api/upload-video` as temporary compatibility adapters.
3. Remove sequential multi-file upload bottlenecks on hot paths.

### P4: Dimension + Metadata Authority
1. Define authoritative dimension contract from ingest through render.
2. Align parser support with allowed MIME signatures or enforce deterministic fallback metadata policy.
3. Keep derivative/preview visibility deterministic and non-blocking.

### P5: Virtualization + Render Cost Reduction
1. Eliminate full-list recomputation in hot loops.
2. Prioritize visible-window signing/hydration scheduling.
3. Validate large-library behavior across route/modal/panel surfaces.

### P6: Anti-Bloat Enforcement
1. Extend `check:size-budget` to media pipeline hotspots.
2. Extend architecture-boundary checks for media flow layering.
3. Prevent duplicate resolver/upload utility paths.

### P7: Long-Tail Surface Sweep
1. Apply inventory-driven parity hardening to long-tail image surfaces.
2. Remove unnecessary `unoptimized` usage where safe and intentional.

### P8: Rollout + Decommission
1. Ring rollout: local -> staging -> limited cohort -> full.
2. Decommission legacy adapters after two clean release windows and zero P0/P1 regressions.
3. Publish final evidence packet and closeout checklist.

## Public Interface Contract
1. `POST /api/media/list` supports `profile` with `minimal` default and `expanded` optional.
2. `POST /api/media/upload` is canonical.
3. `/api/upload-image` and `/api/upload-video` remain compatibility adapters until sunset gates pass.
4. Preview resolution contract is deterministic across sign/resolve/adaptive consumers.

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
1. All tracker rows `Completed` or explicitly deferred with owner/date/sunset.
2. No open P0/P1 regressions after two consecutive release windows.
3. Legacy adapter traffic below decommission threshold and removal slice merged.
4. No net growth in media hotspot file-size or boundary violations.
5. Final evidence bundle and closeout checklist published.
