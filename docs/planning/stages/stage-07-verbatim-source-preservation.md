# STG-07 Verbatim Source Preservation

## Summary
Preserve source planning inputs verbatim with manifest-based integrity.

## Checklist
- [x] Create archive folder scaffold.
- [x] Add manifest schema and checksum validation script.
- [ ] Copy source plans verbatim into archive.
- [ ] Fill manifest with hash/size/source commit metadata.
- [ ] Apply chat-sourced provenance convention for every user-provided source plan:
- `source_path` format: `user-provided-plan:<exact plan title>`
- `source_commit`: commit hash introducing archive entries
- `notes`: `Verbatim copy from user-provided plan text (conversation source, 2026-02-20).`
- [ ] Keep archived source files verbatim (no frontmatter, no normalization).

## Verification
- `node scripts/check_archive_manifest.js`
- `rg -n "user-provided-plan:" docs/planning/archive/original-plans/manifest.json`

## Owners and validators
- Owner: Engineering
- Validator: Docs governance

## KPI
- 100% manifest checksum parity for archived originals.

## Evidence
- `docs/planning/archive/original-plans/manifest.json`
