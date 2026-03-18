# Media Rendering Hardening v2 QA And Release Checklist (2026-03-16)

Last updated: 2026-03-18
Status: Active

## Pre-Implementation Stop/Go
- [x] `docs/planning/media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md` is accepted.
- [x] Surface policy matrix exists for every protected hot-path surface and every explicit long-tail surface planned for `P8`.
- [x] Telemetry truth spec is accepted and baseline metrics are approved.
- [x] Test realignment matrix exists for all policy-sensitive tests.
- [x] Tracker rows are seeded for the next planned slice.

## Per-Slice QA Checklist
- [ ] Targeted seam tests pass for touched surface.
- [ ] `lint`, `type-check`, `build`, and `docs:check` pass.
- [ ] Manual smoke completed for affected media surfaces.
- [ ] Rollback path validated and documented in tracker row.
- [ ] Evidence packet attached for the slice.
- [ ] Contract matrix and decision log updated when contract behavior changes.
- [ ] ADR added when durable media-delivery policy changed.

## Required Manual Smoke Matrix
- [ ] Upload (image/video/private) works.
- [ ] List/search/paginate behavior unchanged.
- [ ] Modal and panel ingest behavior unchanged.
- [ ] Media Library file modal and panel preview modal behavior unchanged or intentionally updated.
- [ ] Reference-grid render and preview path unchanged or intentionally updated.
- [ ] Character-grid, quick-swap, and detail-modal behavior unchanged or intentionally updated.
- [ ] Style/copy-from-url fallback behavior intact.
- [ ] Detail modal full-quality path intact.
- [ ] Long-tail smoke coverage is completed for any long-tail surfaces touched in the slice.

## Ring Rollout Checklist
### Ring 0 (local)
- [ ] Full gate bundle passes.
- [ ] Targeted smoke passes.
- [ ] Baseline delta uses telemetry-approved fields only.

### Ring 1 (staging)
- [ ] Full gate bundle passes in staging context.
- [ ] No P0/P1 regressions in observation period.
- [ ] Telemetry dashboards stable.
- [ ] Adapter usage and delivery mode telemetry match expected contract.

### Ring 2 (limited cohort)
- [ ] Error budget within threshold.
- [ ] No contract mismatch incidents.
- [ ] Rollback trigger not met.
- [ ] No hidden consumer regressions on legacy adapters.

### Ring 3 (full)
- [ ] Two clean release windows observed.
- [ ] Legacy adapter traffic below sunset threshold.
- [ ] Decommission gate readiness approved.

## Rollback Thresholds
1. P0/P1 regression confirmed in production-like ring.
2. Upload/list/render critical-path error rate exceeds pre-agreed threshold.
3. Contract mismatch appears across protected surfaces.
4. Signed URL resolution drift causes persistent user-visible failures.
5. Telemetry-approved baseline fields regress beyond parity threshold.

## Decommission Readiness Checklist
- [ ] Adapter compatibility parity was proven in staging + limited ring.
- [ ] Two consecutive clean release windows complete.
- [ ] No unresolved P0/P1 incidents.
- [ ] No active callers remain on the to-be-removed legacy path.
- [ ] Decommission rollback plan validated.
