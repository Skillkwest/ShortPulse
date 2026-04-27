# Planning Evidence

Store stage evidence snapshots here with dated filenames.

This is the current physical evidence namespace during the records migration transition. Use `docs/records/README.md` as the governance entrypoint for retained records and evidence.

## Active evidence namespaces
- `docs/planning/evidence/ai-studio-expert-edit/`
- `docs/planning/evidence/reference-grid-modularization/`
- `docs/planning/evidence/unified-buildout/`

## Migrated namespaces
- `docs/records/evidence/agent/`
- `docs/records/evidence/agent-pipeline-remediation/`
- `docs/records/evidence/architecture/`
- `docs/records/evidence/docs/`
- `docs/records/evidence/lane-a/`
- `docs/records/evidence/lane-b/`
- `docs/records/evidence/lane-c/`
- `docs/records/evidence/lane-d/`
- `docs/records/evidence/lane-e/`
- `docs/records/evidence/lane-f/`
- `docs/records/evidence/generation-pipeline-hardening/`
- `docs/records/evidence/generation-reliability-hardening/`
- `docs/records/evidence/kei/`
- `docs/records/evidence/ai-studio-reference-grid-reliability/`
- `docs/records/evidence/media-library-runtime-rebuild/`
- `docs/records/evidence/naming-canonicalization/`
- `docs/records/evidence/media-rendering-hardening-v2/`
- `docs/records/evidence/sql/`
- `docs/records/evidence/style-adherence/`

## Notes
- Keep packet names date-prefixed (`YYYY-MM-DD-...`).
- Keep evidence scoped to active planning tracks; archive superseded tracks under `docs/archive/` when retired.
- New top-level reading paths should point to namespace indexes and records policy docs rather than directly to raw packet files.
- `docs/planning/evidence/ai-studio-expert-edit/` is an intentional active-program exception while the coordinate-parity tracker still has `CP-501` in progress and `CP-502` / `CP-503` pending.
- `docs/planning/evidence/reference-grid-modularization/` is an intentional active-governance exception while its tracker remains `Status: active` and open governance dependencies `RG-DEP-04` / `RG-DEP-05` are unresolved.
- `docs/planning/evidence/unified-buildout/` is an intentional active-program exception, not just an untriaged migration hold. Keep it here while `docs/planning/shortpulse-unified-buildout-tracker.md` still uses phase evidence as a live execution gate.
- Reliability packet template: `docs/planning/generation-reliability-hardening-evidence-packet-template.md`.
- Reference Grid reliability packet template: `docs/planning/ai-studio-reference-grid-reliability-evidence-packet-template-2026-03-21.md`.
