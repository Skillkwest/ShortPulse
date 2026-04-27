# B5-02 Expert Wrapper And Trigger Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the expert neutral wrapper/trigger family in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - styles wrapper surface and shadow
    - inpaint wrapper and collapsed-wrapper surface and shadow
    - circular inpaint trigger border/surface/text defaults
    - inpaint collapse title muted text
  - keep accent-selected, gradient, and mixed highlight states untouched outside this shared neutral family
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
  - the wrapper/trigger family now consumes shared expert neutral surface/shadow aliases plus a dedicated light control-border alias and stronger muted text alias
  - no selector structure, class names, or import order changed
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+10 / -10`
  - `frontend/styles/ai-studio-edit-expert.tokens.css`: `+2 / -0`
  - coupling reduced by removing another repeated neutral wrapper/trigger family from direct literal ownership
- `net_complexity_note`:
  - this stayed within the established neutral-control contract and only introduced two narrowly justified aliases needed by repeated wrapper/trigger defaults
  - it did not broaden into accent-heavy or mixed-state migration, which would have increased parity risk
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no intended visual changes
  - existing accent and highlighted states remain untouched
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css`, `frontend/styles/ai-studio-edit-expert.tokens.css`, and this packet if parity issues are found in the wrapper or trigger controls
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It migrated one coherent neutral wrapper/trigger family instead of scattering value swaps across unrelated surfaces.
2. It reused the authority contract already established in `B5-01` and earlier `B5-02` slices.
3. It keeps the remaining accent-heavy clusters isolated for later, more deliberate migration.
