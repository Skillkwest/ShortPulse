# ADR 0023: AI Studio Naming Canonicalization And Alias Sunset Policy

## Status
Accepted

## Date
2026-02-23

## Context
Active AI Studio docs and code contain naming drift between user-facing terms and internal symbols (for example `Reference Grid` vs `ReferenceCanvas`, and `CreatePropertiesPanel` intent vs `TextPropertiesPanel` legacy naming).

Uncontrolled rename work risks regressions and contributor confusion.

## Decision
Adopt a zero-regression naming canonicalization policy using parallel change:
1. Expand: add canonical names and compatibility aliases.
2. Migrate: update callsites in bounded slices with full validation gates.
3. Contract: remove legacy aliases only after a minimum two-release-cycle deprecation window and explicit stop-point approval.

Canonical naming decisions:
- User-facing AI Studio reference surface: `Reference Grid`.
- Create workflow panel canonical name: `CreatePropertiesPanel`.
- Workflow panel canonical names remain `EditPropertiesPanel` and `VideoPropertiesPanel`.

Archive policy:
- `docs/archive/` and `docs/brainstorming/` are non-authoritative for naming audits; legacy naming may be preserved for historical traceability.

## Consequences
### Positive
1. Lower rename regression risk through explicit compatibility windows.
2. Stronger cross-doc and code terminology alignment.
3. Auditable migration and deprecation lifecycle.

### Negative
1. Temporary dual-name complexity during bridge and migration phases.
2. Added governance overhead (decision log, tracker, evidence artifacts).

## Follow-ups
1. Maintain canonical map and tracker under `docs/planning/`.
2. Attach evidence artifact for every naming slice.
3. Do not remove deprecated aliases before deprecation-window and stop-point criteria are met.
