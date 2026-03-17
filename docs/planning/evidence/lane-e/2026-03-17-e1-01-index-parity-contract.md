# Lane E Evidence Packet: E1-01 Index Parity Contract

- `slice_id`: `E1-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - `docs/planning/README.md`
  - `docs/README.md`
- `commands_run`:
  1. `npm -C frontend run docs:check`
  2. repo-local parity inventory against:
     - `docs/planning/*.md`
     - `docs/design/*`
     - `docs/product/*`
     - `docs/adr/*.md`
- `results`:
  1. Root docs index now includes the active missing planning docs and the missing design TSV inventories.
  2. Planning index now includes the active missing top-level planning docs.
  3. Temporary generation-drain working notes are explicitly indexed as temporary active planning collateral instead of silently drifting.
  4. Product and design section indexes were confirmed already aligned and were left unchanged.
- `drift_before_after`:
  - before:
    1. `docs/planning/README.md`: `7` active top-level planning docs missing
    2. `docs/README.md`: `8` active planning docs missing
    3. `docs/README.md`: `3` active design inventory TSVs missing
    4. `docs/product/README.md`: `0` missing
    5. `docs/design/README.md`: `0` missing
  - after:
    1. `docs/planning/README.md`: `0` missing for the touched active planning surfaces
    2. `docs/README.md`: `0` missing for the touched active planning and design surfaces
    3. `docs/product/README.md`: `0` missing
    4. `docs/design/README.md`: `0` missing
  - deferred to `E2-01`:
    1. `docs/adr/README.md`: `18` ADR entries missing
    2. duplicate ADR number `0023`
- `checker_policy_delta`:
  - no checker behavior changed in this slice
  - this slice is parity remediation only
- `allowlist_exceptions`: none
- `rollback_note`:
  - Reverting this slice reintroduces known index drift on active docs surfaces and is not recommended.
- `linked_pr`: `local lane-e slice`
