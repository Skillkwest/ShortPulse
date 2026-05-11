# Media Library Phase 0 Execution Checklist

Purpose: provide the concrete preparation pack for the Media Library speed/lean program before implementation begins.

## Source of Truth

1. authoritative plan and gates:
   - `docs/records/evidence/media-library-runtime-rebuild/2026-05-10-mlr-6-s1-lean-speed-master-plan-audit.md`
2. short roadmap:
   - `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-10-media-library-speed-and-lean-roadmap.md`

This document is only the Phase 0 runbook. It does not redefine later-phase ordering.

## Tool Entry Points

1. Phase 0 bundle runner:
   - `frontend/scripts/media_library_phase0_bundle.mjs`
2. npm shortcuts:
   - `npm -C frontend run media:phase0`
   - `npm -C frontend run media:phase0:probe -- --base-url <url> --token <token>`
3. output formats:
   - markdown summary packet
   - optional JSON summary packet for later before/after comparison or automation
   - default markdown output goes to scratch space under `/tmp` unless `--output` is supplied

## Phase 0 Goals

1. lock the browse contract
2. enumerate doc/runtime drift
3. capture a baseline performance packet
4. capture a baseline derivative-health packet
5. prove which runtime controls are real and which are hard-coded behavior

## Required Checklist

1. lock the browse contract:
   - one grid preview authority
   - one full-view authority
   - one explicitly allowed fallback path
2. reconcile drift:
   - live panel behavior
   - Media Library SOPs
   - performance operations SOP
   - folder-canvas claims
   - runtime-config ownership
3. capture metrics:
   - first visible media paint
   - first decoded image
   - first visible video frame
   - sign-batch calls per open
   - `resolve-previews` call rate
   - storage-download fallback rate
   - repeat-open latency
4. capture derivative health:
   - image thumb coverage
   - video poster coverage
   - video hover-preview coverage
   - derivative backlog
   - terminal derivative failures
5. preserve one baseline packet for future before/after comparison

## Recommended Commands

### Checklist Bundle

```bash
cd frontend
npm run media:phase0
```

### Live Media API Probe

Use a real authenticated user with a populated media library.

```bash
cd frontend
npm run media:phase0:probe -- --preset panel --base-url https://your-app.example.com --token <bearer-token>
```

Optional knobs:

```bash
--preset panel
--surface media-library-panel
--media-kind all
--profile expanded
--limit 36
--samples 6
--warmup 2
--timeout-ms 8000
--output /tmp/media-library-phase0.md
--json-output /tmp/media-library-phase0.json
--json-stdout
```

Recommended preset aliases:

1. `--preset panel`
2. `--preset route`
3. `--preset modal`
4. `--preset images`
5. `--preset videos`
6. `--preset audio`

### Existing Browser Audit

```bash
cd frontend
npm run test:e2e:media-library-runtime
```

### Existing SQL Diagnostics

1. `sql/check_media_preview_variant_coverage_and_size.sql`
2. `sql/check_media_derivative_processing_backlog.sql`
3. `sql/check_media_derivative_terminal_failures.sql`
4. `sql/check_media_all_media_completeness_drift.sql`

## Expected Outputs

1. one markdown Phase 0 packet with the checklist, command set, and live probe results when available
2. one optional JSON packet for programmatic diffing against later runs
3. one saved browser audit packet from `test:e2e:media-library-runtime`
4. one saved derivative-health packet from the SQL diagnostics
5. one short drift list that names:
   - stale docs
   - hard-coded runtime controls
   - hot-path versus repair-path responsibilities

## Phase 0 Acceptance Gate

Phase 0 is complete only when:

1. the browse contract is written down and agreed
2. doc/runtime drift has been enumerated
3. at least one baseline metrics packet exists
4. at least one derivative coverage packet exists
5. live route or panel probe evidence has been captured on a real populated library
6. the implementation team can point to which runtime controls are real and which are hard-coded behavior
7. the Phase 0 packet is retained in a location that later phases can compare against

## Handoff Rule

When Phase 0 closes, the handoff into Phase 1 should name exactly:

1. the one preview-selection authority the team is targeting
2. the fallback paths that remain legal after Phase 1
3. which payload scopes must stay `expanded`
4. which signed-URL behaviors are considered baseline churn defects
