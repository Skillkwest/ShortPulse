# ADR 0011: Character Sheet Terminology Policy

## Status
Superseded in part by ADR 0075

## Context
Character Manager UI and product docs were renamed from "Reference Pack" to "Character Sheet" for clearer user-facing language. Existing database schema and historical migrations still use legacy `reference_pack_*` names.

Without a policy, naming drift can reappear across UI, docs, SQL, and code.

## Decision
- Product/UI language standard is **Character Sheet**.
- Canonical app metadata key is `character_sheet_assignments`.
- Database compatibility used a dual-path migration bridge during rollout:
  - Canonical alias columns/keys: `active_character_sheet_id`, `character_sheet_id`, `character_sheet_assignments`.
  - Legacy aliases were temporarily retained and synchronized: `active_reference_pack_id`, `reference_pack_id`, `reference_pack_assignments`.
- We keep table names (`character_reference_packs`) unchanged for now to avoid high-risk breaking changes; column/key aliases provide the migration bridge.

## Consequences
- Positive:
  - User-facing naming stays consistent and clear.
  - Existing environments and data remained compatible during rollout.
  - Legacy alias retirement could be done later as a separate controlled phase.
- Negative:
  - The migration bridge introduced temporary dual-write/dual-read complexity in schema and persistence code.

## Follow-ups
- ADR 0075 retires the legacy alias bridge after verified multi-environment zero-drift audits.
- If we later rename table objects, do it as a separate migration plan with explicit compatibility views.
