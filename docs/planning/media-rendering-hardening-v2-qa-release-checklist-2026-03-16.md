# Media Rendering Hardening v2 QA And Release Checklist (2026-03-16)

Last updated: 2026-03-16  
Status: Active

## Per-Slice QA Checklist
- [ ] Targeted seam tests pass for touched surface.
- [ ] `lint`, `type-check`, `build`, and `docs:check` pass.
- [ ] Manual smoke completed for affected media surfaces.
- [ ] Rollback path validated and documented in tracker row.
- [ ] Evidence packet attached for the slice.

## Required Manual Smoke Matrix
- [ ] Upload (image/video/private) works.
- [ ] List/search/paginate behavior unchanged.
- [ ] Modal and panel ingest behavior unchanged.
- [ ] Reference-grid render and preview path unchanged or intentionally updated.
- [ ] Style/copy-from-url fallback behavior intact.
- [ ] Detail modal full-quality path intact.

## Ring Rollout Checklist
### Ring 0 (local)
- [ ] Full gate bundle passes.
- [ ] Targeted smoke passes.

### Ring 1 (staging)
- [ ] Full gate bundle passes in staging context.
- [ ] No P0/P1 regressions in observation period.
- [ ] Telemetry dashboards stable.

### Ring 2 (limited cohort)
- [ ] Error budget within threshold.
- [ ] No contract mismatch incidents.
- [ ] Rollback trigger not met.

### Ring 3 (full)
- [ ] Two clean release windows observed.
- [ ] Legacy adapter traffic below sunset threshold.
- [ ] Decommission gate readiness approved.

## Rollback Thresholds
1. P0/P1 regression confirmed in production-like ring.
2. Upload/list/render critical-path error rate exceeds pre-agreed threshold.
3. Contract mismatch appears across protected surfaces.
4. Signed URL resolution drift causes persistent user-visible failures.

## Decommission Readiness Checklist
- [ ] Adapter compatibility parity was proven in staging + limited ring.
- [ ] Two consecutive clean release windows complete.
- [ ] No unresolved P0/P1 incidents.
- [ ] Decommission rollback plan validated.
