# Lane E Evidence Packet: E4-01 Changelog Governance Hardening

- `slice_id`: `E4-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - `docs/change_log.md`
  - `scripts/check_docs_semantic_drift.js`
  - `docs/archive/planning/lane-e-execution-plan-2026-03-16.md`
  - `docs/archive/planning/lane-e-master-plan-2026-03-16.md`
  - `docs/planning/evidence/lane-e/README.md`
  - `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Commands Run
1. `npm -C frontend run docs:check`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`

## Results
1. Added `## Unreleased` to `docs/change_log.md` as the active changelog entry point.
2. Replaced the stale “append entries at the end” guidance with the normalized active-timeline contract.
3. Added a `## Legacy Imported Entries (pre-2026-03-17 normalization)` marker so imported historical notes remain preserved without blocking active chronology enforcement.
4. Updated `scripts/check_docs_semantic_drift.js` to enforce chronology/future-date rules on the normalized active timeline while explicitly excluding the preserved legacy section.
5. Lane E state now records `E4-01` complete and advances the next checkpoint to `E5-01`.

## Drift Before / After
1. `docs/change_log.md` `## Unreleased` presence:
   - before: `missing`
   - after: `present`
2. Changelog chronology/future-date enforcement activation in `scripts/check_docs_semantic_drift.js`:
   - before: `inactive` (no `## Unreleased`)
   - after: `active` (normalized active timeline only)
3. Legacy imported chronology drift handled by explicit exclusion marker:
   - before: `implicit / unmanaged`
   - after: `explicitly separated historical section`

## Checker Policy Delta
1. No new checker introduced.
2. Existing `scripts/check_docs_semantic_drift.js` changelog rule is now active for the normalized timeline once `## Unreleased` exists.

## Allowlist Exceptions
1. None.

## Rollback Note
1. Revert the changelog normalization and checker update together if the active/legacy split needs to be redesigned.
2. Do not remove the legacy marker without either normalizing the imported chronology or replacing it with an equivalent explicit exclusion boundary.

## Linked PR
1. Pending.
