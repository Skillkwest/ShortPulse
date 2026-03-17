# B5-02 Expert Prompt Shell Surface Migration

- `slice_id`: `B5-02`
- `date_utc`: `2026-03-17`
- `track`: `B-Style`
- `scope`:
  - migrate the neutral prompt-shell surface pair in `frontend/styles/ai-studio-edit-expert.css`
  - cluster includes:
    - prompt input border
    - prompt input background
    - prompt input focus border
  - keep placeholder, caret, and other prompt text styling untouched
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
  - the prompt-shell input now consumes the existing expert control surface alias instead of repeating direct surface literals for border/background/focus
  - no selector structure, class names, or import order changed
- `loc_or_coupling_delta`:
  - `frontend/styles/ai-studio-edit-expert.css`: `+3 / -3`
  - coupling reduced by removing the remaining direct prompt-shell surface literal group without adding token surface area
- `net_complexity_note`:
  - this was a valid but intentionally small B5-02 slice because the prompt shell had a coherent remaining surface triplet that mapped directly to the current control contract
  - it is also the point where B5-02 should be re-reviewed before continuing, because the remaining families are fewer and more mixed
- `seam_type`: `shared_extraction`
- `parity_assertions`:
  - no intended visual changes
  - prompt placeholder, caret, and text styling remain unchanged
- `rollback_note`:
  - revert `frontend/styles/ai-studio-edit-expert.css` and this packet if parity issues are found in the prompt shell
- `linked_pr`: `local lane-b execution stream`

## Why This Slice Cleared B5-02

1. It removed one last coherent prompt-shell surface cluster without inventing new tokens.
2. It stayed within the established expert control contract.
3. It is small enough that the next move should be a stop review, not another automatic style slice.
