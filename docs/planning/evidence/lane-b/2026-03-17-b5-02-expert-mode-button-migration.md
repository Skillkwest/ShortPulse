# B5-02 Expert Mode Button Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the expert neutral move/inpaint mode-button family in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - base move mode button defaults and hover border
    - compact move mode button defaults and active border/surface states
    - compact non-inpaint mode button defaults, hover surface, and active border/surface states
  - keep accent hover, themed move, and non-neutral highlighted states untouched outside this shared control family
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
  - the neutral move/inpaint mode-button family now consumes the existing expert control border, surface, hover-border, active-border, and active-surface aliases instead of repeating direct literals
  - no selector structure, class names, or import order changed
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+18 / -18`
  - coupling reduced by removing another repeated neutral button-state family from direct literal ownership with no new token additions
- `net_complexity_note`:
  - this was a strong B5-02 slice because it reused the established control contract exactly and covered repeated defaults across base and compact move/inpaint button states
  - it intentionally excluded themed move/inpaint accent states and highlighted hover variants, which should remain separate
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no intended visual changes
  - themed and accent-specific move/inpaint states remain untouched
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css` and this packet if parity issues are found in move or compact mode-button states
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It migrated one coherent neutral mode-button family instead of sweeping through unrelated controls.
2. It reused the current expert control token contract without adding token surface area.
3. It leaves themed and accent-heavy move/inpaint states isolated for later, more deliberate slices.
