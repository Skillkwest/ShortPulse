# Naming Canonicalization Phase 1 Active Docs Canonicalization

## Metadata
- Date: 2026-02-23
- Phase: 1 (Active docs canonicalization)
- Slice: Active docs terminology and reference drift cleanup
- Owner: Frontend + Docs Governance

## Scope
1. Canonicalized active docs wording from `Reference Canvas` to `Reference Grid`.
2. Replaced stale `ReferencePropertiesPanel` references in active SOPs with canonical workflow panel names.
3. Updated docs index/governance pages with naming-program artifacts and non-authoritative archive policy.

## Changed Files
- `docs/sops/sop_video_generation.md`
- `docs/sops/sop_image_generation.md`
- `docs/sops/sop_text_generation.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/frontend-architecture.md`
- `docs/product/shortpulse_ai_studio.md`
- `docs/documentation_overview.md`
- `docs/README.md`
- `docs/planning/README.md`
- `docs/sops/README.md`
- `docs/adr/README.md`
- `docs/planning/evidence/README.md`
- `docs/troubleshooting.md`

## Validation
- `npm -C frontend run docs:check` - Pass

## Notes
- Historical docs remain non-authoritative by policy and were not bulk rewritten.
