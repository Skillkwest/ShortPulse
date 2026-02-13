# ADR 0011: Character Sheet Terminology Policy

## Status
Accepted

## Context
Character Manager UI and product docs were renamed from "Reference Pack" to "Character Sheet" for clearer user-facing language. Existing database schema and historical migrations still use legacy `reference_pack_*` names.

Without a policy, naming drift can reappear across UI, docs, SQL, and code.

## Decision
- Product/UI language standard is **Character Sheet**.
- Canonical app metadata key is `character_sheet_assignments`.
- Database compatibility remains dual-path during migration:
  - Canonical alias columns/keys: `active_character_sheet_id`, `character_sheet_id`, `character_sheet_assignments`.
  - Legacy aliases retained and synchronized: `active_reference_pack_id`, `reference_pack_id`, `reference_pack_assignments`.
- We keep table names (`character_reference_packs`) unchanged for now to avoid high-risk breaking changes; column/key aliases provide the migration bridge.

## Consequences
- Positive:
  - User-facing naming stays consistent and clear.
  - Existing environments and data remain compatible during rollout.
  - Future deprecation of legacy aliases can be done in a controlled phase.
- Negative:
  - Temporary dual-write/dual-read complexity in schema and persistence code.

## Follow-ups
- Monitor production usage and remove legacy aliases only after all environments are migrated and stable.
- If we later rename table objects, do it as a separate migration plan with explicit compatibility views.
