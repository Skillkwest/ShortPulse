# B5-02 Expert Rail Controls Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the expert neutral rail/button family in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - inpaint tool-rail title and base button defaults
    - neutral inpaint expand and clear button defaults
    - move-mode neutral button defaults and shared active surface states
  - keep accent-selected and gradient-highlight states intact except where they already share the neutral control surface
- `commands_run`:
  - `npm -C frontend run lint`
  - `npm -C frontend run type-check`
  - `npm -C frontend run check:architecture-boundary`
  - `npm -C frontend run check:size-budget`
  - `npm -C frontend run build`
  - `npm -C frontend run docs:check`
- `results`:
  - all commands passed
  - lint remained at the existing baseline `7` warnings
  - the rail/button family now consumes shared expert control tokens for muted text, soft border, control surface, hover surface, active surface, and neutral clear-button text
  - no selector structure or import order changed
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+42 / -42`
  - `frontend/styles/ai-studio-edit-expert.tokens.css`: `+5 / -0`
  - coupling reduced by moving another repeated neutral interaction family off direct literals and onto the existing expert token contract
- `net_complexity_note`:
  - this slice kept the main hotspot flat in net LOC while increasing token reuse and reducing duplicate literal ownership
  - it stayed bounded to the neutral family; it did not start migrating accent-selected or gradient-highlight semantics wholesale
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no class names changed
  - no selector ownership changed
  - no intended visual delta; the migration preserved current values while centralizing them
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css`, `frontend/styles/ai-studio-edit-expert.tokens.css`, and this packet if parity issues are found in the rail controls
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It migrated one coherent neutral control family instead of scattering value swaps across unrelated surfaces.
2. It reused the authority contract already created in `B5-01` and earlier `B5-02` slices.
3. It leaves the remaining move/inpaint/video accented states isolated for later, more deliberate migration.
