# B5-02 Expert Layers Toolbar Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the expert layers-toolbar neutral family in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - layers toolbar title card and toolbar card base surfaces
    - modal toolbar title card and toolbar card base surfaces
    - layers toolbar title and title icon muted text
  - keep layer-selected, accent, and action-specific states intact outside this shared neutral family
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
  - the layers-toolbar family now consumes the existing expert neutral border/surface/shadow and muted-text aliases instead of repeating direct literals
  - no selector structure, class names, or import order changed
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+14 / -14`
  - coupling reduced by removing another repeated neutral card/title family from direct literal ownership without expanding the token surface
- `net_complexity_note`:
  - this was a high-value follow-on slice because it reused the current token contract with no new token additions
  - it stayed constrained to toolbar wrapper/title defaults and avoided mixed accent or active-state migration
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no intended visual changes
  - selected and accent-specific layer states remain untouched
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css` and this packet if parity issues are found in the layers toolbar surfaces or titles
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It migrated one coherent neutral card/title family instead of sweeping through unrelated controls.
2. It reused the established expert neutral token contract without inventing extra token aliases.
3. It preserves the remaining interactive and accent-heavy layer states for later, more deliberate slices.
