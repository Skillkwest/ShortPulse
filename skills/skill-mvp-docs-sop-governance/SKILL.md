---
name: skill-mvp-docs-sop-governance
description: Audit and align ShortPulse docs and SOPs with live code, routes, schema, and release process. Use when resolving documentation drift, cleaning redundant or legacy SOP content, updating docs indexes, and preparing release-ready documentation sign-off.
---

# MVP Docs and SOP Governance

Purpose: keep documentation accurate, non-conflicting, and operationally useful for MVP release execution.

## Sources of truth
- `docs/planning/mvp-pretester-full-audit-remediation-plan.md`
- `docs/README.md`
- `docs/planning/README.md`
- `docs/sops/README.md`
- `docs/documentation_overview.md`
- `docs/architecture-overview.md`
- `docs/frontend-architecture.md`
- `docs/local-development.md`
- `docs/api/api-internal-routes.md`
- `docs/change_log.md`
- `scripts/check_docs_links.js`

## Workflow
1. Audit coverage and drift
- Compare docs claims against current route/API/schema implementation.
- Flag contradictions, stale architecture claims, and missing route coverage.
2. Classify and clean
- Keep active SOPs in active indexes.
- Move outdated or superseded SOPs/docs to `docs/archive/` when appropriate.
- Clearly mark legacy items when archival is not possible yet.
3. Update navigation and governance
- Update `docs/README.md` and section indexes for discoverability.
- Keep planning docs discoverable from `docs/planning/README.md`.
- Record significant doc operations in `docs/change_log.md`.
4. Validate
- Run docs integrity checks.
- Run manual index review for top-level discoverability.

## Required verification
- `cd frontend && npm run docs:check`
- Confirm new/renamed docs are indexed in `docs/README.md`.
- Confirm SOP index separates active vs legacy content.

## Output format (recommended)
```text
Docs/SOP governance report
- Scope: <docs reviewed>
- Drift findings: <count>
- Cleanup actions: <count>

Critical drift
- <doc claim> vs <code reality> -> <doc update>

Index updates
- <index file> -> <added/removed links>

Validation
- docs:check: pass | fail
```
