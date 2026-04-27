# Naming Canonicalization Phase 0 Baseline Freeze

## Metadata
- Date: 2026-02-23
- Phase: 0 (Baseline freeze)
- Slice: Program initialization
- Owner: Frontend + Docs Governance

## Scope
1. Created program governance documents:
- `docs/planning/naming-canonicalization-program.md`
- `docs/planning/naming-canonical-map.md`
- `docs/planning/naming-decision-log.md`
- `docs/planning/naming-canonicalization-tracker.md`
- `docs/records/evidence/naming-canonicalization/naming-canonicalization-evidence-template.md`
- `docs/sops/sop_naming_canonicalization_rollback.md`
- `docs/adr/0023-ai-studio-naming-canonicalization-and-alias-sunset-policy.md`

2. Established evidence location for subsequent slices.

## Baseline Gates
- `npm -C frontend run validate` - Pass (lint + type-check + 189 test files, 914 tests)
- `npm -C frontend run test:adaptive-v2-gate` - Pass
- `npm -C frontend run docs:check` - Pass
- `npm -C frontend run perf:ai-studio:release-check` - Blocked (missing required env var `PLAYWRIGHT_AUDIT_EMAIL`)
- `npm -C frontend run check:architecture-boundary` - Pass
- `npm -C frontend run check:size-budget` - Pass

## Notes
- No runtime behavior changes in this initialization slice.
- Canonical map v1 and policy ADR are now in place.
- Baseline is ready for merge except perf-release evidence, which requires CI/local secret-injected Playwright audit credentials.
