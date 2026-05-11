# ADR 0075: Character Sheet Alias Compatibility Retirement

## Status
Accepted

## Context
Character Manager introduced canonical `character_sheet_*` fields and metadata in migration `012_add_character_sheet_aliases_and_compat.sql` while keeping legacy `reference_pack_*` aliases synchronized for compatibility. That bridge added database triggers, duplicate constraints, duplicate metadata keys, and redundant columns across `characters`, `character_reference_images`, `character_generation_jobs`, and `media_files`.

The live app runtime is now canonical-only, and both staging and production have been audited with zero alias drift and zero legacy-only rows across the affected surfaces.

## Decision
- Retire database-level `reference_pack_*` alias compatibility through migration `122_retire_character_sheet_alias_compat.sql`.
- Keep `character_reference_packs` table naming unchanged; this ADR only retires alias columns/metadata keys, not the base table name.
- Remove alias sync triggers, alias sync check constraints, legacy foreign keys/indexes, and legacy metadata keys.
- Keep `sql/check_character_sheet_alias_drift.sql` as a safe historical/readiness diagnostic that returns zero after retirement instead of failing on missing columns.

## Consequences
- Positive:
  - Character schema and metadata become canonical-only.
  - Trigger, constraint, and index duplication is removed from the live database path.
  - Operators retain a safe audit script for historical or partially migrated environments.
- Negative:
  - Older clients or ad hoc SQL still writing `reference_pack_*` fields will fail after migration `122`.
  - Rollback requires an explicit compatibility reintroduction plan rather than relying on the old dual-path behavior remaining in place.
- Follow-ups:
  - Apply migration `122` through the normal hosted migration workflow.
  - Update any remaining operational docs that still describe the alias window as active.
  - Evaluate whether the final frontend legacy cleanup (`LEGACY_CHARACTER_SHEET_ASSIGNMENTS_KEY`) is worth removing once migration `122` is applied everywhere.

## Alternatives considered
- Keep dual-path compatibility indefinitely:
  - Rejected because the bridge has already outlived its value and adds real schema/runtime complexity.
- Remove aliases without environment audits:
  - Rejected because this would risk silent data-shape regressions across persisted character rows and media metadata.
