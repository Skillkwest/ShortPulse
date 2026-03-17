# B5-02 Expert Inpaint Shell Surface Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the neutral surface aliases for the base inpaint controls shell in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - base inpaint-controls border
    - base inpaint-controls background
  - intentionally leave the one-off shell shadow literal in place until a real shared shadow family exists
  - keep themed inpaint/video/move accent states untouched
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
  - the base inpaint-controls shell now consumes the existing expert neutral border/surface aliases instead of repeating direct literals
  - no selector structure, class names, or import order changed
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+2 / -2`
  - coupling reduced by removing another direct neutral shell literal pair without adding token surface area
- `net_complexity_note`:
  - this was the correct narrowed slice because the shell shadow was a one-off value and did not justify a new token on its own
  - the migration still produced a real reduction in literal ownership while avoiding token churn
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no intended visual changes
  - themed and accent-specific shell variants remain untouched
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css` and this packet if parity issues are found in the base inpaint controls shell
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It removed repeated neutral shell literals without inventing a one-off shadow token.
2. It stayed disciplined about net complexity instead of overstating a partial shell migration.
3. It keeps the remaining themed shell work isolated for later, more deliberate slices.
